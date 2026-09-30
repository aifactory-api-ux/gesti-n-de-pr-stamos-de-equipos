import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para la creación de una nueva solicitud de préstamo de equipo tecnológico.
 */
export class CreateSolicitudDto {
  @ApiProperty({
    description: 'Identificador único UUID del equipo solicitado',
    example: 'a0000000-0000-0000-0000-000000000001',
  })
  @IsUUID('4', { message: 'El ID del equipo debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El ID del equipo es requerido' })
  equipo_id: string;

  @ApiProperty({
    description: 'Justificación o motivo de la solicitud de préstamo del equipo',
    maxLength: 500,
    example: 'Requerido para proyecto de desarrollo de software institucional Apiux',
  })
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo de la solicitud es requerido' })
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
  motivo: string;

  @ApiPropertyOptional({
    description: 'Días solicitados de préstamo (por defecto 30 días, máximo 30 días)',
    minimum: 1,
    maximum: 30,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días solicitados deben ser un número entero' })
  @Min(1, { message: 'El período mínimo de préstamo es de 1 día' })
  @Max(30, { message: 'El período máximo de préstamo es de 30 días' })
  dias_solicitados?: number;
}
