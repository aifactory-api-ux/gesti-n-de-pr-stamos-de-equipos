import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrestamosController } from './prestamos.controller';
import { PrestamosService } from './prestamos.service';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { RenovarPrestamoDto } from './dto/renovar-prestamo.dto';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import { EstadoEquipo } from '../../database/entities/equipo.entity';
import { RolUsuario, UsuarioEntity } from '../../database/entities/usuario.entity';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('PrestamosController', () => {
  let controller: PrestamosController;
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

  const mockPrestamo: PrestamoEntity = {
    id: 'prest-uuid-1',
    solicitud_id: 'sol-uuid-1',
    solicitud: null as any,
    usuario_id: 'usr-colab-1',
    usuario: mockUserColaborador,
    equipo_id: 'eq-uuid-1',
    equipo: {
      id: 'eq-uuid-1',
      codigo_inventario: 'NB-001',
      categoria_id: 'cat-1',
      categoria: null as any,
      marca: 'Dell',
      modelo: 'Latitude',
      numero_serie: 'SN-001',
      estado: EstadoEquipo.PRESTADO,
      creado_en: new Date('2026-01-01T10:00:00Z'),
    },
    encargado_entrega_id: 'usr-admin-1',
    encargado_entrega: mockUserAdmin,
    encargado_devolucion_id: null,
    encargado_devolucion: null,
    fecha_inicio: new Date('2026-02-01T10:00:00Z'),
    fecha_vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    renovado: false,
    fecha_devolucion: null,
    estado: EstadoPrestamo.ACTIVO,
    observaciones: 'Préstamo inicial',
  };

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn().mockResolvedValue({
        data: [mockPrestamo],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
      findPrestamoById: jest.fn().mockResolvedValue(mockPrestamo),
      registrarDevolucion: jest.fn().mockResolvedValue({
        ...mockPrestamo,
        estado: EstadoPrestamo.DEVUELTO,
        fecha_devolucion: new Date(),
        encargado_devolucion_id: 'usr-admin-1',
      }),
      renovarPrestamo: jest.fn().mockResolvedValue({
        ...mockPrestamo,
        renovado: true,
      }),
    };

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrestamosController],
      providers: [
        {
          provide: PrestamosService,
          useValue: serviceMock,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    controller = module.get<PrestamosController>(PrestamosController);
  });

  it('debe estar definido el controlador de préstamos', () => {
    expect(controller).toBeDefined();
  });

  describe('Metadatos RBAC y Control de Acceso (TC009)', () => {
    it('debe exigir rol administrador_ti en registrarDevolucion', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.registrarDevolucion,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(RolUsuario.ADMINISTRADOR_TI);
    });

    const createMockContext = (handler: any, user: any): ExecutionContext => {
      return {
        getHandler: () => handler,
        getClass: () => PrestamosController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    it('debe permitir registrarDevolucion a un usuario administrador_ti', () => {
      const context = createMockContext(
        controller.registrarDevolucion,
        mockUserAdmin,
      );
      const canActivate = rolesGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('debe denegar acceso (403 Forbidden) a registrarDevolucion a un usuario colaborador (TC009)', () => {
      const context = createMockContext(
        controller.registrarDevolucion,
        mockUserColaborador,
      );
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debe denegar acceso si la petición no incluye usuario autenticado', () => {
      const context = createMockContext(controller.registrarDevolucion, null);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('getPrestamos', () => {
    it('debe forzar el filtro usuario_id al ID del colaborador si no es administrador', async () => {
      await controller.getPrestamos(
        mockUserColaborador,
        EstadoPrestamo.ACTIVO,
        'otro-usuario-id', // Intento de consultar préstamos de otro usuario
        undefined,
        1,
        10,
      );

      expect(serviceMock.findAll).toHaveBeenCalledWith({
        usuario_id: mockUserColaborador.id, // Forzado al colaborador en sesión
        estado: EstadoPrestamo.ACTIVO,
        por_vencer: false,
        page: 1,
        limit: 10,
      });
    });

    it('debe permitir al administrador consultar préstamos globales sin filtrar por usuario', async () => {
      await controller.getPrestamos(
        mockUserAdmin,
        undefined,
        undefined,
        undefined,
        1,
        20,
      );

      expect(serviceMock.findAll).toHaveBeenCalledWith({
        usuario_id: undefined,
        estado: undefined,
        por_vencer: false,
        page: 1,
        limit: 20,
      });
    });

    it('debe permitir al administrador filtrar préstamos de un colaborador específico', async () => {
      await controller.getPrestamos(
        mockUserAdmin,
        EstadoPrestamo.ACTIVO,
        'usr-colab-especifico',
        undefined,
        1,
        10,
      );

      expect(serviceMock.findAll).toHaveBeenCalledWith({
        usuario_id: 'usr-colab-especifico',
        estado: EstadoPrestamo.ACTIVO,
        por_vencer: false,
        page: 1,
        limit: 10,
      });
    });

    it('debe interpretar el flag por_vencer correctamente (true, string "true" o "1")', async () => {
      await controller.getPrestamos(
        mockUserAdmin,
        EstadoPrestamo.ACTIVO,
        undefined,
        'true',
        1,
        10,
      );

      expect(serviceMock.findAll).toHaveBeenCalledWith({
        usuario_id: undefined,
        estado: EstadoPrestamo.ACTIVO,
        por_vencer: true,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('registrarDevolucion (TC004)', () => {
    it('debe delegar en service.registrarDevolucion con ID de préstamo y de encargado de TI', async () => {
      const dto: RegistrarDevolucionDto = {
        estado_fisico_equipo: EstadoEquipo.DISPONIBLE,
        observaciones: 'Equipo en excelente estado físico',
      };

      const result = await controller.registrarDevolucion(
        'prest-uuid-1',
        mockUserAdmin,
        dto,
      );

      expect(serviceMock.registrarDevolucion).toHaveBeenCalledWith(
        'prest-uuid-1',
        mockUserAdmin.id,
        dto,
      );
      expect(result.estado).toBe(EstadoPrestamo.DEVUELTO);
    });
  });

  describe('renovarPrestamo', () => {
    const dto: RenovarPrestamoDto = {
      dias_extension: 30,
      observaciones: 'Ampliación para sprint',
    };

    it('debe permitir a un colaborador solicitar la renovación de su propio préstamo', async () => {
      const result = await controller.renovarPrestamo(
        'prest-uuid-1',
        mockUserColaborador,
        dto,
      );

      expect(serviceMock.renovarPrestamo).toHaveBeenCalledWith(
        'prest-uuid-1',
        mockUserColaborador.id,
        dto,
        false, // esAdmin = false
      );
      expect(result.renovado).toBe(true);
    });

    it('debe permitir a un administrador de TI renovar cualquier préstamo', async () => {
      const result = await controller.renovarPrestamo(
        'prest-uuid-1',
        mockUserAdmin,
        dto,
      );

      expect(serviceMock.renovarPrestamo).toHaveBeenCalledWith(
        'prest-uuid-1',
        mockUserAdmin.id,
        dto,
        true, // esAdmin = true
      );
      expect(result.renovado).toBe(true);
    });
  });
});
