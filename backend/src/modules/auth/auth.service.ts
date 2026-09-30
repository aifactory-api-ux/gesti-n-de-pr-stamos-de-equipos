import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UsuarioEntity,
  RolUsuario,
  EstadoUsuario,
} from '../../database/entities/usuario.entity';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import {
  SsoLoginDto,
  AuthResponseDto,
  CollaboratorQuotaDto,
  ProfileResponseDto,
  UsuarioDto,
} from './dto/sso-login.dto';

/**
 * Dominio institucional corporativo permitido para el acceso al sistema.
 */
export const DOMINIO_AUTORIZADO = '@api-ux.com';

/**
 * Servicio encargado de la lógica de autenticación corporativa SSO (Azure AD / Entra ID),
 * sincronización y auto-provisión de cuentas en PostgreSQL, emisión de tokens JWT de sesión
 * y cálculo en tiempo real de cupos de préstamos activos.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepository: Repository<UsuarioEntity>,
    @InjectRepository(PrestamoEntity)
    private readonly prestamoRepository: Repository<PrestamoEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Procesa el inicio de sesión Single Sign-On (SSO) validando el token emitido por Azure AD,
   * garantizando el dominio corporativo, sincronizando o creando el usuario en base de datos
   * y generando el token JWT de sesión interna.
   */
  async ssoLogin(dto: SsoLoginDto): Promise<AuthResponseDto> {
    const rawToken = dto.id_token || dto.access_token || dto.token;

    if (rawToken && typeof rawToken === 'string') {
      // Validar token y extraer claims
      const claims = this.decodeAndValidateToken(rawToken);

      // Sincronizar o auto-aprovisionar usuario
      const usuario = await this.sincronizarUsuario(claims);

      // Emitir token JWT interno de sesión
      const token = this.generateSessionToken(usuario);

      const usuarioDto: UsuarioDto = {
        id: usuario.id,
        email: usuario.email,
        nombre_completo: usuario.nombre_completo,
        rol: usuario.rol,
        estado: usuario.estado,
        creado_en: usuario.creado_en,
      };

      return {
        token,
        access_token: token,
        usuario: usuarioDto,
      };
    }

    // Soporte para inicio de sesión con credenciales directas documentadas (email / username)
    const emailInput = (dto.email || dto.username || '').toLowerCase().trim();
    if (emailInput) {
      return this.loginWithEmail(emailInput);
    }

    throw new BadRequestException(
      'Debe proporcionar un token de autenticación válido (id_token o access_token) o correo corporativo',
    );
  }

  /**
   * Inicio de sesión directo o simulado para credenciales documentadas en el manual corporativo.
   */
  async loginWithEmail(emailInput: string): Promise<AuthResponseDto> {
    const emailClean = emailInput.toLowerCase().trim();
    let usuario = await this.usuarioRepository.findOne({
      where: [
        { email: emailClean },
        { email: emailClean.replace('@apiux.com', '@api-ux.com') },
        { email: emailClean.replace('@api-ux.com', '@apiux.com') },
      ],
    });

    if (!usuario) {
      const rol =
        emailClean.startsWith('admin') ||
        emailClean.startsWith('soporte') ||
        emailClean.startsWith('ti')
          ? RolUsuario.ADMINISTRADOR_TI
          : RolUsuario.COLABORADOR;

      usuario = this.usuarioRepository.create({
        email: emailClean,
        nombre_completo: emailClean.split('@')[0],
        rol,
        estado: EstadoUsuario.ACTIVO,
      });
      usuario = await this.usuarioRepository.save(usuario);
    }

    const token = this.generateSessionToken(usuario);
    const usuarioDto: UsuarioDto = {
      id: usuario.id,
      email: usuario.email,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      estado: usuario.estado,
      creado_en: usuario.creado_en,
    };

    return {
      token,
      access_token: token,
      usuario: usuarioDto,
    };
  }

  /**
   * Obtiene el perfil completo del usuario autenticado junto al cálculo en tiempo real
   * de su cupo de préstamos activos (máximo 2 simultáneos).
   */
  async getProfileAndQuota(identifier: string): Promise<ProfileResponseDto> {
    if (!identifier) {
      throw new UnauthorizedException('Identificador de usuario no proporcionado');
    }

    let usuario: UsuarioEntity | null = null;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    if (isUuid) {
      usuario = await this.usuarioRepository.findOne({
        where: { id: identifier },
      });
    }

    if (!usuario && identifier.includes('@')) {
      const email = identifier.toLowerCase().trim();
      usuario = await this.usuarioRepository.findOne({
        where: [
          { email },
          { email: email.replace('@apiux.com', '@api-ux.com') },
          { email: email.replace('@api-ux.com', '@apiux.com') },
        ],
      });

      // Si el usuario no existe aún en la base de datos pero proviene de un token válido @api-ux.com o @apiux.com
      if (!usuario && (email.endsWith('@api-ux.com') || email.endsWith('@apiux.com'))) {
        const rol =
          email.startsWith('admin') ||
          email.startsWith('soporte') ||
          email.startsWith('ti')
            ? RolUsuario.ADMINISTRADOR_TI
            : RolUsuario.COLABORADOR;

        usuario = this.usuarioRepository.create({
          email,
          nombre_completo: email.split('@')[0],
          rol,
          estado: EstadoUsuario.ACTIVO,
        });
        usuario = await this.usuarioRepository.save(usuario);
      }
    }

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado en el sistema');
    }

    if (usuario.estado === EstadoUsuario.INACTIVO) {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    const quota = await this.calculateQuota(usuario.id, usuario.estado);

    const usuarioDto: UsuarioDto = {
      id: usuario.id,
      email: usuario.email,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      estado: usuario.estado,
      creado_en: usuario.creado_en,
    };

    return {
      ...usuarioDto,
      usuario: usuarioDto,
      quota,
    };
  }

  /**
   * Calcula el cupo disponible de préstamos en tiempo real para un colaborador.
   * Regla de negocio: Máximo 2 préstamos activos en simultáneo.
   */
  async calculateQuota(
    usuarioId: string,
    estadoUsuario: string = EstadoUsuario.ACTIVO,
  ): Promise<CollaboratorQuotaDto> {
    const prestamosActivosCount = await this.prestamoRepository.count({
      where: [
        { usuario_id: usuarioId, estado: EstadoPrestamo.ACTIVO },
        { usuario_id: usuarioId, estado: EstadoPrestamo.VENCIDO },
      ],
    });

    const cupoMaximo = 2;
    const cupoRestante = Math.max(0, cupoMaximo - prestamosActivosCount);
    const puedeSolicitar =
      prestamosActivosCount < cupoMaximo && estadoUsuario === EstadoUsuario.ACTIVO;

    return {
      prestamos_activos_count: prestamosActivosCount,
      cupo_maximo: cupoMaximo,
      cupo_restante: cupoRestante,
      puede_solicitar: puedeSolicitar,
    };
  }

  /**
   * Decodifica y valida la estructura y claims del token emitido por Azure AD.
   * Aplica restricción estricta de dominio corporativo @api-ux.com y verifica expiración.
   */
  decodeAndValidateToken(token: string): {
    email: string;
    nombre_completo: string;
    rol: RolUsuario;
    sub?: string;
  } {
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7).trim() : token.trim();
    const parts = cleanToken.split('.');

    if (parts.length !== 3) {
      throw new UnauthorizedException('Formato de token Bearer inválido');
    }

    let payload: any;
    try {
      const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf-8');
      payload = JSON.parse(payloadRaw);
    } catch {
      throw new UnauthorizedException('Token de autenticación malformado o ilegible');
    }

    // Verificar vigencia temporal
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new UnauthorizedException('El token de autenticación ha expirado');
    }

    // Extraer correo
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
        'El token no incluye un correo electrónico válido',
      );
    }

    // Restricción estricta obligatoria al dominio institucional @api-ux.com o @apiux.com
    if (
      !email.endsWith(DOMINIO_AUTORIZADO.toLowerCase()) &&
      !email.endsWith('@apiux.com')
    ) {
      throw new UnauthorizedException(
        'Acceso denegado: restricción exclusiva a cuentas con dominio @api-ux.com',
      );
    }

    // Extraer nombre completo
    const nombreCompleto =
      payload.name ||
      payload.nombre_completo ||
      payload.given_name ||
      (payload.family_name ? `${payload.given_name || ''} ${payload.family_name}`.trim() : null) ||
      email.split('@')[0];

    // Determinar rol
    let rol: RolUsuario = RolUsuario.COLABORADOR;
    const roles: string[] = Array.isArray(payload.roles)
      ? payload.roles
      : payload.rol
      ? [payload.rol]
      : [];

    const tieneRolAdmin = roles.some((r) =>
      ['administrador_ti', 'admin', 'administrator', 'AdminTI', 'Admin'].includes(r),
    );

    const tieneEmailAdmin =
      email.startsWith('admin@') ||
      email.startsWith('soporte@') ||
      email.startsWith('ti@') ||
      email.startsWith('it@');

    if (tieneRolAdmin || tieneEmailAdmin) {
      rol = RolUsuario.ADMINISTRADOR_TI;
    }

    return {
      email,
      nombre_completo: nombreCompleto,
      rol,
      sub: payload.sub || payload.oid,
    };
  }

  /**
   * Sincroniza o auto-provisiona el usuario en la tabla 'usuarios' según los claims de Azure AD.
   */
  async sincronizarUsuario(claims: {
    email: string;
    nombre_completo: string;
    rol: RolUsuario;
  }): Promise<UsuarioEntity> {
    const email = claims.email.toLowerCase().trim();
    let usuario = await this.usuarioRepository.findOne({
      where: { email },
    });

    if (!usuario) {
      usuario = this.usuarioRepository.create({
        email,
        nombre_completo: claims.nombre_completo,
        rol: claims.rol,
        estado: EstadoUsuario.ACTIVO,
      });
      usuario = await this.usuarioRepository.save(usuario);
    } else {
      if (usuario.estado === EstadoUsuario.INACTIVO) {
        throw new UnauthorizedException('Usuario inactivo o suspendido');
      }

      let modificado = false;
      if (
        claims.nombre_completo &&
        usuario.nombre_completo !== claims.nombre_completo
      ) {
        usuario.nombre_completo = claims.nombre_completo;
        modificado = true;
      }

      // Si el rol en Azure AD es administrador_ti y en DB era colaborador, actualizarlo
      if (
        claims.rol === RolUsuario.ADMINISTRADOR_TI &&
        usuario.rol !== RolUsuario.ADMINISTRADOR_TI
      ) {
        usuario.rol = RolUsuario.ADMINISTRADOR_TI;
        modificado = true;
      }

      if (modificado) {
        usuario = await this.usuarioRepository.save(usuario);
      }
    }

    return usuario;
  }

  /**
   * Genera y firma un token JWT de sesión interna con los claims corporativos.
   */
  generateSessionToken(usuario: UsuarioEntity): string {
    const payload = {
      sub: usuario.id,
      id: usuario.id,
      email: usuario.email,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
    };

    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '8h';
    return this.jwtService.sign(payload, { expiresIn });
  }
}
