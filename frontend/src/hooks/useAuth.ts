import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../context/AuthContext';

/**
 * Hook de autenticación que expone el estado de sesión, usuario, rol y utilidades
 * de inicio y cierre de sesión corporativa mediante SSO con Microsoft Entra ID.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}

export default useAuth;
