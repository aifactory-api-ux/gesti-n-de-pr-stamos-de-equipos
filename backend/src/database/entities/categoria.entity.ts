import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Entidad TypeORM que representa la tabla 'categorias'.
 * Clasifica los equipos y activos tecnológicos disponibles en Apiux
 * (por ejemplo: Notebook, Monitor, Accesorio).
 */
@Entity('categorias')
export class CategoriaEntity {
  @ApiProperty({
    description: 'Identificador único UUID de la categoría',
    format: 'uuid',
    example: 'd9b2d63d-a233-4123-8478-df6459345719',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Nombre descriptivo de la categoría de equipamiento',
    maxLength: 100,
    example: 'Notebook',
  })
  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada o especificaciones del tipo de activo',
    maxLength: 255,
    nullable: true,
    example: 'Equipos portátiles para desarrollo y gestión',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string;
}
