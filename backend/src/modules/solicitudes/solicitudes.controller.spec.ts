import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import {
  ResolverSolicitudDto,
  EstadoResolucionSolicitud,
} from './dto/resolver-solicitud.dto';
import {
  SolicitudPrestamoEntity,
  EstadoSolicitud,
} from '../../database/entities/solicitud_prestamo.entity';
import { RolUsuario, UsuarioEntity } from '../../database/entities/usuario.entity';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('SolicitudesController', () => {
  let controller: SolicitudesController;
  let serviceMock: any;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockUserColaborador: UsuarioEntity = {
    id: 'usr-colab-1',
    email: 'colaborador@api-ux.com',
    nombre_completo: 'Colaborador Test',
    rol: RolUsuario.COLABORADOR,
    estado: 'activo',
    creado_en: new Date('2026-01-01T10:00:00Z'),
  };

  const mockUserAdmin: UsuarioEntity = {
    id: 'usr-admin-1',
    email: 'admin@api-ux.com',
    nombre_completo: 'Administrador TI',
    rol: RolUsuario.ADMINISTRADOR_TI,
    estado: 'activo',
    creado_en: new Date('2026-01-01T10:00:00Z'),
  };

  const mockSolicitud: SolicitudPrestamoEntity = {
    id: 'sol-uuid-1',
    usuario_id: 'usr-colab-1',
    usuario: mockUserColaborador,
    equipo_id: 'eq-uuid-1',
    equipo: null as any,
    estado: EstadoSolicitud.PENDIENTE,
    motivo: 'Proyecto Apiux',
    fecha_solicitud: new Date('2026-02-01T10:00:00Z'),
    fecha_resolucion: null,
    resuelto_por: null,
    resolutor: null,
  };

  beforeEach(async () => {
    serviceMock = {
      createSolicitud: jest.fn().mockResolvedValue(mockSolicitud),
      findAll: jest.fn().mockResolvedValue({
        data: [mockSolicitud],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
      findById: jest.fn().mockResolvedValue(mockSolicitud),
      resolverSolicitud: jest.fn().mockResolvedValue({
        ...mockSolicitud,
        estado: EstadoSolicitud.APROBADA,
      }),
    };

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesController],
      providers: [
        {
          provide: SolicitudesService,
          useValue: serviceMock,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    controller = module.get<SolicitudesController>(SolicitudesController);
  });

  it('debe estar definido el controlador', () => {
    expect(controller).toBeDefined();
  });

  describe('Metadatos RBAC (TC009)', () => {
    it('debe exigir rol administrador_ti en resolverSolicitud', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.resolverSolicitud,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(RolUsuario.ADMINISTRADOR_TI);
    });

    it('debe exigir rol administrador_ti en aprobarSolicitud', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.aprobarSolicitud,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(RolUsuario.ADMINISTRADOR_TI);
    });

    it('debe exigir rol administrador_ti en rechazarSolicitud', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.rechazarSolicitud,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(RolUsuario.ADMINISTRADOR_TI);
    });
  });

  describe('createSolicitud', () => {
    it('debe delegar en service.createSolicitud con el ID del usuario en sesión', async () => {
      const dto: CreateSolicitudDto = {
        equipo_id: 'eq-uuid-1',
        motivo: 'Proyecto Apiux',
        dias_solicitados: 30,
      };

      const result = await controller.createSolicitud(mockUserColaborador, dto);

      expect(serviceMock.createSolicitud).toHaveBeenCalledWith(
        mockUserColaborador.id,
        dto,
      );
      expect(result).toEqual(mockSolicitud);
    });
  });

  describe('getSolicitudes', () => {
    it('debe delegar en service.findAll con los filtros proporcionados', async () => {
      const result = await controller.getSolicitudes(
        mockUserColaborador,
        EstadoSolicitud.PENDIENTE,
        undefined,
        1,
        10,
      );

      expect(serviceMock.findAll).toHaveBeenCalledWith(mockUserColaborador, {
        estado: EstadoSolicitud.PENDIENTE,
        usuario_id: undefined,
        page: 1,
        limit: 10,
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getSolicitudById', () => {
    it('debe delegar en service.findById con el ID y el usuario en sesión', async () => {
      const result = await controller.getSolicitudById('sol-uuid-1', mockUserColaborador);

      expect(serviceMock.findById).toHaveBeenCalledWith(
        'sol-uuid-1',
        mockUserColaborador,
      );
      expect(result).toEqual(mockSolicitud);
    });
  });

  describe('resolverSolicitud', () => {
    it('debe delegar en service.resolverSolicitud con los datos de resolución', async () => {
      const dto: ResolverSolicitudDto = {
        estado: EstadoResolucionSolicitud.APROBADA,
        dias_prestamo: 30,
        observaciones: 'Entregado',
      };

      const result = await controller.resolverSolicitud(
        'sol-uuid-1',
        mockUserAdmin,
        dto,
      );

      expect(serviceMock.resolverSolicitud).toHaveBeenCalledWith(
        'sol-uuid-1',
        mockUserAdmin.id,
        dto,
      );
      expect(result.estado).toBe(EstadoSolicitud.APROBADA);
    });
  });

  describe('aprobarSolicitud y rechazarSolicitud (conveniencia)', () => {
    it('debe invocar resolverSolicitud con estado aprobada al llamar aprobarSolicitud', async () => {
      await controller.aprobarSolicitud('sol-uuid-1', mockUserAdmin, {
        dias_prestamo: 30,
        observaciones: 'Aprobado OK',
      });

      expect(serviceMock.resolverSolicitud).toHaveBeenCalledWith(
        'sol-uuid-1',
        mockUserAdmin.id,
        {
          estado: EstadoResolucionSolicitud.APROBADA,
          dias_prestamo: 30,
          observaciones: 'Aprobado OK',
        },
      );
    });

    it('debe invocar resolverSolicitud con estado rechazada al llamar rechazarSolicitud', async () => {
      await controller.rechazarSolicitud('sol-uuid-1', mockUserAdmin, {
        observaciones: 'No autorizado',
      });

      expect(serviceMock.resolverSolicitud).toHaveBeenCalledWith(
        'sol-uuid-1',
        mockUserAdmin.id,
        {
          estado: EstadoResolucionSolicitud.RECHAZADA,
          observaciones: 'No autorizado',
        },
      );
    });
  });

  describe('Seguridad y RolesGuard sobre resolverSolicitud (TC009)', () => {
    const createMockContext = (handler: any, user: any): ExecutionContext => {
      return {
        getHandler: () => handler,
        getClass: () => SolicitudesController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    it('debe permitir resolverSolicitud a un usuario administrador_ti', () => {
      const context = createMockContext(controller.resolverSolicitud, mockUserAdmin);
      const canActivate = rolesGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('debe denegar acceso (403 Forbidden) a resolverSolicitud a un usuario colaborador (TC009)', () => {
      const context = createMockContext(
        controller.resolverSolicitud,
        mockUserColaborador,
      );
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debe denegar acceso si la petición no incluye usuario autenticado', () => {
      const context = createMockContext(controller.resolverSolicitud, null);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
