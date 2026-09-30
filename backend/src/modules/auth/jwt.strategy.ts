import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioEntity, EstadoUsuario } from '../../database/entities/usuario.entity';

/**
 * Dominio corporativo obligatorio para validación de acceso.
 */
export const DOMINIO_AUTORIZADO = '@api-ux.com';

/**
 * Estrategia de Passport para la validación y decodificación de tokens JWT Bearer
 * emitidos internamente tras el inicio de sesión SSO.
 * Resuelve y valida el usuario activo desde PostgreSQL.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepository: Repository<UsuarioEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.secret') ||
        'Kz81mK!p98Z2#e9X1v82N!w4Q71Lp0x9',
    });
  }

  /**
   * Valida el payload del token decodificado y recupera la entidad del usuario.
   */
  async validate(payload: any): Promise<UsuarioEntity> {
    if (!payload) {
      throw new UnauthorizedException('Token de autenticación inválido');
    }

    const email = (
      payload.email ||
      payload.preferred_username ||
      payload.upn ||
      payload.unique_name
    )
      ?.toLowerCase()
      ?.trim();

    if (!email) {
      throw new UnauthorizedException(
        'El token no contiene un correo electrónico corporativo válido',
      );
    }

    if (!email.endsWith(DOMINIO_AUTORIZADO.toLowerCase())) {
      throw new UnauthorizedException(
        'Acceso denegado: restricción exclusiva a cuentas con dominio @api-ux.com',
      );
    }

    let usuario: UsuarioEntity | null = null;
    const userId = payload.sub || payload.id;

    if (userId) {
      usuario = await this.usuarioRepository.findOne({
        where: { id: userId },
      });
    }

    if (!usuario && email) {
      usuario = await this.usuarioRepository.findOne({
        where: { email },
      });
    }

    if (!usuario) {
      throw new UnauthorizedException(
        'Usuario no registrado o no autorizado en la plataforma',
      );
    }

    if (usuario.estado === EstadoUsuario.INACTIVO) {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    return usuario;
  }
}
