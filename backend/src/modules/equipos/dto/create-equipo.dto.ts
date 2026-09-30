import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { EstadoEquipo } from '../../../database/entities/equipo.entity';

/**
 * DTO para la creación de un nuevo equipo tecnológico en el inventario.
 */
export class CreateEquipoDto {
  @IsString({ message: 'El código de inventario debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código de inventario es requerido' })
  codigo_inventario: string;

  @IsUUID('4', { message: 'El ID de categoría debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'La categoría es requerida' })
  categoria_id: string;

  @IsString({ message: 'La marca debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La marca es requerida' })
  marca: string;

  @IsString({ message: 'El modelo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El modelo es requerido' })
  modelo: string;

  @IsString({ message: 'El número de serie debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de serie es requerido' })
  numero_serie: string;

  @IsOptional()
  @IsEnum(EstadoEquipo, {
    message: 'El estado debe ser disponible, prestado, en_mantencion o de_baja',
  })
  estado?: EstadoEquipo;
}
