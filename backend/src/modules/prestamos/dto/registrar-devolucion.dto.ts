import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoEquipo } from '../../../database/entities/equipo.entity';

/**
 * DTO para el registro de la devolución física de un equipo tecnológico en préstamo.
 */
export class RegistrarDevolucionDto {
  @ApiPropertyOptional({
    description: 'Estado físico u operativo en que se reintegra el equipo al inventario',
    enum: EstadoEquipo,
    default: EstadoEquipo.DISPONIBLE,
    example: EstadoEquipo.DISPONIBLE,
  })
  @IsOptional()
  @IsEnum(EstadoEquipo, {
    message: 'El estado físico debe ser disponible, en_mantencion o de_baja',
  })
  estado_fisico_equipo?: EstadoEquipo = EstadoEquipo.DISPONIBLE;

  @ApiPropertyOptional({
    description: 'Observaciones sobre el estado físico de entrega, accesorios devueltos o incidencias',
    example: 'Devuelto en perfectas condiciones operativas con su respectivo cargador y adaptador HDMI',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  observaciones?: string;
}
