import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { RolUsuario } from '../../database/entities/usuario.entity';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('AuditoriaController', () => {
  let controller: AuditoriaController;
  let serviceMock: any;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

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
      rol: RolUsuario.ADMINISTRADOR_TI,
      activo: true,
      creado_en: new Date(),
      actualizado_en: new Date(),
    } as any,
    direccion_ip: '192.168.1.10',
    fecha_evento: new Date('2026-03-15T10:00:00Z'),
  };

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn().mockResolvedValue({
        data: [mockAuditoria],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
      findById: jest.fn().mockResolvedValue(mockAuditoria),
    };

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [
        {
          provide: AuditoriaService,
          useValue: serviceMock,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    controller = module.get<AuditoriaController>(AuditoriaController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido el controlador de auditoría', () => {
    expect(controller).toBeDefined();
  });

  describe('Metadatos RBAC y Restricción a administrador_ti', () => {
    it('debe requerir rol administrador_ti a nivel de clase del controlador', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        AuditoriaController,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(RolUsuario.ADMINISTRADOR_TI);
    });

    it('debe permitir acceso al administrador_ti a través de RolesGuard', () => {
      const mockExecutionContext = {
        getHandler: () => controller.findAll,
        getClass: () => AuditoriaController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'usr-admin-1',
              rol: RolUsuario.ADMINISTRADOR_TI,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const canActivate = rolesGuard.canActivate(mockExecutionContext);
      expect(canActivate).toBe(true);
    });

    it('debe denegar acceso al colaborador a través de RolesGuard lanzando ForbiddenException', () => {
      const mockExecutionContext = {
        getHandler: () => controller.findAll,
        getClass: () => AuditoriaController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'usr-colab-1',
              rol: RolUsuario.COLABORADOR,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockExecutionContext)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('GET /api/v1/auditoria (findAll)', () => {
    it('debe llamar al servicio findAll con los parámetros provistos y retornar respuesta paginada', async () => {
      const query: QueryAuditoriaDto = {
        tabla_afectada: 'prestamos',
        page: 1,
        limit: 10,
      };

      const result = await controller.findAll(query);

      expect(serviceMock.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual({
        data: [mockAuditoria],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
    });
  });

  describe('GET /api/v1/auditoria/:id (findById)', () => {
    it('debe llamar al servicio findById con el UUID provisto', async () => {
      const result = await controller.findById('aud-uuid-1');

      expect(serviceMock.findById).toHaveBeenCalledWith('aud-uuid-1');
      expect(result).toEqual(mockAuditoria);
    });
  });

  describe('Inmutabilidad y ausencia de endpoints de modificación/eliminación', () => {
    it('no debe exponer métodos POST, PUT, PATCH o DELETE en el controlador', () => {
      const proto = Object.getPrototypeOf(controller);
      const methods = Object.getOwnPropertyNames(proto);

      expect(methods).toContain('findAll');
      expect(methods).toContain('findById');
      expect(methods).not.toContain('create');
      expect(methods).not.toContain('update');
      expect(methods).not.toContain('delete');
      expect(methods).not.toContain('remove');
      expect(methods).not.toContain('patch');
    });
  });
});
