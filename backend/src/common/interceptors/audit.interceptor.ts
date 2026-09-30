import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Interceptor global de auditoría para operaciones de mutación (POST, PUT, PATCH, DELETE).
 * Registra de forma inmutable cada cambio en las entidades críticas (solicitudes, préstamos, equipos),
 * capturando snapshots JSONB del estado anterior y posterior, el usuario ejecutor y la dirección IP.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(@Optional() private readonly dataSource?: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // Solo se auditan operaciones de mutación exitosas
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url = request.originalUrl || request.url || '';

    // Filtrar rutas que no requieren registro de auditoría de negocio
    if (
      url.includes('/auth/sso-login') ||
      url.includes('/health') ||
      url.includes('/metrics')
    ) {
      return next.handle();
    }

    const tablaAfectada = this.determinarTablaAfectada(url);
    const idParam = request.params?.id;

    // Capturar snapshot del estado anterior si existe un ID de registro en la petición
    let datosAnteriores: Record<string, any> | null = null;
    if (
      idParam &&
      UUID_REGEX.test(idParam) &&
      this.dataSource &&
      this.dataSource.isInitialized &&
      tablaAfectada !== 'auditoria'
    ) {
      try {
        const queryResult = await this.dataSource.query(
          `SELECT * FROM "${tablaAfectada}" WHERE id = $1 LIMIT 1`,
          [idParam],
        );
        if (queryResult && queryResult.length > 0) {
          datosAnteriores = queryResult[0];
        }
      } catch (err) {
        this.logger.debug(
          `No se pudo obtener snapshot anterior para ${tablaAfectada}:${idParam} - ${err.message}`,
        );
      }
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          await this.registrarEventoAuditoria({
            request,
            method,
            url,
            tablaAfectada,
            idParam,
            datosAnteriores,
            responseBody,
          });
        } catch (auditError) {
          this.logger.error(
            `Error al persistir registro de auditoría inmutable: ${auditError.message}`,
            auditError.stack,
          );
        }
      }),
    );
  }

  /**
   * Determina el nombre de la tabla de base de datos según el segmento de ruta.
   */
  private determinarTablaAfectada(url: string): string {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('solicitud')) {
      return 'solicitudes_prestamo';
    }
    if (urlLower.includes('prestamo')) {
      return 'prestamos';
    }
    if (urlLower.includes('equipo')) {
      return 'equipos';
    }
    if (urlLower.includes('categoria')) {
      return 'categorias';
    }
    if (urlLower.includes('usuario')) {
      return 'usuarios';
    }
    return 'entidad_sistema';
  }

  /**
   * Determina el descriptor de la acción ejecutada según la ruta y método HTTP.
   */
  private determinarAccion(method: string, url: string, body?: any): string {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('solicitud')) {
      if (method === 'POST') {
        return 'CREAR_SOLICITUD';
      }
      if (urlLower.includes('resolver') || urlLower.includes('aprobar')) {
        return body?.estado === 'rechazada' ? 'RECHAZAR_SOLICITUD' : 'APROBAR_PRESTAMO';
      }
      if (urlLower.includes('rechazar')) {
        return 'RECHAZAR_SOLICITUD';
      }
      return `${method}_SOLICITUD`;
    }

    if (urlLower.includes('prestamo')) {
      if (urlLower.includes('devolucion')) {
        return 'REGISTRAR_DEVOLUCION';
      }
      if (urlLower.includes('renov')) {
        return 'RENOVAR_PRESTAMO';
      }
      if (method === 'POST') {
        return 'CREAR_PRESTAMO';
      }
      return `${method}_PRESTAMO`;
    }

    if (urlLower.includes('equipo')) {
      if (method === 'POST') return 'CREAR_EQUIPO';
      if (method === 'PUT' || method === 'PATCH') return 'ACTUALIZAR_EQUIPO';
      if (method === 'DELETE') return 'ELIMINAR_EQUIPO';
      return `${method}_EQUIPO`;
    }

    return `${method}_${this.determinarTablaAfectada(url).toUpperCase()}`;
  }

  /**
   * Persiste el registro de auditoría en la tabla 'auditoria' de la base de datos.
   */
  private async registrarEventoAuditoria(params: {
    request: any;
    method: string;
    url: string;
    tablaAfectada: string;
    idParam?: string;
    datosAnteriores: Record<string, any> | null;
    responseBody: any;
  }): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return;
    }

    const {
      request,
      method,
      url,
      tablaAfectada,
      idParam,
      datosAnteriores,
      responseBody,
    } = params;

    const accion = this.determinarAccion(method, url, request.body);

    // Extraer o generar un ID de registro válido en formato UUID
    let registroId =
      responseBody?.id ||
      responseBody?.data?.id ||
      idParam ||
      request.body?.id;

    if (!registroId || !UUID_REGEX.test(registroId)) {
      registroId = randomUUID();
    }

    // Identificar el ID del usuario actor
    let usuarioId: string | null = request.user?.id || null;
    if (usuarioId && !UUID_REGEX.test(usuarioId)) {
      usuarioId = null;
    }

    // Obtener la dirección IP del cliente (priorizando encabezados de proxy GCP Cloud Run)
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const ipRaw =
      (typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : request.socket?.remoteAddress || request.ip || '127.0.0.1');
    const direccionIp = ipRaw.substring(0, 45);

    // Snapshot del estado posterior
    let datosNuevos: Record<string, any> | null = null;
    if (responseBody && typeof responseBody === 'object') {
      datosNuevos = responseBody;
    } else if (request.body && typeof request.body === 'object') {
      datosNuevos = request.body;
    }

    const auditRepo = this.dataSource.getRepository(AuditoriaEntity);
    const nuevoRegistro = auditRepo.create({
      tabla_afectada: tablaAfectada,
      registro_id: registroId,
      accion: accion.substring(0, 50),
      datos_anteriores: datosAnteriores,
      datos_nuevos: datosNuevos,
      usuario_id: usuarioId,
      direccion_ip: direccionIp,
      fecha_evento: new Date(),
    });

    await auditRepo.save(nuevoRegistro);
  }
}
