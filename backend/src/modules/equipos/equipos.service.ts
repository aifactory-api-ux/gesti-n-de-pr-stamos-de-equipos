import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { CategoriaEntity } from '../../database/entities/categoria.entity';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { FilterEquipoDto } from './dto/filter-equipo.dto';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Servicio encargado de la lógica de negocio para la gestión de equipos tecnológicos
 * y categorías en el inventario de Apiux.
 */
@Injectable()
export class EquiposService {
  private readonly logger = new Logger(EquiposService.name);

  constructor(
    @InjectRepository(EquipoEntity)
    private readonly equipoRepository: Repository<EquipoEntity>,
    @InjectRepository(CategoriaEntity)
    private readonly categoriaRepository: Repository<CategoriaEntity>,
  ) {}

  /**
   * Obtiene la lista completa de categorías de equipos ordenadas alfabéticamente por nombre.
   */
  async findAllCategorias(): Promise<CategoriaEntity[]> {
    return this.categoriaRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene la lista paginada de equipos según los filtros y términos de búsqueda proporcionados.
   *
   * @param filters Filtros de búsqueda (search, categoria_id, estado, page, limit)
   */
  async findAllEquipos(filters: FilterEquipoDto): Promise<PaginatedResponse<EquipoEntity>> {
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.equipoRepository.createQueryBuilder('equipo')
      .leftJoinAndSelect('equipo.categoria', 'categoria');

    if (filters?.search && filters.search.trim() !== '') {
      const searchTerm = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(equipo.codigo_inventario ILIKE :search OR equipo.marca ILIKE :search OR equipo.modelo ILIKE :search OR equipo.numero_serie ILIKE :search)',
        { search: searchTerm },
      );
    }

    if (filters?.categoria_id) {
      qb.andWhere('equipo.categoria_id = :categoria_id', {
        categoria_id: filters.categoria_id,
      });
    }

    if (filters?.estado) {
      qb.andWhere('equipo.estado = :estado', {
        estado: filters.estado,
      });
    }

    qb.orderBy('equipo.creado_en', 'DESC');
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
   * Busca un equipo tecnológico por su identificador único UUID.
   *
   * @param id Identificador UUID del equipo
   * @throws NotFoundException Si el equipo no existe en la base de datos
   */
  async findEquipoById(id: string): Promise<EquipoEntity> {
    const equipo = await this.equipoRepository.findOne({
      where: { id },
      relations: ['categoria'],
    });

    if (!equipo) {
      throw new NotFoundException(`Equipo con ID "${id}" no encontrado`);
    }

    return equipo;
  }

  /**
   * Registra un nuevo equipo en el inventario. Restringido a usuarios administradores de TI.
   * Valida existencia previa de la categoría y unicidad de código de inventario y número de serie.
   *
   * @param createDto Datos de creación del equipo
   * @throws NotFoundException Si la categoría especificada no existe
   * @throws ConflictException Si el código de inventario o número de serie ya está en uso
   */
  async createEquipo(createDto: CreateEquipoDto): Promise<EquipoEntity> {
    const categoria = await this.categoriaRepository.findOne({
      where: { id: createDto.categoria_id },
    });

    if (!categoria) {
      throw new NotFoundException(
        `Categoría con ID "${createDto.categoria_id}" no encontrada`,
      );
    }

    const existingCodigo = await this.equipoRepository.findOne({
      where: { codigo_inventario: createDto.codigo_inventario.trim() },
    });

    if (existingCodigo) {
      throw new ConflictException(
        `Ya existe un equipo con el código de inventario "${createDto.codigo_inventario}"`,
      );
    }

    const existingSerie = await this.equipoRepository.findOne({
      where: { numero_serie: createDto.numero_serie.trim() },
    });

    if (existingSerie) {
      throw new ConflictException(
        `Ya existe un equipo con el número de serie "${createDto.numero_serie}"`,
      );
    }

    const nuevoEquipo = this.equipoRepository.create({
      codigo_inventario: createDto.codigo_inventario.trim(),
      categoria_id: createDto.categoria_id,
      marca: createDto.marca.trim(),
      modelo: createDto.modelo.trim(),
      numero_serie: createDto.numero_serie.trim(),
      estado: createDto.estado || EstadoEquipo.DISPONIBLE,
    });

    try {
      const guardado = await this.equipoRepository.save(nuevoEquipo);
      return await this.findEquipoById(guardado.id);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException(
          'Conflicto de clave única: el código de inventario o número de serie ya existe',
        );
      }
      throw error;
    }
  }
}
