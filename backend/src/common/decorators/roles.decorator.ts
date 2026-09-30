import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../database/entities/usuario.entity';

/**
 * Clave de metadatos utilizada para almacenar y recuperar los roles asignados a rutas o controladores.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador de roles para restringir el acceso a rutas según el rol del usuario autenticado.
 * Soporta valores del enum RolUsuario ('colaborador', 'administrador_ti') o cadenas equivalentes.
 *
 * @param roles Lista de roles con permiso para ejecutar la operación.
 * @example
 * @Roles(RolUsuario.ADMINISTRADOR_TI)
 * @Roles('administrador_ti')
 */
export const Roles = (...roles: (RolUsuario | string)[]) => SetMetadata(ROLES_KEY, roles);
