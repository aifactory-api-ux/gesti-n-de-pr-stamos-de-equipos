import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SolicitudPrestamoEntity,
  EstadoSolicitud,
} from '../../database/entities/solicitud_prestamo.entity';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import { UsuarioEntity, RolUsuario } from '../../database/entities/usuario.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import {
  ResolverSolicitudDto,
  EstadoResolucionSolicitud,
} from './dto/resolver-solicitud.dto';

export interface PaginatedSolicitudesResponse {
  data: SolicitudPrestamoEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Servicio encargado de la lógica de negocio del flujo de solicitudes de préstamos de activos TI:
 * creación con validación estricta de cupos e inventario, listados con RBAC y resolución por TI.
 */
@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    @InjectRepository(SolicitudPrestamoEntity)
    private readonly solicitudRepository: Repository<SolicitudPrestamoEntity>,
    @InjectRepository(EquipoEntity)
    private readonly equipoRepository: Repository<EquipoEntity>,
    @InjectRepository(PrestamoEntity)
    private readonly prestamoRepository: Repository<PrestamoEntity>,
    @Optional() private readonly notificacionesService?: NotificacionesService,
  ) {}

  /**
   * Crea una nueva solicitud de préstamo para un colaborador.
   * Reglas de validación de negocio (TC002, TC007):
   * 1. Colaborador debe tener menos de 2 préstamos activos (estados 'activo' y 'vencido').
   * 2. El equipo debe existir en el catálogo institucional.
   * 3. El equipo debe encontrarse en estado 'disponible' (HTTP 400 si no lo está).
   * 4. No debe existir una solicitud previa en estado 'pendiente' del mismo usuario para el mismo equipo.
   */
  async createSolicitud(
    usuarioId: string,
    dto: CreateSolicitudDto,
  ): Promise<SolicitudPrestamoEntity> {
    // 1. Validar límite máximo de préstamos simultáneos del colaborador (< 2 activos)
    const prestamosActivosCount = await this.prestamoRepository.count({
      where: [
        { usuario_id: usuarioId, estado: EstadoPrestamo.ACTIVO },
        { usuario_id: usuarioId, estado: EstadoPrestamo.VENCIDO },
      ],
    });

    if (prestamosActivosCount >= 2) {
      throw new BadRequestException(
        'El colaborador ha alcanzado el límite máximo permitido de 2 préstamos activos simultáneos',
      );
    }

    // 2. Validar existencia del equipo en inventario
    const equipo = await this.equipoRepository.findOne({
      where: { id: dto.equipo_id },
      relations: ['categoria'],
    });

    if (!equipo) {
      throw new NotFoundException(
        `Equipo tecnológico con ID "${dto.equipo_id}" no encontrado en el inventario`,
      );
    }

    // 3. Validar disponibilidad física del equipo (TC007)
    if (equipo.estado !== EstadoEquipo.DISPONIBLE) {
      throw new BadRequestException(
        `El equipo "${equipo.marca} ${equipo.modelo}" no está disponible para préstamo (estado actual: ${equipo.estado})`,
      );
    }

    // 4. Validar que no exista solicitud pendiente idéntica para evitar duplicaciones
    const solicitudPendiente = await this.solicitudRepository.findOne({
      where: {
        usuario_id: usuarioId,
        equipo_id: dto.equipo_id,
        estado: EstadoSolicitud.PENDIENTE,
      },
    });

    if (solicitudPendiente) {
      throw new ConflictException(
        'Ya existe una solicitud pendiente de aprobación para este equipo',
      );
    }

    // Crear y persistir la solicitud con estado 'pendiente' (TC002)
    const nuevaSolicitud = this.solicitudRepository.create({
      usuario_id: usuarioId,
      equipo_id: dto.equipo_id,
      motivo: dto.motivo.trim(),
      estado: EstadoSolicitud.PENDIENTE,
      fecha_solicitud: new Date(),
      fecha_resolucion: null,
      resuelto_por: null,
    });

    const solicitudGuardada = await this.solicitudRepository.save(nuevaSolicitud);
    this.logger.log(
      `Solicitud ${solicitudGuardada.id} creada por usuario ${usuarioId} para equipo ${dto.equipo_id}`,
    );

    return this.findById(solicitudGuardada.id);
  }

  /**
   * Obtiene el listado de solicitudes con soporte de paginación y RBAC:
   * - Colaboradores ordinarios solo pueden listar sus propias solicitudes.
   * - Administradores de TI pueden ver todas las solicitudes o filtrar por usuario.
   */
  async findAll(
    usuario: UsuarioEntity,
    filters?: {
      estado?: string;
      usuario_id?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedSolicitudesResponse> {
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.usuario', 'usuario')
      .leftJoinAndSelect('solicitud.equipo', 'equipo')
      .leftJoinAndSelect('equipo.categoria', 'categoria')
      .leftJoinAndSelect('solicitud.resolutor', 'resolutor');

    // Restricción RBAC: colaboradores solo ven sus propias peticiones
    if (usuario.rol !== RolUsuario.ADMINISTRADOR_TI) {
      qb.andWhere('solicitud.usuario_id = :currentUserId', {
        currentUserId: usuario.id,
      });
    } else if (filters?.usuario_id) {
      qb.andWhere('solicitud.usuario_id = :targetUserId', {
        targetUserId: filters.usuario_id,
      });
    }

    if (filters?.estado) {
      qb.andWhere('solicitud.estado = :estado', {
        estado: filters.estado,
      });
    }

    qb.orderBy('solicitud.fecha_solicitud', 'DESC');
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
   * Obtiene el detalle de una solicitud por su ID.
   * Valida permisos: si el usuario es colaborador, la solicitud debe pertenecerle.
   */
  async findById(
    id: string,
    usuario?: UsuarioEntity,
  ): Promise<SolicitudPrestamoEntity> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id },
      relations: ['usuario', 'equipo', 'equipo.categoria', 'resolutor'],
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID "${id}" no encontrada`);
    }

    if (
      usuario &&
      usuario.rol !== RolUsuario.ADMINISTRADOR_TI &&
      solicitud.usuario_id !== usuario.id
    ) {
      throw new ForbiddenException(
        'Acceso denegado: no tiene permisos para consultar solicitudes de otros colaboradores',
      );
    }

    return solicitud;
  }

  /**
   * Resuelve una solicitud de préstamo por parte de un administrador de TI (TC003).
   * Si es APROBADA:
   * - Cambia solicitud.estado = 'aprobada', fecha_resolucion = now(), resuelto_por = adminId.
   * - Valida que el equipo aún esté en estado 'disponible' y el usuario no supere el cupo.
   * - Cambia equipo.estado = 'prestado'.
   * - Crea el registro correspondiente en la tabla 'prestamos' con estado 'activo'.
   * Si es RECHAZADA:
   * - Cambia solicitud.estado = 'rechazada', fecha_resolucion = now(), resuelto_por = adminId.
   */
  async resolverSolicitud(
    id: string,
    adminId: string,
    dto: ResolverSolicitudDto,
  ): Promise<SolicitudPrestamoEntity> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id },
      relations: ['equipo', 'usuario'],
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID "${id}" no encontrada`);
    }

    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException(
        `La solicitud ya fue resuelta previamente con estado "${solicitud.estado}"`,
      );
    }

    const ahora = new Date();

    if (dto.estado === EstadoResolucionSolicitud.APROBADA) {
      // 1. Validar disponibilidad actual del equipo
      const equipo = await this.equipoRepository.findOne({
        where: { id: solicitud.equipo_id },
      });

      if (!equipo || equipo.estado !== EstadoEquipo.DISPONIBLE) {
        throw new BadRequestException(
          `No se puede aprobar la solicitud: el equipo no se encuentra disponible (estado actual: ${equipo?.estado || 'no existe'})`,
        );
      }

      // 2. Validar que el colaborador no haya alcanzado el cupo de préstamos activos
      const prestamosActivosCount = await this.prestamoRepository.count({
        where: [
          { usuario_id: solicitud.usuario_id, estado: EstadoPrestamo.ACTIVO },
          { usuario_id: solicitud.usuario_id, estado: EstadoPrestamo.VENCIDO },
        ],
      });

      if (prestamosActivosCount >= 2) {
        throw new BadRequestException(
          'No se puede aprobar la solicitud: el colaborador ya cuenta con el límite de 2 préstamos activos',
        );
      }

      // 3. Actualizar estado de la solicitud
      solicitud.estado = EstadoSolicitud.APROBADA;
      solicitud.fecha_resolucion = ahora;
      solicitud.resuelto_por = adminId;
      await this.solicitudRepository.save(solicitud);

      // 4. Cambiar estado del equipo a 'prestado'
      equipo.estado = EstadoEquipo.PRESTADO;
      await this.equipoRepository.save(equipo);

      // 5. Crear formalmente el préstamo activo
      const diasPrestamo = Math.min(90, Math.max(1, dto.dias_prestamo || 30));
      const fechaVencimiento = new Date(
        ahora.getTime() + diasPrestamo * 24 * 60 * 60 * 1000,
      );

      const nuevoPrestamo = this.prestamoRepository.create({
        solicitud_id: solicitud.id,
        usuario_id: solicitud.usuario_id,
        equipo_id: solicitud.equipo_id,
        encargado_entrega_id: adminId,
        encargado_devolucion_id: null,
        fecha_inicio: ahora,
        fecha_vencimiento: fechaVencimiento,
        renovado: false,
        fecha_devolucion: null,
        estado: EstadoPrestamo.ACTIVO,
        observaciones:
          dto.observaciones || 'Aprobación formal de solicitud y entrega de equipo',
      });

      await this.prestamoRepository.save(nuevoPrestamo);

      this.logger.log(
        `Solicitud ${id} aprobada por admin ${adminId}. Préstamo formalizado hasta ${fechaVencimiento.toISOString()}`,
      );

      // Despacho no bloqueante de notificación por correo al colaborador
      if (this.notificacionesService && solicitud.usuario?.email) {
        this.notificacionesService
          .enviarConfirmacionAprobacion({
            email: solicitud.usuario.email,
            nombreColaborador:
              solicitud.usuario.nombre_completo || 'Colaborador/a',
            equipo: `${equipo.marca} ${equipo.modelo}`,
            codigoInventario: equipo.codigo_inventario,
            numeroSerie: equipo.numero_serie,
            fechaInicio: ahora,
            fechaVencimiento,
            observaciones: dto.observaciones,
          })
          .catch((err) => {
            this.logger.warn(
              `Error no bloqueante al enviar correo de aprobación para solicitud ${id}: ${err.message}`,
            );
          });
      }
    } else if (dto.estado === EstadoResolucionSolicitud.RECHAZADA) {
      solicitud.estado = EstadoSolicitud.RECHAZADA;
      solicitud.fecha_resolucion = ahora;
      solicitud.resuelto_por = adminId;
      await this.solicitudRepository.save(solicitud);

      this.logger.log(
        `Solicitud ${id} rechazada por admin ${adminId}. Motivo/Observación: ${dto.observaciones || 'Sin observaciones'}`,
      );
    } else {
      throw new BadRequestException(
        `Estado de resolución "${dto.estado}" no es válido. Debe ser "aprobada" o "rechazada"`,
      );
    }

    return this.findById(id);
  }
}
