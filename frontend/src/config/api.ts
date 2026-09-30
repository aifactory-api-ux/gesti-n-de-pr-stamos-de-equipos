import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Storage keys para persistencia de credenciales de sesión en el cliente.
 */
export const TOKEN_STORAGE_KEY = 'apiux_token';
export const USER_STORAGE_KEY = 'apiux_usuario';

/**
 * Instancia centralizada de Axios para la comunicación con la API REST del backend.
 * Utiliza rutas relativas exclusivamente (ej: /api/v1/...) para respetar los proxies
 * de desarrollo (Vite) y de producción corporativa (Nginx / Cloud Run).
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

/**
 * Interceptor de solicitud: Inyecta el token Bearer JWT desde storage en el header Authorization.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem(TOKEN_STORAGE_KEY);

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Interceptor de respuesta: Detecta error 401 (token expirado o no autorizado),
 * limpia el almacenamiento local y despacha el evento global 'auth:expired' para
 * sincronizar el AuthContext y forzar redirección al SSO login.
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);

      // Notificar al contexto de autenticación en la app
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Helper para almacenar el token de sesión.
 */
export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

/**
 * Helper para recuperar el token de sesión activo.
 */
export const getAuthToken = (): string | null => {
  return (
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  );
};

export default apiClient;
