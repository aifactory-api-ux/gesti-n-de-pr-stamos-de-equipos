import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { FilterEquipoDto } from './dto/filter-equipo.dto';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { CategoriaEntity } from '../../database/entities/categoria.entity';
import { RolUsuario } from '../../database/entities/usuario.entity';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('EquiposController', () => {
  let controller: EquiposController;
  let serviceMock: any;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockCategoria: CategoriaEntity = {
    id: 'cat-uuid-1',
    nombre: 'Notebook',
    descripcion: 'Equipos portátiles',
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
    serviceMock = {
      findAllCategorias: jest.fn().mockResolvedValue([mockCategoria]),
      findAllEquipos: jest.fn().mockResolvedValue({
        data: [mockEquipo],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      }),
      findEquipoById: jest.fn().mockResolvedValue(mockEquipo),
      createEquipo: jest.fn().mockResolvedValue(mockEquipo),
    };

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EquiposController],
      providers: [
        {
          provide: EquiposService,
          useValue: serviceMock,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    controller = module.get<EquiposController>(EquiposController);
  });

  it('debe estar definido el controlador', () => {
    expect(controller).toBeDefined();
  });

  describe('Metadatos de rutas OpenAPI / Contrato', () => {
    it('debe exponer el prefijo de controlador api/v1', () => {
      const controllerPath = Reflect.getMetadata('path', EquiposController);
      expect(controllerPath).toBe('api/v1');
    });

    it('debe exponer la ruta GET /api/v1/categorias correspondiente al contrato', () => {
      const methodPath = Reflect.getMetadata('path', controller.getCategorias);
      const requestMethod = Reflect.getMetadata('method', controller.getCategorias);
      expect(methodPath).toBe('categorias');
      expect(requestMethod).toBe(RequestMethod.GET);
    });

    it('debe exponer la ruta GET /api/v1/equipos correspondiente al contrato', () => {
      const methodPath = Reflect.getMetadata('path', controller.getEquipos);
      const requestMethod = Reflect.getMetadata('method', controller.getEquipos);
      expect(methodPath).toBe('equipos');
      expect(requestMethod).toBe(RequestMethod.GET);
    });

    it('debe exponer la ruta GET /api/v1/equipos/:id correspondiente al contrato', () => {
      const methodPath = Reflect.getMetadata('path', controller.getEquipoById);
      const requestMethod = Reflect.getMetadata('method', controller.getEquipoById);
      expect(methodPath).toBe('equipos/:id');
      expect(requestMethod).toBe(RequestMethod.GET);
    });

    it('debe exponer la ruta POST /api/v1/equipos correspondiente al contrato', () => {
      const methodPath = Reflect.getMetadata('path', controller.createEquipo);
      const requestMethod = Reflect.getMetadata('method', controller.createEquipo);
      expect(methodPath).toBe('equipos');
      expect(requestMethod).toBe(RequestMethod.POST);
    });
  });

  describe('Metadatos y Decoradores de Seguridad', () => {
    it('debe tener configurado el rol administrador_ti en el método createEquipo', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.createEquipo,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(RolUsuario.ADMINISTRADOR_TI);
    });
  });

  describe('getCategorias', () => {
    it('debe delegar en service.findAllCategorias y retornar la lista de categorías', async () => {
      const result = await controller.getCategorias();
      expect(serviceMock.findAllCategorias).toHaveBeenCalledTimes(1);
      expect(result).toEqual([mockCategoria]);
    });
  });

  describe('getEquipos', () => {
    it('debe delegar en service.findAllEquipos con los parámetros de filtro', async () => {
      const filters: FilterEquipoDto = {
        search: 'Latitude',
        estado: EstadoEquipo.DISPONIBLE,
        page: 1,
        limit: 10,
      };

      const result = await controller.getEquipos(filters);

      expect(serviceMock.findAllEquipos).toHaveBeenCalledWith(filters);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getEquipoById', () => {
    it('debe delegar en service.findEquipoById con el ID proporcionado', async () => {
      const result = await controller.getEquipoById('eq-uuid-1');

      expect(serviceMock.findEquipoById).toHaveBeenCalledWith('eq-uuid-1');
      expect(result).toEqual(mockEquipo);
    });
  });

  describe('createEquipo', () => {
    it('debe delegar en service.createEquipo con los datos del nuevo equipo', async () => {
      const dto: CreateEquipoDto = {
        codigo_inventario: 'NB-042',
        categoria_id: 'cat-uuid-1',
        marca: 'Dell',
        modelo: 'Latitude 5420',
        numero_serie: 'SN-987654321',
        estado: EstadoEquipo.DISPONIBLE,
      };

      const result = await controller.createEquipo(dto);

      expect(serviceMock.createEquipo).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockEquipo);
    });
  });

  describe('Evaluación de RolesGuard sobre Endpoints', () => {
    const createMockContext = (handler: any, user: any): ExecutionContext => {
      return {
        getHandler: () => handler,
        getClass: () => EquiposController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    it('debe permitir acceso a GET getCategorias a cualquier usuario colaborador autenticado', () => {
      const context = createMockContext(controller.getCategorias, {
        id: 'usr-1',
        email: 'colaborador@api-ux.com',
        rol: RolUsuario.COLABORADOR,
      });

      const canActivate = rolesGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('debe permitir acceso a GET getEquipos a cualquier usuario colaborador autenticado', () => {
      const context = createMockContext(controller.getEquipos, {
        id: 'usr-1',
        email: 'colaborador@api-ux.com',
        rol: RolUsuario.COLABORADOR,
      });

      const canActivate = rolesGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('debe permitir acceso a POST createEquipo solo si el usuario tiene rol administrador_ti', () => {
      const context = createMockContext(controller.createEquipo, {
        id: 'admin-1',
        email: 'admin@api-ux.com',
        rol: RolUsuario.ADMINISTRADOR_TI,
      });

      const canActivate = rolesGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('debe denegar acceso (403 Forbidden) a POST createEquipo si el usuario es colaborador', () => {
      const context = createMockContext(controller.createEquipo, {
        id: 'colab-1',
        email: 'colaborador@api-ux.com',
        rol: RolUsuario.COLABORADOR,
      });

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debe denegar acceso (403 Forbidden) a POST createEquipo si no hay usuario en la petición', () => {
      const context = createMockContext(controller.createEquipo, null);

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
