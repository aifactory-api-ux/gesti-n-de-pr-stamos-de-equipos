import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';

export interface PaginatedAuditoriaResponse {
  data: AuditoriaEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Servicio de auditoría inmutable institucional para Apiux.
 *
 * Principios y restricciones de seguridad:
 * - Bitácora inmutable: Este servicio provee exclusivamente métodos de inserción (append-only)
 *   y consulta (read-only).
 * - Ausencia estricta de métodos de actualización (UPDATE) o eliminación (DELETE)
 *   para garantizar la integridad forense y cumplimiento de retención legal mínima de 5 años.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(AuditoriaEntity)
    private readonly auditoriaRepository: Repository<AuditoriaEntity>,
  ) {}

  /**
   * Obtiene los registros de auditoría filtrados con paginación ordenada cronológicamente
   * de forma descendente (los eventos más recientes primero).
   *
   * @param query Filtros de búsqueda (tabla/entidad, registro_id, usuario_id, accion, rango de fechas y paginación)
   * @returns Listado paginado de eventos de auditoría y metadatos de paginación
   */
  async findAll(query: QueryAuditoriaDto): Promise<PaginatedAuditoriaResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.usuario', 'usuario');

    // Filtro por tabla afectada o entidad (compatibilidad con ambos nombres de parámetro)
    const tablaAfectada = query.tabla_afectada || query.entidad;
    if (tablaAfectada && tablaAfectada.trim() !== '') {
      qb.andWhere('LOWER(auditoria.tabla_afectada) = LOWER(:tabla)', {
        tabla: tablaAfectada.trim(),
      });
    }

    // Filtro por ID del registro auditado (UUID)
    if (query.registro_id && query.registro_id.trim() !== '') {
      qb.andWhere('auditoria.registro_id = :registro_id', {
        registro_id: query.registro_id.trim(),
      });
    }

    // Filtro por ID del usuario ejecutor (UUID)
    if (query.usuario_id && query.usuario_id.trim() !== '') {
      qb.andWhere('auditoria.usuario_id = :usuario_id', {
        usuario_id: query.usuario_id.trim(),
      });
    }

    // Filtro por tipo o nombre de acción
    if (query.accion && query.accion.trim() !== '') {
      qb.andWhere('LOWER(auditoria.accion) LIKE LOWER(:accion)', {
        accion: `%${query.accion.trim()}%`,
      });
    }

    // Filtro por rango de fechas (fecha_desde y fecha_hasta)
    if (query.fecha_desde) {
      qb.andWhere('auditoria.fecha_evento >= :fecha_desde', {
        fecha_desde: new Date(query.fecha_desde),
      });
    }

    if (query.fecha_hasta) {
      qb.andWhere('auditoria.fecha_evento <= :fecha_hasta', {
        fecha_hasta: new Date(query.fecha_hasta),
      });
    }

    qb.orderBy('auditoria.fecha_evento', 'DESC');
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
   * Consulta un registro específico de auditoría por su identificador único (UUID).
   *
   * @param id Identificador UUID del evento de auditoría
   * @returns Entidad de auditoría con la relación de usuario cargada
   */
  async findById(id: string): Promise<AuditoriaEntity> {
    const registro = await this.auditoriaRepository.findOne({
      where: { id },
      relations: ['usuario'],
    });

    if (!registro) {
      throw new NotFoundException(`Registro de auditoría con ID "${id}" no encontrado`);
    }

    return registro;
  }

  /**
   * Registra un nuevo evento inmutable en la bitácora de auditoría.
   * Utilizado internamente por interceptores, servicios y workers para persistir
   * trazabilidad forense de mutaciones y notificaciones de negocio.
   *
   * @param datos Propiedades del evento a registrar
   * @returns Entidad de auditoría guardada
   */
  async registrarEvento(datos: Partial<AuditoriaEntity>): Promise<AuditoriaEntity> {
    const nuevoRegistro = this.auditoriaRepository.create({
      ...datos,
      fecha_evento: datos.fecha_evento || new Date(),
    });

    const guardado = await this.auditoriaRepository.save(nuevoRegistro);
    this.logger.debug(
      `Evento de auditoría registrado [${guardado.accion}] en tabla [${guardado.tabla_afectada}] ID [${guardado.registro_id}]`,
    );
    return guardado;
  }
}
