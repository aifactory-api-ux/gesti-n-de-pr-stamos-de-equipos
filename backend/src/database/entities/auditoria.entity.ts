import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UsuarioEntity } from './usuario.entity';

/**
 * Entidad TypeORM que representa la tabla 'auditoria'.
 * Almacena de manera inmutable cada operación de mutación (creación, aprobación,
 * entrega, devolución, renovación) con snapshots de datos en formato JSONB.
 */
@Entity('auditoria')
export class AuditoriaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  tabla_afectada: string;

  @Column({ type: 'uuid' })
  registro_id: string;

  @Column({ type: 'varchar', length: 50 })
  accion: string;

  @Column({ type: 'jsonb', nullable: true })
  datos_anteriores: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  datos_nuevos: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  usuario_id: string | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  fecha_evento: Date;

  @Column({ type: 'varchar', length: 45 })
  direccion_ip: string;
}
