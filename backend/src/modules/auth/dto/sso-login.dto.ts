import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Data Transfer Object para la autenticación vía Single Sign-On (SSO)
 * con Microsoft Azure AD / Entra ID.
 */
export class SsoLoginDto {
  @ApiPropertyOptional({
    description: 'ID Token JWT emitido por Microsoft Entra ID (Azure AD)',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6In...',
  })
  @IsOptional()
  @IsString({ message: 'El id_token debe ser una cadena de texto válida' })
  id_token?: string;

  @ApiPropertyOptional({
    description: 'Access Token emitido por Microsoft Entra ID (Azure AD)',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6In...',
  })
  @IsOptional()
  @IsString({ message: 'El access_token debe ser una cadena de texto válida' })
  access_token?: string;

  @ApiPropertyOptional({
    description: 'Token JWT genérico o alternativo emitido por Azure AD',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6In...',
  })
  @IsOptional()
  @IsString({ message: 'El token debe ser una cadena de texto válida' })
  token?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico corporativo para inicio de sesión directo o simulado',
    example: 'colaborador@api-ux.com',
  })
  @IsOptional()
  @IsString({ message: 'El correo debe ser una cadena de texto válida' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Nombre de usuario alternativo',
    example: 'admin.ti@apiux.com',
  })
  @IsOptional()
  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto válida' })
  username?: string;

  @ApiPropertyOptional({
    description: 'Contraseña de acceso para login con credenciales documentadas',
    example: 'password123',
  })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto válida' })
  password?: string;
}

/**
 * Representación simplificada del usuario para respuestas de autenticación.
 */
export class UsuarioDto {
  @ApiProperty({ description: 'Identificador único UUID del usuario' })
  id: string;

  @ApiProperty({ description: 'Correo electrónico corporativo (@api-ux.com)' })
  email: string;

  @ApiProperty({ description: 'Nombre completo del colaborador' })
  nombre_completo: string;

  @ApiProperty({ description: 'Rol asignado en el sistema', enum: ['colaborador', 'administrador_ti'] })
  rol: string;

  @ApiProperty({ description: 'Estado actual de la cuenta', enum: ['activo', 'inactivo'] })
  estado: string;

  @ApiProperty({ description: 'Fecha y hora de creación del registro' })
  creado_en: Date | string;
}

/**
 * DTO de respuesta para login exitoso mediante SSO.
 */
export class AuthResponseDto {
  @ApiProperty({ description: 'Token JWT interno emitido para la sesión de la aplicación' })
  token: string;

  @ApiProperty({ description: 'Token de acceso Bearer (alias)' })
  access_token: string;

  @ApiProperty({ description: 'Datos del usuario autenticado y sincronizado', type: () => UsuarioDto })
  usuario: UsuarioDto;
}

/**
 * DTO que detalla el cupo y límite de préstamos simultáneos del colaborador.
 */
export class CollaboratorQuotaDto {
  @ApiProperty({ description: 'Número actual de préstamos activos formalizados' })
  prestamos_activos_count: number;

  @ApiProperty({ description: 'Cupo máximo permitido por política corporativa (2)' })
  cupo_maximo: number;

  @ApiProperty({ description: 'Cupo restante disponible para nuevas solicitudes' })
  cupo_restante: number;

  @ApiProperty({ description: 'Indica si el usuario tiene capacidad para solicitar nuevos préstamos' })
  puede_solicitar: boolean;
}

/**
 * DTO de respuesta para GET /api/v1/auth/me con compatibilidad dual para contratos de API.
 */
export class ProfileResponseDto {
  @ApiProperty({ description: 'Identificador único UUID del usuario' })
  id: string;

  @ApiProperty({ description: 'Correo corporativo' })
  email: string;

  @ApiProperty({ description: 'Nombre completo' })
  nombre_completo: string;

  @ApiProperty({ description: 'Rol del usuario' })
  rol: string;

  @ApiProperty({ description: 'Estado de la cuenta' })
  estado: string;

  @ApiProperty({ description: 'Fecha de creación' })
  creado_en: Date | string;

  @ApiProperty({ description: 'Objeto de usuario anidado (compatibilidad frontend)', type: () => UsuarioDto })
  usuario: UsuarioDto;

  @ApiProperty({ description: 'Cálculo de cupo de préstamos en tiempo real', type: () => CollaboratorQuotaDto })
  quota: CollaboratorQuotaDto;
}
