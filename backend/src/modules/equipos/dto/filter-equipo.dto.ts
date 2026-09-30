import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoEquipo } from '../../../database/entities/equipo.entity';

/**
 * DTO para los parámetros de búsqueda, filtrado y paginación del inventario de equipos.
 */
export class FilterEquipoDto {
  @ApiPropertyOptional({
    description: 'Término de búsqueda libre por código de inventario, marca, modelo o número de serie',
    type: String,
    example: 'ThinkPad',
  })
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Identificador único UUID de la categoría asociada',
    type: String,
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El ID de categoría debe ser un UUID v4 válido' })
  categoria_id?: string;

  @ApiPropertyOptional({
    description: 'Estado operativo del equipo',
    enum: EstadoEquipo,
    example: EstadoEquipo.DISPONIBLE,
  })
  @IsOptional()
  @IsEnum(EstadoEquipo, {
    message: 'El estado debe ser disponible, prestado, en_mantencion o de_baja',
  })
  estado?: EstadoEquipo;

  @ApiPropertyOptional({
    description: 'Número de página para la paginación',
    type: Number,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de registros por página',
    type: Number,
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
