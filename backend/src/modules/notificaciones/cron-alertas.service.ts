import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { NotificacionesService } from './notificaciones.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

export interface ResumenEjecucionCron {
  totalCandidatos: number;
  alertasEnviadas: number;
  omitidosPorDuplicado: number;
  errores: number;
  detalles: Array<{
    prestamoId: string;
    email: string;
    diasRestantes: number;
    estado: 'enviado' | 'duplicado' | 'error';
    mensaje?: string;
  }>;
}

/**
 * Worker programado (Cron Job) que identifica diariamente los préstamos activos
 * que se encuentran a 3 días o menos de su fecha límite de devolución.
 *
 * Características de confiabilidad:
 * - Tolerancia a fallos: La iteración sobre cada préstamo está aislada en bloques try/catch
 *   para evitar que la falla de un destinatario interrumpa el lote completo.
 * - Prevención de duplicados: Verifica si ya se despachó una alerta para el préstamo en el día actual
 *   consultando la bitácora inmutable de auditoría y un registro en memoria.
 * - Trazabilidad forense: Cada alerta despachada se registra como evento en la tabla 'auditoria'.
 */
@Injectable()
export class CronAlertasService {
  private readonly logger = new Logger(CronAlertasService.name);

  // Registro en memoria para evitar dobles envíos en la misma jornada
  private readonly alertasEnviadasHoyMemoria = new Map<string, string>();

  constructor(
    @InjectRepository(PrestamoEntity)
    private readonly prestamoRepository: Repository<PrestamoEntity>,
    private readonly notificacionesService: NotificacionesService,
    @Optional() private readonly auditoriaService?: AuditoriaService,
    @Optional()
    @InjectRepository(AuditoriaEntity)
    private readonly auditoriaRepository?: Repository<AuditoriaEntity>,
  ) {}

  /**
   * Tarea programada que se ejecuta todos los días a las 9:00 AM (hora del servidor).
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, {
    name: 'revision-diaria-vencimientos-prestamos',
  })
  async manejarCronVencimientos(): Promise<void> {
    this.logger.log('Iniciando ejecución programada de revisión de vencimientos (09:00 AM)...');
    try {
      const resumen = await this.ejecutarRevisionVencimientos();
      this.logger.log(
        `Ejecución programada finalizada con éxito. Candidatos: ${resumen.totalCandidatos}, ` +
          `Alertas enviadas: ${resumen.alertasEnviadas}, Duplicados omitidos: ${resumen.omitidosPorDuplicado}, ` +
          `Errores: ${resumen.errores}`,
      );
    } catch (cronError) {
      this.logger.error(
        `Fallo no controlado en la ejecución global del cron de alertas: ${cronError.message}`,
        cronError.stack,
      );
    }
  }

  /**
   * Ejecuta la lógica central de revisión y despacho de alertas preventivas.
   * Expuesto públicamente para permitir su invocación en pruebas unitarias y tareas administrativas.
   *
   * @param fechaReferencia Fecha base de comparación (por defecto `new Date()`)
   */
  async ejecutarRevisionVencimientos(
    fechaReferencia: Date = new Date(),
  ): Promise<ResumenEjecucionCron> {
    const ahora = new Date(fechaReferencia);
    const fechaLimiteTresDias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);

    this.logger.log(
      `Buscando préstamos activos con fecha de vencimiento <= ${fechaLimiteTresDias.toISOString()}`,
    );

    // Buscar préstamos activos cuyo vencimiento sea menor o igual a 3 días desde ahora
    const prestamosCandidatos = await this.prestamoRepository.find({
      where: {
        estado: EstadoPrestamo.ACTIVO,
        fecha_vencimiento: LessThanOrEqual(fechaLimiteTresDias),
      },
      relations: ['usuario', 'equipo'],
      order: {
        fecha_vencimiento: 'ASC',
      },
    });

    const resumen: ResumenEjecucionCron = {
      totalCandidatos: prestamosCandidatos.length,
      alertasEnviadas: 0,
      omitidosPorDuplicado: 0,
      errores: 0,
      detalles: [],
    };

    if (prestamosCandidatos.length === 0) {
      this.logger.log('No se encontraron préstamos activos próximos a vencer.');
      return resumen;
    }

    const claveFechaHoy = ahora.toISOString().slice(0, 10);

