import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsuarioEntity, RolUsuario, EstadoUsuario } from '../../database/entities/usuario.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usuarioRepoMock: any;

  beforeEach(async () => {
    usuarioRepoMock = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-jwt-secret-key-1234';
              return null;
            }),
          },
        },
        {
          provide: getRepositoryToken(UsuarioEntity),
          useValue: usuarioRepoMock,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('debe estar definida la estrategia', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('debe resolver y retornar el usuario activo con dominio @api-ux.com', async () => {
      const mockUser: UsuarioEntity = {
        id: 'usr-1',
        email: 'colaborador@api-ux.com',
        nombre_completo: 'Juan Pérez',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.ACTIVO,
        creado_en: new Date(),
      };

      usuarioRepoMock.findOne.mockResolvedValue(mockUser);

      const payload = {
        sub: 'usr-1',
        email: 'colaborador@api-ux.com',
        rol: 'colaborador',
      };

      const result = await strategy.validate(payload);
      expect(result).toEqual(mockUser);
    });

    it('debe rechazar tokens con dominio diferente a @api-ux.com', async () => {
      const payload = {
        sub: 'usr-2',
        email: 'externo@empresa-ajena.com',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'Acceso denegado: restricción exclusiva a cuentas con dominio @api-ux.com',
      );
    });

    it('debe fallar si el usuario no existe en la base de datos', async () => {
      usuarioRepoMock.findOne.mockResolvedValue(null);

      const payload = {
        sub: 'usr-inexistente',
        email: 'no-existe@api-ux.com',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'Usuario no registrado o no autorizado en la plataforma',
      );
    });

    it('debe fallar si el usuario se encuentra inactivo', async () => {
      const inactiveUser: UsuarioEntity = {
        id: 'usr-3',
        email: 'inactivo@api-ux.com',
        nombre_completo: 'Usuario Inactivo',
        rol: RolUsuario.COLABORADOR,
        estado: EstadoUsuario.INACTIVO,
        creado_en: new Date(),
      };

      usuarioRepoMock.findOne.mockResolvedValue(inactiveUser);

      const payload = {
        sub: 'usr-3',
        email: 'inactivo@api-ux.com',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'Usuario inactivo o suspendido',
      );
    });
  });
});
