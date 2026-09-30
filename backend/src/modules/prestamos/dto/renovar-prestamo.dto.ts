import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para la solicitud de extensión o renovación de un préstamo activo de equipo tecnológico.
 */
export class RenovarPrestamoDto {
  @ApiPropertyOptional({
    description: 'Días adicionales de extensión del préstamo (máximo 30 días adicionales)',
    minimum: 1,
    maximum: 30,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días de extensión deben ser un número entero' })
  @Min(1, { message: 'El período mínimo de renovación es de 1 día' })
  @Max(30, { message: 'El período máximo de renovación es de 30 días adicionales' })
  dias_extension?: number = 30;

  @ApiPropertyOptional({
    description: 'Motivo o justificación de la renovación del préstamo',
    example: 'Continuidad de requerimiento en proyecto de desarrollo institucional Apiux',
  })
  @IsOptional()
  @IsString({ message: 'El motivo de renovación debe ser una cadena de texto' })
  observaciones?: string;

  @ApiPropertyOptional({
    description: 'Motivo de la renovación (alias para observaciones)',
    example: 'Extensión de sprint de soporte en cliente',
  })
  @IsOptional()
  @IsString({ message: 'El motivo de renovación debe ser una cadena de texto' })
  motivo_renovacion?: string;
}
