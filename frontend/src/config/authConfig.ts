import { Configuration, LogLevel, PopupRequest } from '@azure/msal-browser';

/**
 * Configuración de MSAL (Microsoft Authentication Library) para Microsoft Entra ID.
 * Implementa el flujo de autenticación corporativa SSO para colaboradores y administradores de Apiux.
 */

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '3f87b8f9-906d-495c-9db6-7cbdfa024cb5';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common';
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage', // 'sessionStorage' para mayor seguridad en sesiones corporativas
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL Error]:', message);
            return;
          case LogLevel.Warning:
            console.warn('[MSAL Warning]:', message);
            return;
          case LogLevel.Info:
            // Desactivar logs ruidosos en producción
            return;
          case LogLevel.Verbose:
            return;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/**
 * Scopes solicitados durante el inicio de sesión corporativo en Microsoft Entra ID.
 * Permite obtener el perfil básico y correo institucional @api-ux.com.
 */
export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};

export default msalConfig;
