import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService, DOMINIO_AUTORIZADO } from './auth.service';
import { UsuarioEntity, RolUsuario, EstadoUsuario } from '../../database/entities/usuario.entity';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usuarioRepoMock: any;
  let prestamoRepoMock: any;
  let jwtServiceMock: any;
  let configServiceMock: any;

  // Helper para generar tokens JWT simulados en base64url
  const createMockToken = (payload: Record<string, any>): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.mock-signature-hash`;
  };

  beforeEach(async () => {
    usuarioRepoMock = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'mock-uuid-1234', ...dto, creado_en: new Date() })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    prestamoRepoMock = {
      count: jest.fn(),
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('mocked-internal-app-token'),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.secret') return 'test-secret';
        if (key === 'jwt.expiresIn') return '8h';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UsuarioEntity),
          useValue: usuarioRepoMock,
        },
        {
          provide: getRepositoryToken(PrestamoEntity),
          useValue: prestamoRepoMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('decodeAndValidateToken', () => {
    it('debe validar y decodificar correctamente un token con dominio corporativo @api-ux.com', () => {
      const token = createMockToken({
        email: 'juan.perez@api-ux.com',
        name: 'Juan Pérez',
        roles: ['colaborador'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const claims = service.decodeAndValidateToken(token);
      expect(claims.email).toBe('juan.perez@api-ux.com');
      expect(claims.nombre_completo).toBe('Juan Pérez');
      expect(claims.rol).toBe(RolUsuario.COLABORADOR);
    });

    it('debe rechazar tokens con dominios externos como @gmail.com', () => {
      const token = createMockToken({
        email: 'usuario.externo@gmail.com',
        name: 'Usuario Externo',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      expect(() => service.decodeAndValidateToken(token)).toThrow(
        UnauthorizedException,
      );
      expect(() => service.decodeAndValidateToken(token)).toThrow(
        'Acceso denegado: restricción exclusiva a cuentas con dominio @api-ux.com',
      );
    });

    it('debe asignar rol administrador_ti si el correo inicia con admin@ o soporte@', () => {
      const token = createMockToken({
        email: 'admin@api-ux.com',
        name: 'Administrador TI',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const claims = service.decodeAndValidateToken(token);
      expect(claims.rol).toBe(RolUsuario.ADMINISTRADOR_TI);
    });

    it('debe asignar rol administrador_ti si el claim roles contiene administrador_ti', () => {
      const token = createMockToken({
        email: 'carlos.rodriguez@api-ux.com',
        name: 'Carlos Rodríguez',
        roles: ['administrador_ti'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const claims = service.decodeAndValidateToken(token);
      expect(claims.rol).toBe(RolUsuario.ADMINISTRADOR_TI);
    });

    it('debe fallar si el token ha expirado', () => {
      const token = createMockToken({
        email: 'expirado@api-ux.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // Hace 1 hora
      });

      expect(() => service.decodeAndValidateToken(token)).toThrow(
        UnauthorizedException,
      );
      expect(() => service.decodeAndValidateToken(token)).toThrow(
        'El token de autenticación ha expirado',
      );
    });

    it('debe fallar si el token tiene un formato inválido', () => {
      expect(() => service.decodeAndValidateToken('token-invalido-sin-puntos')).toThrow(
        UnauthorizedException,
      );
      expect(() => service.decodeAndValidateToken('token-invalido-sin-puntos')).toThrow(
        'Formato de token Bearer inválido',
      );
    });

    it('debe fallar si el payload del token es JSON malformado', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const badPayload = 'this-is-not-valid-json';
      const badToken = `${header}.${badPayload}.signature`;

      expect(() => service.decodeAndValidateToken(badToken)).toThrow(
        UnauthorizedException,
      );
      expect(() => service.decodeAndValidateToken(badToken)).toThrow(
        'Token de autenticación malformado o ilegible',
      );
    });

    it('debe fallar si el token no incluye un correo electrónico válido', () => {
      const token = createMockToken({
        name: 'Usuario Sin Correo',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      expect(() => service.decodeAndValidateToken(token)).toThrow(
        UnauthorizedException,
      );
      expect(() => service.decodeAndValidateToken(token)).toThrow(
        'El token no incluye un correo electrónico válido',
      );
    });
  });

  describe('ssoLogin', () => {
    it('debe fallar con BadRequestException si no se provee ningún token', async () => {
      await expect(service.ssoLogin({})).rejects.toThrow(BadRequestException);
    });

    it('debe auto-aprovisionar un nuevo usuario si no existe en la base de datos', async () => {
      const token = createMockToken({
        email: 'nuevo.colaborador@api-ux.com',
        name: 'Nuevo Colaborador',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      usuarioRepoMock.findOne.mockResolvedValue(null);

      const result = await service.ssoLogin({ id_token: token });

      expect(usuarioRepoMock.findOne).toHaveBeenCalledWith({
        where: { email: 'nuevo.colaborador@api-ux.com' },
      });
      expect(usuarioRepoMock.create).toHaveBeenCalledWith({
        email: 'nuevo.colaborador@api-ux.com',
        nombre_completo: 'Nuevo Colaborador',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
      });
      expect(usuarioRepoMock.save).toHaveBeenCalled();
      expect(result.token).toBe('mocked-internal-app-token');
      expect(result.usuario.email).toBe('nuevo.colaborador@api-ux.com');
      expect(result.usuario.rol).toBe('colaborador');
    });

    it('debe sincronizar los datos si el usuario ya existe', async () => {
      const existingUser: UsuarioEntity = {
        id: 'usr-111',
        email: 'colaborador@api-ux.com',
        nombre_completo: 'Nombre Antiguo',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
        creado_en: new Date(),
      };

      const token = createMockToken({
        email: 'colaborador@api-ux.com',
        name: 'Nombre Actualizado',
        roles: ['administrador_ti'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      usuarioRepoMock.findOne.mockResolvedValue(existingUser);

      const result = await service.ssoLogin({ access_token: token });

      expect(usuarioRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre_completo: 'Nombre Actualizado',
          rol: RolUsuario.ADMINISTRADOR_TI,
        }),
      );
      expect(result.usuario.email).toBe('colaborador@api-ux.com');
    });

    it('debe denegar el acceso si el usuario registrado se encuentra inactivo', async () => {
      const inactiveUser: UsuarioEntity = {
        id: 'usr-inactive',
        email: 'suspendido@api-ux.com',
        nombre_completo: 'Usuario Inactivo',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.INACTIVO,
        creado_en: new Date(),
      };

      const token = createMockToken({
        email: 'suspendido@api-ux.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      usuarioRepoMock.findOne.mockResolvedValue(inactiveUser);

      await expect(service.ssoLogin({ token })).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.ssoLogin({ token })).rejects.toThrow(
        'Usuario inactivo o suspendido',
      );
    });
  });

  describe('calculateQuota', () => {
    it('debe calcular cupo completo si el colaborador tiene 0 préstamos activos', async () => {
      prestamoRepoMock.count.mockResolvedValue(0);

      const quota = await service.calculateQuota('usr-1', EstadoUsuario.ACTIVO);

      expect(quota.prestamos_activos_count).toBe(0);
      expect(quota.cupo_maximo).toBe(2);
      expect(quota.cupo_restante).toBe(2);
      expect(quota.puede_solicitar).toBe(true);
    });

    it('debe calcular cupo restante de 1 si el colaborador tiene 1 préstamo activo', async () => {
      prestamoRepoMock.count.mockResolvedValue(1);

      const quota = await service.calculateQuota('usr-1', EstadoUsuario.ACTIVO);

      expect(quota.prestamos_activos_count).toBe(1);
      expect(quota.cupo_maximo).toBe(2);
      expect(quota.cupo_restante).toBe(1);
      expect(quota.puede_solicitar).toBe(true);
    });

    it('debe bloquear la capacidad de solicitar si el colaborador ya tiene 2 préstamos activos', async () => {
      prestamoRepoMock.count.mockResolvedValue(2);

      const quota = await service.calculateQuota('usr-1', EstadoUsuario.ACTIVO);

      expect(quota.prestamos_activos_count).toBe(2);
      expect(quota.cupo_maximo).toBe(2);
      expect(quota.cupo_restante).toBe(0);
      expect(quota.puede_solicitar).toBe(false);
    });
  });

  describe('getProfileAndQuota', () => {
    it('debe retornar perfil y cupo del usuario autenticado correctamente', async () => {
      const mockUser: UsuarioEntity = {
        id: '2a49b251-8178-439d-b8d9-35c6f66ea6d1',
        email: 'juan.perez@api-ux.com',
        nombre_completo: 'Juan Pérez',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
        creado_en: new Date('2026-09-30T10:00:00Z'),
      };

      usuarioRepoMock.findOne.mockResolvedValue(mockUser);
      prestamoRepoMock.count.mockResolvedValue(1);

      const res = await service.getProfileAndQuota(mockUser.id);

      expect(res.id).toBe(mockUser.id);
      expect(res.email).toBe('juan.perez@api-ux.com');
      expect(res.usuario.nombre_completo).toBe('Juan Pérez');
      expect(res.quota.prestamos_activos_count).toBe(1);
      expect(res.quota.cupo_maximo).toBe(2);
      expect(res.quota.cupo_restante).toBe(1);
      expect(res.quota.puede_solicitar).toBe(true);
    });

    it('debe lanzar NotFoundException si el usuario no existe y no es email corporativo', async () => {
      usuarioRepoMock.findOne.mockResolvedValue(null);

      await expect(service.getProfileAndQuota('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar UnauthorizedException si no se proporciona identificador', async () => {
      await expect(service.getProfileAndQuota('')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getProfileAndQuota('')).rejects.toThrow(
        'Identificador de usuario no proporcionado',
      );
    });

    it('debe auto-aprovisionar usuario si se consulta por email @api-ux.com y aún no existe', async () => {
      usuarioRepoMock.findOne.mockResolvedValue(null);
      prestamoRepoMock.count.mockResolvedValue(0);

      const res = await service.getProfileAndQuota('nuevo.auto@api-ux.com');

      expect(usuarioRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'nuevo.auto@api-ux.com',
          rol: RolUsuario.COLABORADOR,
          estado: EstadoUsuario.ACTIVO,
        }),
      );
      expect(res.email).toBe('nuevo.auto@api-ux.com');
      expect(res.quota.puede_solicitar).toBe(true);
    });

    it('debe auto-aprovisionar como administrador_ti si el correo inicia con admin@', async () => {
      usuarioRepoMock.findOne.mockResolvedValue(null);
      prestamoRepoMock.count.mockResolvedValue(0);

      await service.getProfileAndQuota('admin@api-ux.com');

      expect(usuarioRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@api-ux.com',
          rol: RolUsuario.ADMINISTRADOR_TI,
          estado: EstadoUsuario.ACTIVO,
        }),
      );
    });

    it('debe lanzar UnauthorizedException si el usuario está inactivo', async () => {
      const inactiveUuid = 'e2a44b82-7f91-4cf1-8c43-b9b008d66df2';
      usuarioRepoMock.findOne.mockResolvedValue({
        id: inactiveUuid,
        email: 'inactivo@api-ux.com',
        nombre_completo: 'Usuario Inactivo',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.INACTIVO,
        creado_en: new Date(),
      });

      await expect(service.getProfileAndQuota(inactiveUuid)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getProfileAndQuota(inactiveUuid)).rejects.toThrow(
        'Usuario inactivo o suspendido',
      );
    });
  });

  describe('sincronizarUsuario', () => {
    it('debe registrar un nuevo usuario si no existe en la base de datos', async () => {
      usuarioRepoMock.findOne.mockResolvedValue(null);
      const claims = {
        email: 'ana.lopez@api-ux.com',
        nombre_completo: 'Ana López',
        rol: RolUsuario.COLABORADOR,
      };

      const user = await service.sincronizarUsuario(claims);

      expect(usuarioRepoMock.findOne).toHaveBeenCalledWith({
        where: { email: 'ana.lopez@api-ux.com' },
      });
      expect(usuarioRepoMock.create).toHaveBeenCalledWith({
        email: 'ana.lopez@api-ux.com',
        nombre_completo: 'Ana López',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
      });
      expect(usuarioRepoMock.save).toHaveBeenCalled();
      expect(user.email).toBe('ana.lopez@api-ux.com');
    });

    it('debe actualizar los datos de usuario existente si cambiaron en Azure AD', async () => {
      const existingUser: UsuarioEntity = {
        id: 'usr-existente',
        email: 'ana.lopez@api-ux.com',
        nombre_completo: 'Ana L.',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
        creado_en: new Date(),
      };
      usuarioRepoMock.findOne.mockResolvedValue(existingUser);

      const claims = {
        email: 'ana.lopez@api-ux.com',
        nombre_completo: 'Ana López Actualizada',
        rol: RolUsuario.ADMINISTRADOR_TI,
      };

      const updated = await service.sincronizarUsuario(claims);

      expect(usuarioRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre_completo: 'Ana López Actualizada',
          rol: RolUsuario.ADMINISTRADOR_TI,
        }),
      );
      expect(updated.rol).toBe(RolUsuario.ADMINISTRADOR_TI);
    });

    it('debe lanzar UnauthorizedException si el usuario existente está inactivo', async () => {
      const inactiveUser: UsuarioEntity = {
        id: 'usr-inactivo',
        email: 'bloqueado@api-ux.com',
        nombre_completo: 'Usuario Bloqueado',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.INACTIVO,
        creado_en: new Date(),
      };
      usuarioRepoMock.findOne.mockResolvedValue(inactiveUser);

      await expect(
        service.sincronizarUsuario({
          email: 'bloqueado@api-ux.com',
          nombre_completo: 'Usuario Bloqueado',
          rol: RolUsuario.COLABORADOR,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateSessionToken', () => {
    it('debe generar y firmar un token JWT con el payload del usuario', () => {
      const mockUser: UsuarioEntity = {
        id: 'usr-jwt-1',
        email: 'juan.perez@api-ux.com',
        nombre_completo: 'Juan Pérez',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
        creado_en: new Date(),
      };

      const token = service.generateSessionToken(mockUser);

      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        {
          sub: 'usr-jwt-1',
          id: 'usr-jwt-1',
          email: 'juan.perez@api-ux.com',
          nombre_completo: 'Juan Pérez',
          rol: RolUsuario.COLABORADOR,
        },
        { expiresIn: '8h' },
      );
      expect(token).toBe('mocked-internal-app-token');
    });
  });
});
