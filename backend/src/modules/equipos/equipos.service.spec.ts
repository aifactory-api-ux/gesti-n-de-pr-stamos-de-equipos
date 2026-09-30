import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { CategoriaEntity } from '../../database/entities/categoria.entity';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { FilterEquipoDto } from './dto/filter-equipo.dto';

describe('EquiposService', () => {
  let service: EquiposService;
  let equipoRepositoryMock: any;
  let categoriaRepositoryMock: any;
  let queryBuilderMock: any;

  const mockCategoria: CategoriaEntity = {
    id: 'cat-uuid-1',
    nombre: 'Notebook',
    descripcion: 'Equipos portátiles para trabajo remoto y presencial',
  };

  const mockEquipo: EquipoEntity = {
    id: 'eq-uuid-1',
    codigo_inventario: 'NB-001',
    categoria_id: 'cat-uuid-1',
    categoria: mockCategoria,
    marca: 'Dell',
    modelo: 'Latitude 5420',
    numero_serie: 'SN-12345678',
    estado: EstadoEquipo.DISPONIBLE,
    creado_en: new Date('2026-01-01T10:00:00Z'),
  };

  beforeEach(async () => {
    queryBuilderMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockEquipo], 1]),
    };

    equipoRepositoryMock = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    categoriaRepositoryMock = {
      find: jest.fn().mockResolvedValue([mockCategoria]),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquiposService,
        {
          provide: getRepositoryToken(EquipoEntity),
          useValue: equipoRepositoryMock,
        },
        {
          provide: getRepositoryToken(CategoriaEntity),
          useValue: categoriaRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<EquiposService>(EquiposService);
  });

  it('debe estar definido el servicio de equipos', () => {
    expect(service).toBeDefined();
  });

  describe('findAllCategorias', () => {
    it('debe retornar la lista de categorías ordenadas alfabéticamente por nombre', async () => {
      const mockCategorias = [
        mockCategoria,
        { id: 'cat-uuid-2', nombre: 'Monitor', descripcion: 'Monitores 24 y 27 pulgadas' },
      ];
      categoriaRepositoryMock.find.mockResolvedValue(mockCategorias);

      const result = await service.findAllCategorias();

      expect(categoriaRepositoryMock.find).toHaveBeenCalledWith({
        order: { nombre: 'ASC' },
      });
      expect(result).toEqual(mockCategorias);
      expect(result).toHaveLength(2);
    });
  });

  describe('findAllEquipos', () => {
    it('debe retornar equipos paginados con valores por defecto (page=1, limit=10)', async () => {
      const filters: FilterEquipoDto = {};

      const result = await service.findAllEquipos(filters);

      expect(equipoRepositoryMock.createQueryBuilder).toHaveBeenCalledWith('equipo');
      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'equipo.categoria',
        'categoria',
      );
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith('equipo.creado_en', 'DESC');
      expect(result).toEqual({
        data: [mockEquipo],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('debe aplicar filtro de búsqueda insensible a mayúsculas si se provee search', async () => {
      const filters: FilterEquipoDto = { search: 'Dell' };

      await service.findAllEquipos(filters);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        '(equipo.codigo_inventario ILIKE :search OR equipo.marca ILIKE :search OR equipo.modelo ILIKE :search OR equipo.numero_serie ILIKE :search)',
        { search: '%Dell%' },
      );
    });

    it('debe filtrar por categoria_id si se provee', async () => {
      const filters: FilterEquipoDto = { categoria_id: 'cat-uuid-1' };

      await service.findAllEquipos(filters);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'equipo.categoria_id = :categoria_id',
        { categoria_id: 'cat-uuid-1' },
      );
    });

    it('debe filtrar por estado de disponibilidad si se provee', async () => {
      const filters: FilterEquipoDto = { estado: EstadoEquipo.DISPONIBLE };

      await service.findAllEquipos(filters);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'equipo.estado = :estado',
        { estado: EstadoEquipo.DISPONIBLE },
      );
    });

    it('debe calcular correctamente totalPages para múltiples páginas', async () => {
      queryBuilderMock.getManyAndCount.mockResolvedValue([[mockEquipo, mockEquipo], 25]);
      const filters: FilterEquipoDto = { page: 2, limit: 10 };

      const result = await service.findAllEquipos(filters);

      expect(queryBuilderMock.skip).toHaveBeenCalledWith(10);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
    });

    it('debe normalizar valores inválidos de paginación (page < 1 y limit > 100)', async () => {
      const filters: FilterEquipoDto = { page: -5, limit: 500 };

      const result = await service.findAllEquipos(filters);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(100);
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(100);
    });
  });

  describe('findEquipoById', () => {
    it('debe retornar el equipo con su categoría si existe', async () => {
      equipoRepositoryMock.findOne.mockResolvedValue(mockEquipo);

      const result = await service.findEquipoById('eq-uuid-1');

      expect(equipoRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: 'eq-uuid-1' },
        relations: ['categoria'],
      });
      expect(result).toEqual(mockEquipo);
    });

    it('debe lanzar NotFoundException si el equipo no existe', async () => {
      equipoRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.findEquipoById('no-existe')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createEquipo', () => {
    const createDto: CreateEquipoDto = {
      codigo_inventario: 'NB-042',
      categoria_id: 'cat-uuid-1',
      marca: 'Dell',
      modelo: 'Latitude 5420',
      numero_serie: 'SN-987654321',
      estado: EstadoEquipo.DISPONIBLE,
    };

    it('debe crear y retornar un equipo exitosamente', async () => {
      categoriaRepositoryMock.findOne.mockResolvedValue(mockCategoria);
      equipoRepositoryMock.findOne
        .mockResolvedValueOnce(null) // Unicidad codigo_inventario
        .mockResolvedValueOnce(null) // Unicidad numero_serie
        .mockResolvedValueOnce({ ...mockEquipo, ...createDto }); // Recarga final

      equipoRepositoryMock.create.mockReturnValue({
        ...createDto,
        id: 'eq-uuid-new',
      });
      equipoRepositoryMock.save.mockResolvedValue({
        ...createDto,
        id: 'eq-uuid-new',
      });

      const result = await service.createEquipo(createDto);

      expect(categoriaRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: createDto.categoria_id },
      });
      expect(equipoRepositoryMock.create).toHaveBeenCalledWith({
        codigo_inventario: 'NB-042',
        categoria_id: 'cat-uuid-1',
        marca: 'Dell',
        modelo: 'Latitude 5420',
        numero_serie: 'SN-987654321',
        estado: EstadoEquipo.DISPONIBLE,
      });
      expect(equipoRepositoryMock.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('debe asignar estado DISPONIBLE por defecto si no es especificado', async () => {
      const dtoSinEstado: CreateEquipoDto = {
        codigo_inventario: 'NB-099',
        categoria_id: 'cat-uuid-1',
        marca: 'Lenovo',
        modelo: 'ThinkPad T14',
        numero_serie: 'SN-LNV-999',
      };

      categoriaRepositoryMock.findOne.mockResolvedValue(mockCategoria);
      equipoRepositoryMock.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockEquipo,
          ...dtoSinEstado,
          estado: EstadoEquipo.DISPONIBLE,
        });

      equipoRepositoryMock.create.mockReturnValue({
        ...dtoSinEstado,
        estado: EstadoEquipo.DISPONIBLE,
      });
      equipoRepositoryMock.save.mockResolvedValue({
        ...dtoSinEstado,
        id: 'new-id',
        estado: EstadoEquipo.DISPONIBLE,
      });

      await service.createEquipo(dtoSinEstado);

      expect(equipoRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoEquipo.DISPONIBLE,
        }),
      );
    });

    it('debe lanzar NotFoundException si la categoría no existe', async () => {
      categoriaRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createEquipo(createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(equipoRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si el codigo_inventario ya existe', async () => {
      categoriaRepositoryMock.findOne.mockResolvedValue(mockCategoria);
      equipoRepositoryMock.findOne.mockResolvedValueOnce(mockEquipo);

      await expect(service.createEquipo(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(equipoRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si el numero_serie ya existe', async () => {
      categoriaRepositoryMock.findOne.mockResolvedValue(mockCategoria);
      equipoRepositoryMock.findOne
        .mockResolvedValueOnce(null) // Código único
        .mockResolvedValueOnce(mockEquipo); // Serie duplicada

      await expect(service.createEquipo(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(equipoRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si la base de datos retorna error de unicidad 23505', async () => {
      categoriaRepositoryMock.findOne.mockResolvedValue(mockCategoria);
      equipoRepositoryMock.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      equipoRepositoryMock.create.mockReturnValue(createDto);
      equipoRepositoryMock.save.mockRejectedValue({ code: '23505' });

      await expect(service.createEquipo(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
