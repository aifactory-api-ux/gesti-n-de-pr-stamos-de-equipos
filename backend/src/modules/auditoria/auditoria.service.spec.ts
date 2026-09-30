import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let auditoriaRepositoryMock: any;
  let queryBuilderMock: any;

  const mockAuditoria: AuditoriaEntity = {
    id: 'aud-uuid-1',
    tabla_afectada: 'prestamos',
    registro_id: 'prest-uuid-1',
    accion: 'CREAR',
    datos_anteriores: null,
    datos_nuevos: { id: 'prest-uuid-1', estado: 'activo' },
    usuario_id: 'usr-admin-1',
    usuario: {
      id: 'usr-admin-1',
      azure_id: 'az-admin-1',
      nombre: 'Admin TI',
      correo: 'admin@apiux.com',
      rol: 'administrador_ti' as any,
      activo: true,
      creado_en: new Date(),
      actualizado_en: new Date(),
    } as any,
    direccion_ip: '192.168.1.10',
    fecha_evento: new Date('2026-03-15T10:00:00Z'),
  };

  beforeEach(async () => {
    queryBuilderMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockAuditoria], 1]),
    };

    auditoriaRepositoryMock = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      findOne: jest.fn().mockResolvedValue(mockAuditoria),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({
        id: 'new-aud-uuid',
        ...entity,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaService,
        {
          provide: getRepositoryToken(AuditoriaEntity),
          useValue: auditoriaRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<AuditoriaService>(AuditoriaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('debe retornar registros de auditoría paginados con valores por defecto', async () => {
      const query: QueryAuditoriaDto = {};
      const result = await service.findAll(query);

      expect(auditoriaRepositoryMock.createQueryBuilder).toHaveBeenCalledWith('auditoria');
      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('auditoria.usuario', 'usuario');
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith('auditoria.fecha_evento', 'DESC');
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [mockAuditoria],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('debe aplicar filtro por tabla_afectada', async () => {
      const query: QueryAuditoriaDto = { tabla_afectada: 'prestamos' };
      await service.findAll(query);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'LOWER(auditoria.tabla_afectada) = LOWER(:tabla)',
        { tabla: 'prestamos' },
      );
    });

    it('debe aplicar filtro por alias entidad si tabla_afectada no se provee', async () => {
      const query: QueryAuditoriaDto = { entidad: 'equipos' };
      await service.findAll(query);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'LOWER(auditoria.tabla_afectada) = LOWER(:tabla)',
        { tabla: 'equipos' },
      );
    });

    it('debe aplicar filtro por registro_id', async () => {
      const query: QueryAuditoriaDto = { registro_id: 'prest-uuid-1' };
      await service.findAll(query);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'auditoria.registro_id = :registro_id',
        { registro_id: 'prest-uuid-1' },
      );
    });

    it('debe aplicar filtro por usuario_id', async () => {
      const query: QueryAuditoriaDto = { usuario_id: 'usr-admin-1' };
      await service.findAll(query);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'auditoria.usuario_id = :usuario_id',
        { usuario_id: 'usr-admin-1' },
      );
    });

    it('debe aplicar filtro por accion', async () => {
      const query: QueryAuditoriaDto = { accion: 'CREAR' };
      await service.findAll(query);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'LOWER(auditoria.accion) LIKE LOWER(:accion)',
        { accion: '%CREAR%' },
      );
    });

    it('debe aplicar filtros de rango de fechas fecha_desde y fecha_hasta', async () => {
      const query: QueryAuditoriaDto = {
        fecha_desde: '2026-03-01T00:00:00Z',
        fecha_hasta: '2026-03-31T23:59:59Z',
      };
      await service.findAll(query);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'auditoria.fecha_evento >= :fecha_desde',
        { fecha_desde: new Date('2026-03-01T00:00:00Z') },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'auditoria.fecha_evento <= :fecha_hasta',
        { fecha_hasta: new Date('2026-03-31T23:59:59Z') },
      );
    });

    it('debe manejar correctamente la paginación con valores personalizados', async () => {
      queryBuilderMock.getManyAndCount.mockResolvedValue([[mockAuditoria], 45]);
      const query: QueryAuditoriaDto = { page: 3, limit: 15 };
      const result = await service.findAll(query);

      expect(queryBuilderMock.skip).toHaveBeenCalledWith(30);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(15);
      expect(result.meta).toEqual({
        total: 45,
        page: 3,
        limit: 15,
        totalPages: 3,
      });
    });
  });

  describe('findById', () => {
    it('debe retornar el registro de auditoría si existe', async () => {
      const result = await service.findById('aud-uuid-1');
      expect(auditoriaRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: 'aud-uuid-1' },
        relations: ['usuario'],
      });
      expect(result).toEqual(mockAuditoria);
    });

    it('debe lanzar NotFoundException si el registro no existe', async () => {
      auditoriaRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('registrarEvento', () => {
    it('debe persistir un registro de auditoría de forma inmutable', async () => {
      const payload = {
        tabla_afectada: 'prestamos',
        registro_id: 'prest-uuid-2',
        accion: 'APROBAR',
        datos_nuevos: { estado: 'activo' },
        usuario_id: 'usr-admin-1',
        direccion_ip: '127.0.0.1',
      };

      const result = await service.registrarEvento(payload);

      expect(auditoriaRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining(payload),
      );
      expect(auditoriaRepositoryMock.save).toHaveBeenCalled();
      expect(result.id).toBe('new-aud-uuid');
      expect(result.tabla_afectada).toBe('prestamos');
    });
  });

  describe('Inmutabilidad del registro de auditoría', () => {
    it('no debe exponer métodos de modificación ni eliminación en el servicio', () => {
      const serviceAny = service as any;
      expect(serviceAny.update).toBeUndefined();
      expect(serviceAny.delete).toBeUndefined();
      expect(serviceAny.remove).toBeUndefined();
      expect(serviceAny.patch).toBeUndefined();
    });
  });
});
