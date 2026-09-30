import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolUsuario } from '../../database/entities/usuario.entity';

/**
 * Guard de control de acceso basado en roles (RBAC).
 * Verifica que el usuario autenticado cuente con alguno de los roles permitidos
 * especificados en el decorador @Roles().
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(RolUsuario | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si el endpoint o controlador no define roles específicos, se permite el acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.rol) {
      throw new ForbiddenException(
        'Acceso denegado: usuario no autenticado o sin rol asignado',
      );
    }

    const userRoleLower = String(user.rol).toLowerCase();
    const hasRole = requiredRoles.some(
      (role) => String(role).toLowerCase() === userRoleLower,
    );

    if (!hasRole) {
      throw new ForbiddenException(
        'Acceso denegado: no posee los permisos requeridos para esta acción',
      );
    }

    return true;
  }
}
