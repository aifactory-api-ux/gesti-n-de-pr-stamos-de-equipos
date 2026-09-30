import { SetMetadata } from '@nestjs/common';

/**
 * Clave de metadatos utilizada por el reflector para identificar rutas públicas.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador que marca un endpoint o controlador como público, omitiendo la validación
 * obligatoria de token en guards de autenticación como AzureAuthGuard.
 *
 * @example
 * @Public()
 * @Post('sso-login')
 * ssoLogin() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
