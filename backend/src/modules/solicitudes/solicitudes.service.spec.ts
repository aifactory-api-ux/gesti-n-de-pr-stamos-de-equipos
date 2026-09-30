import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';
import {
  SolicitudPrestamoEntity,
  EstadoSolicitud,
} from '../../database/entities/solicitud_prestamo.entity';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import { RolUsuario, UsuarioEntity } from '../../database/entities/usuario.entity';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import {
  ResolverSolicitudDto,
  EstadoResolucionSolicitud,
} from './dto/resolver-solicitud.dto';

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let solicitudRepositoryMock: any;
  let equipoRepositoryMock: any;
  let prestamoRepositoryMock: any;
  let queryBuilderMock: any;

  const mockUserColaborador: UsuarioEntity = {
    id: 'usr-colab-1',
    email: 'colaborador@api-ux.com',
    nombre_completo: 'Juan Pérez',
    rol: RolUsuario.COLABORADOR,
    estado: 'activo',
    creado_en: new Date('2026-01-01T10:00:00Z'),
  };

  const mockUserAdmin: UsuarioEntity = {
    id: 'usr-admin-1',
    email: 'admin@api-ux.com',
    nombre_completo: 'Admin TI',
    rol: RolUsuario.ADMINISTRADOR_TI,
    estado: 'activo',
    creado_en: new Date('2026-01-01T10:00:00Z'),
  };

  const mockEquipo: EquipoEntity = {
    id: 'eq-uuid-1',
    codigo_inventario: 'NB-001',
    categoria_id: 'cat-uuid-1',
    categoria: { id: 'cat-uuid-1', nombre: 'Notebook', descripcion: 'Laptops' },
    marca: 'Lenovo',
    modelo: 'ThinkPad T14',
    numero_serie: 'SN-00112233',
    estado: EstadoEquipo.DISPONIBLE,
    creado_en: new Date('2026-01-01T10:00:00Z'),
  };

  const mockSolicitud: SolicitudPrestamoEntity = {
    id: 'sol-uuid-1',
    usuario_id: 'usr-colab-1',
    usuario: mockUserColaborador,
    equipo_id: 'eq-uuid-1',
    equipo: mockEquipo,
    estado: EstadoSolicitud.PENDIENTE,
    motivo: 'Desarrollo en proyecto bancario Apiux',
    fecha_solicitud: new Date('2026-02-01T10:00:00Z'),
    fecha_resolucion: null,
    resuelto_por: null,
    resolutor: null,
  };

  beforeEach(async () => {
    queryBuilderMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockSolicitud], 1]),
    };

    solicitudRepositoryMock = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    equipoRepositoryMock = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    prestamoRepositoryMock = {
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: getRepositoryToken(SolicitudPrestamoEntity),
          useValue: solicitudRepositoryMock,
        },
        {
          provide: getRepositoryToken(EquipoEntity),
          useValue: equipoRepositoryMock,
        },
        {
          provide: getRepositoryToken(PrestamoEntity),
          useValue: prestamoRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
  });

  it('debe estar definido el servicio', () => {
    expect(service).toBeDefined();
  });

  describe('createSolicitud (TC002, TC007)', () => {
    const createDto: CreateSolicitudDto = {
      equipo_id: 'eq-uuid-1',
      motivo: 'Proyecto de desarrollo Apiux',
      dias_solicitados: 30,
    };

    it('debe crear una solicitud en estado pendiente exitosamente (TC002)', async () => {
      // Cupo disponible (< 2 activos)
      prestamoRepositoryMock.count.mockResolvedValue(0);
      // Equipo existe y disponible
      equipoRepositoryMock.findOne.mockResolvedValue(mockEquipo);
      // No existe solicitud pendiente previa
      solicitudRepositoryMock.findOne
        .mockResolvedValueOnce(null) // Duplicado check
        .mockResolvedValueOnce(mockSolicitud); // findById final
      solicitudRepositoryMock.create.mockReturnValue(mockSolicitud);
      solicitudRepositoryMock.save.mockResolvedValue(mockSolicitud);

      const result = await service.createSolicitud('usr-colab-1', createDto);

      expect(prestamoRepositoryMock.count).toHaveBeenCalledWith({
        where: [
          { usuario_id: 'usr-colab-1', estado: EstadoPrestamo.ACTIVO },
          { usuario_id: 'usr-colab-1', estado: EstadoPrestamo.VENCIDO },
        ],
      });
      expect(equipoRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: createDto.equipo_id },
        relations: ['categoria'],
      });
      expect(solicitudRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario_id: 'usr-colab-1',
          equipo_id: createDto.equipo_id,
          estado: EstadoSolicitud.PENDIENTE,
          motivo: createDto.motivo,
        }),
      );
      expect(solicitudRepositoryMock.save).toHaveBeenCalled();
      expect(result).toEqual(mockSolicitud);
    });

    it('debe lanzar BadRequestException si el colaborador ya tiene 2 préstamos activos', async () => {
      prestamoRepositoryMock.count.mockResolvedValue(2);

      await expect(service.createSolicitud('usr-colab-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(equipoRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(solicitudRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el equipo no existe en el catálogo', async () => {
      prestamoRepositoryMock.count.mockResolvedValue(1);
      equipoRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createSolicitud('usr-colab-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(solicitudRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si el equipo solicitado no está disponible (TC007)', async () => {
      prestamoRepositoryMock.count.mockResolvedValue(0);
      equipoRepositoryMock.findOne.mockResolvedValue({
        ...mockEquipo,
        estado: EstadoEquipo.PRESTADO,
      });

      await expect(service.createSolicitud('usr-colab-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(solicitudRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si el colaborador ya tiene una solicitud pendiente para el mismo equipo', async () => {
      prestamoRepositoryMock.count.mockResolvedValue(0);
      equipoRepositoryMock.findOne.mockResolvedValue(mockEquipo);
      solicitudRepositoryMock.findOne.mockResolvedValue(mockSolicitud);

      await expect(service.createSolicitud('usr-colab-1', createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(solicitudRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe restringir la consulta a las solicitudes del usuario si es colaborador', async () => {
      await service.findAll(mockUserColaborador, { page: 1, limit: 10 });

      expect(solicitudRepositoryMock.createQueryBuilder).toHaveBeenCalledWith('solicitud');
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'solicitud.usuario_id = :currentUserId',
        { currentUserId: mockUserColaborador.id },
      );
    });

    it('debe permitir consultar todas las solicitudes si es administrador_ti', async () => {
      await service.findAll(mockUserAdmin, { page: 1, limit: 10 });

      expect(queryBuilderMock.andWhere).not.toHaveBeenCalledWith(
        'solicitud.usuario_id = :currentUserId',
        expect.anything(),
      );
    });

    it('debe aplicar filtro por estado si se especifica', async () => {
      await service.findAll(mockUserAdmin, { estado: EstadoSolicitud.PENDIENTE });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'solicitud.estado = :estado',
        { estado: EstadoSolicitud.PENDIENTE },
      );
    });
  });

  describe('findById', () => {
    it('debe retornar la solicitud si existe y pertenece al colaborador', async () => {
      solicitudRepositoryMock.findOne.mockResolvedValue(mockSolicitud);

      const result = await service.findById('sol-uuid-1', mockUserColaborador);

      expect(result).toEqual(mockSolicitud);
    });

    it('debe lanzar ForbiddenException si un colaborador intenta consultar una solicitud de otro usuario', async () => {
      solicitudRepositoryMock.findOne.mockResolvedValue({
        ...mockSolicitud,
        usuario_id: 'otro-usuario-uuid',
      });

      await expect(
        service.findById('sol-uuid-1', mockUserColaborador),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir a un administrador_ti consultar solicitudes de cualquier usuario', async () => {
      solicitudRepositoryMock.findOne.mockResolvedValue({
        ...mockSolicitud,
        usuario_id: 'otro-usuario-uuid',
      });

      const result = await service.findById('sol-uuid-1', mockUserAdmin);

      expect(result).toBeDefined();
    });

    it('debe lanzar NotFoundException si la solicitud no existe', async () => {
      solicitudRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.findById('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolverSolicitud (TC003)', () => {
    const dtoAprobar: ResolverSolicitudDto = {
      estado: EstadoResolucionSolicitud.APROBADA,
      dias_prestamo: 30,
      observaciones: 'Entregado conforme',
    };

    const dtoRechazar: ResolverSolicitudDto = {
      estado: EstadoResolucionSolicitud.RECHAZADA,
      observaciones: 'Equipo reservado para mantención',
    };

    it('debe aprobar la solicitud, actualizar el equipo a prestado y generar un préstamo activo (TC003)', async () => {
      solicitudRepositoryMock.findOne
        .mockResolvedValueOnce({ ...mockSolicitud }) // Carga inicial
        .mockResolvedValueOnce({
          ...mockSolicitud,
          estado: EstadoSolicitud.APROBADA,
          resuelto_por: 'usr-admin-1',
        }); // findById final

      equipoRepositoryMock.findOne.mockResolvedValue({ ...mockEquipo });
      prestamoRepositoryMock.count.mockResolvedValue(0);
      solicitudRepositoryMock.save.mockResolvedValue(mockSolicitud);
      equipoRepositoryMock.save.mockResolvedValue(mockEquipo);
      prestamoRepositoryMock.create.mockReturnValue({
        id: 'new-prestamo-uuid',
        solicitud_id: mockSolicitud.id,
        usuario_id: mockSolicitud.usuario_id,
        equipo_id: mockSolicitud.equipo_id,
        encargado_entrega_id: 'usr-admin-1',
        estado: EstadoPrestamo.ACTIVO,
      });
      prestamoRepositoryMock.save.mockResolvedValue({});

      const result = await service.resolverSolicitud('sol-uuid-1', 'usr-admin-1', dtoAprobar);

      expect(solicitudRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoSolicitud.APROBADA,
          resuelto_por: 'usr-admin-1',
        }),
      );
      expect(equipoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoEquipo.PRESTADO,
        }),
      );
      expect(prestamoRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitud_id: mockSolicitud.id,
          usuario_id: mockSolicitud.usuario_id,
          equipo_id: mockSolicitud.equipo_id,
          encargado_entrega_id: 'usr-admin-1',
          estado: EstadoPrestamo.ACTIVO,
          renovado: false,
        }),
      );
      expect(prestamoRepositoryMock.save).toHaveBeenCalled();
      expect(result.estado).toBe(EstadoSolicitud.APROBADA);
    });

    it('debe rechazar la solicitud sin alterar el equipo ni crear préstamo', async () => {
      solicitudRepositoryMock.findOne
        .mockResolvedValueOnce({ ...mockSolicitud })
        .mockResolvedValueOnce({
          ...mockSolicitud,
          estado: EstadoSolicitud.RECHAZADA,
          resuelto_por: 'usr-admin-1',
        });
      solicitudRepositoryMock.save.mockResolvedValue(mockSolicitud);

      const result = await service.resolverSolicitud('sol-uuid-1', 'usr-admin-1', dtoRechazar);

      expect(solicitudRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoSolicitud.RECHAZADA,
          resuelto_por: 'usr-admin-1',
        }),
      );
      expect(equipoRepositoryMock.save).not.toHaveBeenCalled();
      expect(prestamoRepositoryMock.create).not.toHaveBeenCalled();
      expect(result.estado).toBe(EstadoSolicitud.RECHAZADA);
    });

    it('debe lanzar BadRequestException si la solicitud ya no está en estado pendiente', async () => {
      solicitudRepositoryMock.findOne.mockResolvedValue({
        ...mockSolicitud,
        estado: EstadoSolicitud.APROBADA,
      });

      await expect(
        service.resolverSolicitud('sol-uuid-1', 'usr-admin-1', dtoAprobar),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si al momento de aprobar el equipo ya no está disponible', async () => {
      solicitudRepositoryMock.findOne.mockResolvedValue({ ...mockSolicitud });
      equipoRepositoryMock.findOne.mockResolvedValue({
        ...mockEquipo,
        estado: EstadoEquipo.PRESTADO,
      });

      await expect(
        service.resolverSolicitud('sol-uuid-1', 'usr-admin-1', dtoAprobar),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si al aprobar el colaborador ya alcanzó 2 préstamos activos', async () => {
      solicitudRepositoryMock.findOne.mockResolvedValue({ ...mockSolicitud });
      equipoRepositoryMock.findOne.mockResolvedValue({ ...mockEquipo });
      prestamoRepositoryMock.count.mockResolvedValue(2);

      await expect(
        service.resolverSolicitud('sol-uuid-1', 'usr-admin-1', dtoAprobar),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
