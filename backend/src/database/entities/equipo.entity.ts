import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CategoriaEntity } from './categoria.entity';

/**
 * Estados del inventario físico y operativo de un equipo tecnológico.
 */
export enum EstadoEquipo {
  DISPONIBLE = 'disponible',
  PRESTADO = 'prestado',
  EN_MANTENCION = 'en_mantencion',
  DE_BAJA = 'de_baja',
}

/**
 * Entidad TypeORM que representa la tabla 'equipos'.
 * Almacena los activos tecnológicos de la empresa (notebooks, monitores, periféricos)
 * sujetos a control de inventario, préstamos y trazabilidad.
 */
@Entity('equipos')
export class EquipoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  codigo_inventario: string;

  @Column({ type: 'uuid' })
  categoria_id: string;

  @ManyToOne(() => CategoriaEntity, { eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: CategoriaEntity;

  @Column({ type: 'varchar', length: 100 })
  marca: string;

  @Column({ type: 'varchar', length: 100 })
  modelo: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  numero_serie: string;

  @Column({ type: 'varchar', length: 50, default: 'disponible' })
  estado: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  creado_en: Date;
}
