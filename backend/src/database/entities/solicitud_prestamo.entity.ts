import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UsuarioEntity } from './usuario.entity';
import { EquipoEntity } from './equipo.entity';

/**
 * Estados del flujo de vida de una solicitud de préstamo de equipo.
 */
export enum EstadoSolicitud {
  PENDIENTE = 'pendiente',
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
}

/**
 * Entidad TypeORM que representa la tabla 'solicitudes_prestamo'.
 * Registra las peticiones de colaboradores para requerir temporalmente
 * un equipo disponible en el catálogo de activos corporativos.
 */
@Entity('solicitudes_prestamo')
export class SolicitudPrestamoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'varchar', length: 50, default: 'pendiente' })
  estado: string;

  @Column({ type: 'varchar', length: 500 })
  motivo: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  fecha_solicitud: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_resolucion: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resuelto_por: string | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'resuelto_por' })
  resolutor: UsuarioEntity | null;
}
