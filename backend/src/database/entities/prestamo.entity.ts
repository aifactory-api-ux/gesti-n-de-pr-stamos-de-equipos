import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { SolicitudPrestamoEntity } from './solicitud_prestamo.entity';
import { UsuarioEntity } from './usuario.entity';
import { EquipoEntity } from './equipo.entity';

/**
 * Estados del préstamo formalizado de un equipo tecnológico.
 */
export enum EstadoPrestamo {
  ACTIVO = 'activo',
  DEVUELTO = 'devuelto',
  VENCIDO = 'vencido',
}

/**
 * Entidad TypeORM que representa la tabla 'prestamos'.
 * Formaliza la entrega de un equipo a un colaborador tras la aprobación de TI,
 * gestiona los plazos de vencimiento, renovaciones y el registro de la devolución.
 */
@Entity('prestamos')
export class PrestamoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  solicitud_id: string;

  @OneToOne(() => SolicitudPrestamoEntity)
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: SolicitudPrestamoEntity;

  @Column({ type: 'uuid' })
  usuario_id: string;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @Column({ type: 'uuid' })
  equipo_id: string;

  @ManyToOne(() => EquipoEntity)
  @JoinColumn({ name: 'equipo_id' })
  equipo: EquipoEntity;

  @Column({ type: 'uuid' })
  encargado_entrega_id: string;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'encargado_entrega_id' })
  encargado_entrega: UsuarioEntity;

  @Column({ type: 'uuid', nullable: true })
  encargado_devolucion_id: string | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'encargado_devolucion_id' })
  encargado_devolucion: UsuarioEntity | null;

  @Column({ type: 'timestamp with time zone' })
  fecha_inicio: Date;

  @Column({ type: 'timestamp with time zone' })
  fecha_vencimiento: Date;

  @Column({ type: 'boolean', default: false })
  renovado: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_devolucion: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'activo' })
  estado: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;
}
