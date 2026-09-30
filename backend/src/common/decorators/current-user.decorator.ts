import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioEntity } from '../../database/entities/usuario.entity';

/**
 * Decorador de parámetro para inyectar el usuario autenticado obtenido del token JWT
 * en los métodos de los controladores.
 * Permite obtener el objeto completo del usuario o un campo específico si se provee como argumento.
 *
 * @example
 * getProfile(@CurrentUser() user: UsuarioEntity)
 * getUserId(@CurrentUser('id') userId: string)
 * getUserEmail(@CurrentUser('email') email: string)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UsuarioEntity | string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    if (data && typeof data === 'string') {
      return user[data];
    }

    return user;
  },
);
