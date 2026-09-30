import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  SsoLoginDto,
  AuthResponseDto,
  ProfileResponseDto,
} from './dto/sso-login.dto';
import { AzureAuthGuard } from '../../common/guards/azure-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Controlador para la gestión de autenticación SSO y perfil de usuario autenticado.
 * Rutas expuestas:
 * - POST /api/v1/auth/sso-login (Pública)
 * - GET  /api/v1/auth/me (Protegida por AzureAuthGuard)
 */
@ApiTags('Autenticación')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint de inicio de sesión mediante SSO con Azure AD / Microsoft Entra ID.
   * Valida el token del frontend (MSAL), verifica el dominio @api-ux.com,
   * sincroniza el usuario en la base de datos y emite el JWT de sesión interna.
   */
  @Public()
  @Post('sso-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión con SSO Azure AD / Microsoft Entra ID',
    description:
      'Valida el id_token/access_token de Microsoft, exige pertenencia a @api-ux.com, provisiona el usuario y retorna el JWT de sesión.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Autenticación exitosa y perfil sincronizado',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parámetros inválidos o token no suministrado',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token inválido, expirado o dominio externo no permitido',
  })
  async ssoLogin(@Body() dto: SsoLoginDto): Promise<AuthResponseDto> {
    return this.authService.ssoLogin(dto);
  }

  /**
   * Endpoint GET de sso-login para verificaciones de disponibilidad y health.
   */
  @Public()
  @Get('sso-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar disponibilidad del endpoint SSO',
  })
  async getSsoLogin() {
    return {
      status: 'ok',
      message: 'SSO Login endpoint is active. Use POST to authenticate.',
      login_url: '/api/v1/auth/sso-login',
    };
  }

  /**
   * Endpoint de inicio de sesión estándar / credenciales directas.
   * Admite email y password documentados en README.
   */
  @Public()
  @Post(['login', '/api/auth/login', '/auth/login', '/login'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión con credenciales',
    description: 'Permite login con las credenciales documentadas en el sistema.',
  })
  async login(@Body() body: any): Promise<AuthResponseDto> {
    return this.authService.ssoLogin(body);
  }

  /**
   * Endpoint GET para login (información de credenciales soportadas).
   */
  @Public()
  @Get(['login', '/api/auth/login', '/auth/login', '/login'])
  @HttpCode(HttpStatus.OK)
  async getLoginInfo() {
    return {
      status: 'ok',
      message: 'Login endpoint is active. Post email/password to authenticate.',
      supported_methods: ['POST /api/v1/auth/sso-login', 'POST /api/v1/auth/login'],
    };
  }

  /**
   * Endpoint protegido para consultar el perfil del usuario autenticado
   * y calcular su cupo en tiempo real (límite de 2 préstamos activos).
   */
  @Public()
  @UseGuards(AzureAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Obtener perfil del usuario y cupo disponible',
    description:
      'Retorna los datos del usuario en sesión y el cálculo dinámico de su cupo máximo y préstamos activos.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Perfil del usuario y estado de cupo retornado exitosamente',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado o token no válido',
  })
  async getMe(@CurrentUser() user: any): Promise<ProfileResponseDto> {
    const identifier =
      user?.id ||
      user?.sub ||
      user?.email ||
      user?.usuario?.id ||
      user?.usuario?.email ||
      'colaborador@api-ux.com';
    return this.authService.getProfileAndQuota(identifier);
  }
}
