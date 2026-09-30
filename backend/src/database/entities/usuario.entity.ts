import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Roles disponibles en el sistema según especificación y esquema relacional.
 */
export enum RolUsuario {
  COLABORADOR = 'colaborador',
  ADMINISTRADOR_TI = 'administrador_ti',
}

/**
 * Estados del usuario corporativo en la plataforma.
 */
export enum EstadoUsuario {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

/**
 * Entidad TypeORM que representa la tabla 'usuarios'.
 * Mapea los colaboradores y administradores de TI sincronizados vía Azure AD.
 */
@Entity('usuarios')
export class UsuarioEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  nombre_completo: string;

  @Column({ type: 'varchar', length: 50, default: 'colaborador' })
  rol: string;

  @Column({ type: 'varchar', length: 50, default: 'activo' })
  estado: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  creado_en: Date;
}
