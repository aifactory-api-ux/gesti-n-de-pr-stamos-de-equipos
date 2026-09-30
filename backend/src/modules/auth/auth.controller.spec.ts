import { Test, TestingModule } from '@nestjs/testing';
import { RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SsoLoginDto, AuthResponseDto, ProfileResponseDto } from './dto/sso-login.dto';
import { RolUsuario, EstadoUsuario } from '../../database/entities/usuario.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: any;

  beforeEach(async () => {
    authServiceMock = {
      ssoLogin: jest.fn(),
      getProfileAndQuota: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('debe estar definido el controlador', () => {
    expect(controller).toBeDefined();
  });

  describe('Metadatos de rutas OpenAPI / Contrato', () => {
    it('debe exponer el prefijo de controlador api/v1/auth', () => {
      const controllerPath = Reflect.getMetadata('path', AuthController);
      expect(controllerPath).toBe('api/v1/auth');
    });

    it('debe exponer la ruta GET /api/v1/auth/me correspondiente al contrato', () => {
      const methodPath = Reflect.getMetadata('path', controller.getMe);
      const requestMethod = Reflect.getMetadata('method', controller.getMe);
      expect(methodPath).toBe('me');
      expect(requestMethod).toBe(RequestMethod.GET);
    });

    it('debe exponer la ruta POST /api/v1/auth/sso-login correspondiente al contrato', () => {
      const methodPath = Reflect.getMetadata('path', controller.ssoLogin);
      const requestMethod = Reflect.getMetadata('method', controller.ssoLogin);
      expect(methodPath).toBe('sso-login');
      expect(requestMethod).toBe(RequestMethod.POST);
    });
  });

  describe('ssoLogin', () => {
    it('debe invocar a authService.ssoLogin y devolver los datos de sesión', async () => {
      const dto: SsoLoginDto = { id_token: 'header.payload.signature' };
      const expectedResponse: AuthResponseDto = {
        token: 'jwt-session-token',
        access_token: 'jwt-session-token',
        usuario: {
          id: 'usr-123',
          email: 'colaborador@api-ux.com',
          nombre_completo: 'Colaborador Test',
          rol: RolUsuario.COLABORADOR,
          estado: EstadoUsuario.ACTIVO,
          creado_en: new Date(),
        },
      };

      authServiceMock.ssoLogin.mockResolvedValue(expectedResponse);

      const result = await controller.ssoLogin(dto);
      expect(authServiceMock.ssoLogin).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getMe', () => {
    it('debe invocar a authService.getProfileAndQuota con el identificador del usuario autenticado', async () => {
      const user = { id: 'usr-456', email: 'colaborador@api-ux.com' };
      const expectedProfile: ProfileResponseDto = {
        id: 'usr-456',
        email: 'colaborador@api-ux.com',
        nombre_completo: 'Colaborador Test',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
        creado_en: new Date(),
        usuario: {
          id: 'usr-456',
          email: 'colaborador@api-ux.com',
          nombre_completo: 'Colaborador Test',
          rol: RolUsuario.COLABORADOR,
          estado: EstadoUsuario.ACTIVO,
          creado_en: new Date(),
        },
        quota: {
          prestamos_activos_count: 0,
          cupo_maximo: 2,
          cupo_restante: 2,
          puede_solicitar: true,
        },
      };

      authServiceMock.getProfileAndQuota.mockResolvedValue(expectedProfile);

      const result = await controller.getMe(user);
      expect(authServiceMock.getProfileAndQuota).toHaveBeenCalledWith('usr-456');
      expect(result).toEqual(expectedProfile);
    });

    it('debe utilizar sub si id no está presente en el usuario autenticado', async () => {
      const user = { sub: 'usr-sub-789', email: 'colaborador@api-ux.com' };
      authServiceMock.getProfileAndQuota.mockResolvedValue({ id: 'usr-sub-789' });

      await controller.getMe(user);
      expect(authServiceMock.getProfileAndQuota).toHaveBeenCalledWith('usr-sub-789');
    });

    it('debe utilizar email si ni id ni sub están presentes en el usuario autenticado', async () => {
      const user = { email: 'colaborador@api-ux.com' };
      authServiceMock.getProfileAndQuota.mockResolvedValue({ email: 'colaborador@api-ux.com' });

      await controller.getMe(user);
      expect(authServiceMock.getProfileAndQuota).toHaveBeenCalledWith('colaborador@api-ux.com');
    });
  });
});
