import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Estados permitidos para la resolución de una solicitud de préstamo por parte de TI.
 */
export enum EstadoResolucionSolicitud {
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
}

/**
 * DTO para la resolución (aprobación o rechazo) de una solicitud de préstamo por el administrador de TI.
 */
export class ResolverSolicitudDto {
  @ApiProperty({
    description: 'Estado de resolución de la solicitud (aprobada o rechazada)',
    enum: EstadoResolucionSolicitud,
    example: EstadoResolucionSolicitud.APROBADA,
  })
  @IsEnum(EstadoResolucionSolicitud, {
    message: 'El estado de resolución debe ser "aprobada" o "rechazada"',
  })
  @IsNotEmpty({ message: 'El estado de resolución es obligatorio' })
  estado: EstadoResolucionSolicitud;

  @ApiPropertyOptional({
    description: 'Días de duración asignados al préstamo al ser aprobado (por defecto 30 días)',
    minimum: 1,
    maximum: 90,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días de préstamo deben ser un número entero' })
  @Min(1, { message: 'El período mínimo de préstamo es de 1 día' })
  @Max(90, { message: 'El período máximo inicial de préstamo es de 90 días' })
  dias_prestamo?: number;

  @ApiPropertyOptional({
    description: 'Observaciones o justificación de la decisión tomada por el administrador de TI',
    example: 'Aprobado y entregado con cargador original y funda de protección',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  observaciones?: string;
}
