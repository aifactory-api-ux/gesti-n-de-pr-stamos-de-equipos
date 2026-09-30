import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para la consulta y filtrado de la bitácora inmutable de auditoría institucional.
 * Permite filtrar por entidad/tabla, identificador de registro, usuario actor, rango de fechas y paginación.
 */
export class QueryAuditoriaDto {
  @ApiPropertyOptional({
    description:
      'Nombre de la tabla de base de datos auditada (ej. prestamos, solicitudes_prestamo, equipos, categorias, usuarios)',
    example: 'prestamos',
  })
  @IsOptional()
  @IsString({ message: 'La tabla afectada debe ser una cadena de texto' })
  tabla_afectada?: string;

  @ApiPropertyOptional({
    description: 'Alias alternativo para la entidad/tabla auditada',
    example: 'solicitudes_prestamo',
  })
  @IsOptional()
  @IsString({ message: 'La entidad debe ser una cadena de texto' })
  entidad?: string;

  @ApiPropertyOptional({
    description: 'Identificador UUID del registro auditado',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El ID de registro debe ser un UUID v4 válido' })
  registro_id?: string;

  @ApiPropertyOptional({
    description: 'Identificador UUID del usuario que ejecutó la acción auditada',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El ID de usuario debe ser un UUID v4 válido' })
  usuario_id?: string;

  @ApiPropertyOptional({
    description:
      'Tipo o nombre de la acción auditada (ej. APROBAR_PRESTAMO, CREAR_SOLICITUD, REGISTRAR_DEVOLUCION)',
    example: 'APROBAR_PRESTAMO',
  })
  @IsOptional()
  @IsString({ message: 'La acción debe ser una cadena de texto' })
  accion?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial para filtrar eventos de auditoría (formato ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fecha_desde debe ser una fecha en formato ISO 8601 válido' })
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha final para filtrar eventos de auditoría (formato ISO 8601)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fecha_hasta debe ser una fecha en formato ISO 8601 válido' })
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Número de página para paginación (comienza en 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página (máximo 100)',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo por página es 100' })
  limit?: number = 10;
}
