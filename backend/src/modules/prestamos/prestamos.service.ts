import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { RenovarPrestamoDto } from './dto/renovar-prestamo.dto';

export interface PaginatedPrestamosResponse {
  data: PrestamoEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Servicio encargado de la gestión del ciclo de vida de los préstamos formalizados de activos TI:
 * control de plazos de vigencia, renovaciones únicas de hasta 30 días y registro de devoluciones físicas.
 */
@Injectable()
export class PrestamosService {
  private readonly logger = new Logger(PrestamosService.name);

  constructor(
    @InjectRepository(PrestamoEntity)
    private readonly prestamoRepository: Repository<PrestamoEntity>,
    @InjectRepository(EquipoEntity)
    private readonly equipoRepository: Repository<EquipoEntity>,
    @Optional() private readonly notificacionesService?: NotificacionesService,
  ) {}

  /**
   * Obtiene la lista paginada de préstamos con soporte de filtros opcionales por usuario o estado.
   */
  async findAll(filters?: {
    usuario_id?: string;
    estado?: string;
    por_vencer?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedPrestamosResponse> {
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.prestamoRepository
      .createQueryBuilder('prestamo')
      .leftJoinAndSelect('prestamo.usuario', 'usuario')
      .leftJoinAndSelect('prestamo.equipo', 'equipo')
      .leftJoinAndSelect('equipo.categoria', 'categoria')
      .leftJoinAndSelect('prestamo.solicitud', 'solicitud')
      .leftJoinAndSelect('prestamo.encargado_entrega', 'encargado_entrega')
      .leftJoinAndSelect('prestamo.encargado_devolucion', 'encargado_devolucion');

    if (filters?.usuario_id) {
      qb.andWhere('prestamo.usuario_id = :usuario_id', {
        usuario_id: filters.usuario_id,
      });
    }

    if (filters?.estado) {
      qb.andWhere('prestamo.estado = :estado', {
        estado: filters.estado,
      });
    }

    if (filters?.por_vencer) {
      const ahora = new Date();
      const limite = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);
      qb.andWhere('prestamo.estado = :estadoActivo', {
        estadoActivo: EstadoPrestamo.ACTIVO,
      });
      qb.andWhere('prestamo.fecha_vencimiento >= :ahora', { ahora });
      qb.andWhere('prestamo.fecha_vencimiento <= :limite', { limite });
    }

    qb.orderBy('prestamo.fecha_inicio', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Busca un préstamo por su identificador único UUID, incluyendo relaciones principales.
   *
   * @param id Identificador UUID del préstamo
   * @throws NotFoundException Si el préstamo no existe en la base de datos
   */
  async findPrestamoById(id: string): Promise<PrestamoEntity> {
    const prestamo = await this.prestamoRepository.findOne({
      where: { id },
      relations: [
        'usuario',
        'equipo',
        'equipo.categoria',
        'solicitud',
        'encargado_entrega',
        'encargado_devolucion',
      ],
    });

    if (!prestamo) {
      throw new NotFoundException(`Préstamo con ID "${id}" no encontrado`);
    }

    return prestamo;
  }

  /**
   * Registra la devolución física de un equipo tecnológico en préstamo.
   * Regla TC004:
   * - Valida que el préstamo exista y no haya sido previamente devuelto.
   * - Actualiza el préstamo: estado = 'devuelto', fecha_devolucion = now(), encargado_devolucion_id.
   * - Reintegra el equipo al inventario actualizando equipo.estado = estado_fisico_equipo (default 'disponible').
   *
   * @param prestamoId Identificador UUID del préstamo a liquidar
   * @param encargadoId Identificador UUID del encargado de TI que recibe el equipo
   * @param dto Datos opcionales del estado físico y observaciones de recepción
   */
  async registrarDevolucion(
    prestamoId: string,
    encargadoId: string,
    dto?: RegistrarDevolucionDto,
  ): Promise<PrestamoEntity> {
    const prestamo = await this.prestamoRepository.findOne({
      where: { id: prestamoId },
      relations: ['equipo', 'usuario'],
    });

    if (!prestamo) {
      throw new NotFoundException(`Préstamo con ID "${prestamoId}" no encontrado`);
    }

    if (prestamo.estado === EstadoPrestamo.DEVUELTO || prestamo.fecha_devolucion !== null) {
      throw new BadRequestException('El préstamo ya se encuentra devuelto');
    }

    const ahora = new Date();
    prestamo.estado = EstadoPrestamo.DEVUELTO;
    prestamo.fecha_devolucion = ahora;
    prestamo.encargado_devolucion_id = encargadoId;

    if (dto?.observaciones && dto.observaciones.trim() !== '') {
      prestamo.observaciones = prestamo.observaciones
        ? `${prestamo.observaciones} | Devolución: ${dto.observaciones.trim()}`
        : dto.observaciones.trim();
    }

    await this.prestamoRepository.save(prestamo);

    // Actualizar el estado del equipo en el catálogo
    const equipo = prestamo.equipo || (await this.equipoRepository.findOne({ where: { id: prestamo.equipo_id } }));
    if (equipo) {
      equipo.estado = dto?.estado_fisico_equipo || EstadoEquipo.DISPONIBLE;
      await this.equipoRepository.save(equipo);
    }

    this.logger.log(
      `Devolución registrada exitosamente para préstamo ${prestamoId}. Equipo ${prestamo.equipo_id} restablecido a ${equipo?.estado || 'disponible'}.`,
    );

    // Despacho no bloqueante de correo de confirmación de devolución
    if (this.notificacionesService && prestamo.usuario?.email) {
      const nombreEquipo = equipo
        ? `${equipo.marca} ${equipo.modelo}`
        : 'Equipo institucional';

      this.notificacionesService
        .enviarConfirmacionDevolucion({
          email: prestamo.usuario.email,
          nombreColaborador:
            prestamo.usuario.nombre_completo || 'Colaborador/a',
          equipo: nombreEquipo,
          codigoInventario: equipo?.codigo_inventario,
          fechaDevolucion: ahora,
          estadoFisico: equipo?.estado || 'disponible',
          observaciones: dto?.observaciones,
        })
        .catch((err) => {
          this.logger.warn(
            `Error no bloqueante al enviar correo de devolución para préstamo ${prestamoId}: ${err.message}`,
          );
        });
    }

    return this.findPrestamoById(prestamoId);
  }

  /**
   * Procesa la renovación o extensión de un préstamo activo de equipo tecnológico.
   * Regla de negocio:
   * - Máximo 1 renovación permitida durante el ciclo de vida del préstamo (renovado === false).
   * - Solo aplicable sobre préstamos con estado 'activo' que no estén vencidos ni devueltos.
   * - Extiende la fecha de vencimiento hasta 30 días adicionales (dias_extension, default 30).
   * - Marca el campo renovado = true.
   *
   * @param prestamoId Identificador UUID del préstamo a extender
   * @param usuarioId Identificador del usuario que solicita la renovación (para validar pertenencia)
   * @param dto Parámetros de extensión en días y motivo
   * @param esAdmin Booleano que indica si el usuario que ejecuta la acción es administrador de TI
   */
  async renovarPrestamo(
    prestamoId: string,
    usuarioId?: string,
    dto?: RenovarPrestamoDto,
    esAdmin: boolean = false,
  ): Promise<PrestamoEntity> {
    const prestamo = await this.prestamoRepository.findOne({
      where: { id: prestamoId },
    });

    if (!prestamo) {
      throw new NotFoundException(`Préstamo con ID "${prestamoId}" no encontrado`);
    }

    // Si no es administrador de TI, verificar que el préstamo pertenezca al usuario solicitante
    if (usuarioId && !esAdmin && prestamo.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Acceso denegado: solo el titular del préstamo o un administrador de TI puede solicitar su renovación',
      );
    }

    // Regla: Máximo 1 renovación permitida
    if (prestamo.renovado) {
      throw new BadRequestException(
        'El préstamo ya ha sido renovado previamente. No se permiten renovaciones adicionales',
      );
    }

    // Regla: No se puede renovar un préstamo ya devuelto
    if (prestamo.estado === EstadoPrestamo.DEVUELTO || prestamo.fecha_devolucion !== null) {
      throw new BadRequestException(
        'No se puede renovar un préstamo que ya ha sido devuelto',
      );
    }

    // Regla: No se puede renovar un préstamo ya vencido
    const ahora = new Date();
    const fechaVencimientoActual = new Date(prestamo.fecha_vencimiento);
    if (prestamo.estado === EstadoPrestamo.VENCIDO || ahora > fechaVencimientoActual) {
      throw new BadRequestException(
        'No se puede renovar un préstamo con plazo de vigencia ya vencido',
      );
    }

    const diasExtension = Math.min(30, Math.max(1, dto?.dias_extension ?? 30));
    const nuevaFechaVencimiento = new Date(
      fechaVencimientoActual.getTime() + diasExtension * 24 * 60 * 60 * 1000,
    );

    prestamo.renovado = true;
    prestamo.fecha_vencimiento = nuevaFechaVencimiento;

    const motivoTexto = dto?.motivo_renovacion || dto?.observaciones;
    if (motivoTexto && motivoTexto.trim() !== '') {
      prestamo.observaciones = prestamo.observaciones
        ? `${prestamo.observaciones} | Renovación (${diasExtension} días): ${motivoTexto.trim()}`
        : `Renovación (${diasExtension} días): ${motivoTexto.trim()}`;
    }

    await this.prestamoRepository.save(prestamo);

    this.logger.log(
      `Préstamo ${prestamoId} renovado exitosamente por ${diasExtension} días adicionales. Nueva fecha vencimiento: ${nuevaFechaVencimiento.toISOString()}`,
    );

    return this.findPrestamoById(prestamoId);
  }

  /**
   * Crea y formaliza un nuevo registro de préstamo en base a una solicitud aprobada.
   */
  async crearPrestamo(datos: {
    solicitud_id: string;
    usuario_id: string;
    equipo_id: string;
    encargado_entrega_id: string;
    dias_prestamo?: number;
    observaciones?: string;
  }): Promise<PrestamoEntity> {
    const dias = Math.min(90, Math.max(1, datos.dias_prestamo || 30));
    const fechaInicio = new Date();
    const fechaVencimiento = new Date(
      fechaInicio.getTime() + dias * 24 * 60 * 60 * 1000,
    );

    const nuevoPrestamo = this.prestamoRepository.create({
      solicitud_id: datos.solicitud_id,
      usuario_id: datos.usuario_id,
      equipo_id: datos.equipo_id,
      encargado_entrega_id: datos.encargado_entrega_id,
      encargado_devolucion_id: null,
      fecha_inicio: fechaInicio,
      fecha_vencimiento: fechaVencimiento,
      renovado: false,
      fecha_devolucion: null,
      estado: EstadoPrestamo.ACTIVO,
      observaciones: datos.observaciones || 'Entrega física y asignación formal de equipo tecnológico',
    });

    return this.prestamoRepository.save(nuevoPrestamo);
  }
}