    for (const prestamo of prestamosCandidatos) {
      try {
        const usuario = prestamo.usuario;
        const equipo = prestamo.equipo;

        if (!usuario || !usuario.email) {
          this.logger.warn(
            `Préstamo ID [${prestamo.id}] no cuenta con usuario o correo electrónico válido. Omitiendo.`,
          );
          resumen.errores++;
          resumen.detalles.push({
            prestamoId: prestamo.id,
            email: 'desconocido',
            diasRestantes: 0,
            estado: 'error',
            mensaje: 'Usuario o email no disponible',
          });
          continue;
        }

        // Calcular días restantes (puede ser 0 o negativo si ya expiró hoy)
        const msDiferencia =
          new Date(prestamo.fecha_vencimiento).getTime() - ahora.getTime();
        const diasRestantes = Math.ceil(msDiferencia / (1000 * 60 * 60 * 24));

        // 1. Verificación anti-duplicados para la jornada actual
        const yaAlertado = await this.verificarAlertaDuplicada(
          prestamo.id,
          claveFechaHoy,
          ahora,
        );

        if (yaAlertado) {
          this.logger.debug(
            `Alerta para préstamo [${prestamo.id}] ya enviada hoy a [${usuario.email}]. Omitiendo duplicado.`,
          );
          resumen.omitidosPorDuplicado++;
          resumen.detalles.push({
            prestamoId: prestamo.id,
            email: usuario.email,
            diasRestantes,
            estado: 'duplicado',
            mensaje: 'Alerta ya enviada en la fecha actual',
          });
          continue;
        }

        // 2. Envío seguro de la notificación por correo electrónico
        const nombreEquipo = equipo
          ? `${equipo.marca} ${equipo.modelo}`
          : 'Equipo Institucional';

        const resultadoEnvio = await this.notificacionesService.enviarAlertaVencimiento({
          email: usuario.email,
          nombreColaborador: usuario.nombre_completo || 'Colaborador/a',
          equipo: nombreEquipo,
          codigoInventario: equipo?.codigo_inventario,
          fechaVencimiento: prestamo.fecha_vencimiento,
          diasRestantes,
          prestamoId: prestamo.id,
        });

        if (resultadoEnvio.enviado) {
          // Registrar en memoria para evitar duplicados en la misma jornada
          this.alertasEnviadasHoyMemoria.set(prestamo.id, claveFechaHoy);

          // Registrar en auditoría inmutable
          await this.registrarAuditoriaAlerta(prestamo, usuario.email, diasRestantes);

          resumen.alertasEnviadas++;
          resumen.detalles.push({
            prestamoId: prestamo.id,
            email: usuario.email,
            diasRestantes,
            estado: 'enviado',
          });

          this.logger.log(
            `Alerta de vencimiento despachada a [${usuario.email}] para préstamo [${prestamo.id}] (${diasRestantes} días restantes)`,
          );
        } else {
          resumen.errores++;
          resumen.detalles.push({
            prestamoId: prestamo.id,
            email: usuario.email,
            diasRestantes,
            estado: 'error',
            mensaje: resultadoEnvio.error,
          });
        }
      } catch (itemError) {
        // Tolerancia a fallos: atrapar error por registro y continuar con el lote
        this.logger.error(
          `Error procesando alerta para préstamo ID [${prestamo.id}]: ${itemError.message}`,
          itemError.stack,
        );
        resumen.errores++;
        resumen.detalles.push({
          prestamoId: prestamo.id,
          email: prestamo.usuario?.email || 'desconocido',
          diasRestantes: 0,
          estado: 'error',
          mensaje: itemError.message,
        });
      }
    }

    return resumen;
  }

  /**
   * Comprueba si ya se emitió una alerta de vencimiento para el préstamo en la jornada de hoy.
   */
  private async verificarAlertaDuplicada(
    prestamoId: string,
    claveFechaHoy: string,
    ahora: Date,
  ): Promise<boolean> {
    // Verificación rápida en memoria
    if (this.alertasEnviadasHoyMemoria.get(prestamoId) === claveFechaHoy) {
      return true;
    }

    // Verificación en base de datos (tabla auditoria)
    try {
      const inicioDia = new Date(ahora);
      inicioDia.setHours(0, 0, 0, 0);

      if (this.auditoriaRepository) {
        const conteo = await this.auditoriaRepository.count({
          where: {
            registro_id: prestamoId,
            accion: 'NOTIFICACION_VENCIMIENTO',
            fecha_evento: Between(inicioDia, ahora),
          },
        });
        if (conteo > 0) {
          this.alertasEnviadasHoyMemoria.set(prestamoId, claveFechaHoy);
          return true;
        }
      }
    } catch (dbError) {
      this.logger.warn(
        `No se pudo consultar historial de auditoría para deduplicación: ${dbError.message}`,
      );
    }

    return false;
  }

  /**
   * Persiste el evento de notificación en la bitácora inmutable de auditoría.
   */
  private async registrarAuditoriaAlerta(
    prestamo: PrestamoEntity,
    emailDestino: string,
    diasRestantes: number,
  ): Promise<void> {
    try {
      const datosEvento: Partial<AuditoriaEntity> = {
        tabla_afectada: 'prestamos',
        registro_id: prestamo.id,
        accion: 'NOTIFICACION_VENCIMIENTO',
        datos_anteriores: null,
        datos_nuevos: {
          destinatario: emailDestino,
          diasRestantes,
          fechaVencimiento: prestamo.fecha_vencimiento,
          notificadoEn: new Date().toISOString(),
        },
        usuario_id: prestamo.usuario_id,
        direccion_ip: '127.0.0.1 (cron-worker)',
        fecha_evento: new Date(),
      };

      if (this.auditoriaService) {
        await this.auditoriaService.registrarEvento(datosEvento);
      } else if (this.auditoriaRepository) {
        const entity = this.auditoriaRepository.create(datosEvento);
        await this.auditoriaRepository.save(entity);
      }
    } catch (auditError) {
      this.logger.warn(
        `No se pudo registrar evento de auditoría para la notificación: ${auditError.message}`,
      );
    }
  }
}
