import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/authConfig';
import {
  apiClient,
  setAuthToken,
  getAuthToken,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from '../config/api';
import {
  Usuario,
  CollaboratorQuota,
  AuthResponse,
  RolUsuario,
  EstadoUsuario,
} from '../types';

export interface ProfileResponse {
  id: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  creado_en: string;
  usuario?: Usuario;
  quota?: CollaboratorQuota;
}

export interface AuthContextType {
  usuario: Usuario | null;
  quota: CollaboratorQuota | null;
  loading: boolean;
  error: string | null;
  loginWithAzureSSO: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { instance } = useMsal();
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [quota, setQuota] = useState<CollaboratorQuota | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useMemo(() => usuario?.rol === 'administrador_ti', [usuario]);

  /**
   * Refresca los datos del usuario en sesión y calcula en tiempo real su cupo de préstamos.
   */
  const refreshProfile = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUsuario(null);
      setQuota(null);
      return;
    }

    try {
      const res = await apiClient.get<ProfileResponse>('/api/v1/auth/me');
      const data = res.data;

      const userProfile: Usuario = data.usuario || {
        id: data.id,
        email: data.email,
        nombre_completo: data.nombre_completo,
        rol: data.rol,
        estado: data.estado,
        creado_en: data.creado_en,
      };

      setUsuario(userProfile);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userProfile));

      if (data.quota) {
        setQuota(data.quota);
      }
    } catch (err: any) {
      // Si el backend responde 401, el interceptor de api.ts ya limpia storage
      if (err?.response?.status === 401) {
        setUsuario(null);
        setQuota(null);
      }
    }
  }, []);

  /**
   * Ejecuta el flujo SSO con Microsoft Entra ID usando MSAL popup.
   * Envía el id_token/access_token al backend para validar dominio @api-ux.com,
   * aprovisionar el usuario y obtener el token JWT interno de sesión.
   */
  const loginWithAzureSSO = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Abrir diálogo interactivo MSAL para inicio de sesión corporativo
      const msalResponse = await instance.loginPopup(loginRequest);

      const rawToken = msalResponse.idToken || msalResponse.accessToken;
      if (!rawToken) {
        throw new Error('No se recibió un token de Microsoft válido.');
      }

      // 2. Intercambiar token de Microsoft por token de sesión en el backend
      const res = await apiClient.post<AuthResponse>('/api/v1/auth/sso-login', {
        id_token: msalResponse.idToken,
        access_token: msalResponse.accessToken,
        token: rawToken,
      });

      const { token, usuario: userFromApi } = res.data;

      // 3. Persistir sesión
      setAuthToken(token);
      setUsuario(userFromApi);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userFromApi));

      // 4. Actualizar perfil y cupo en tiempo real
      await refreshProfile();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Error durante el inicio de sesión con Microsoft Entra ID';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [instance, refreshProfile]);

  /**
   * Cierra la sesión activa en la aplicación y en Microsoft Entra ID.
   */
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setAuthToken(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUsuario(null);
      setQuota(null);

      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        await instance.logoutPopup({
          account: accounts[0],
          postLogoutRedirectUri: window.location.origin,
        });
      }
    } catch (err) {
      console.warn('[MSAL Logout]:', err);
    } finally {
      setLoading(false);
    }
  }, [instance]);

  /**
   * Sincronización inicial al montar el componente: verificar token activo
   * y escuchar eventos de expiración emitidos por api.ts.
   */
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        await refreshProfile();
      }
      setLoading(false);
    };

    initAuth();

    const handleExpired = () => {
      setUsuario(null);
      setQuota(null);
      setError('Tu sesión corporativa ha expirado. Por favor, ingresa nuevamente.');
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => {
      window.removeEventListener('auth:expired', handleExpired);
    };
  }, [refreshProfile]);

  const value: AuthContextType = useMemo(
    () => ({
      usuario,
      quota,
      loading,
      error,
      loginWithAzureSSO,
      logout,
      isAdmin,
      refreshProfile,
    }),
    [
      usuario,
      quota,
      loading,
      error,
      loginWithAzureSSO,
      logout,
      isAdmin,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook exportado directamente desde el contexto para compatibilidad de importaciones
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}

export default AuthProvider;
