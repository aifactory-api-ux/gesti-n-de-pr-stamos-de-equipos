import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { RolUsuario } from '../../types';
import { Loader2 } from 'lucide-react';

export interface ProtectedRouteProps {
  allowedRoles?: RolUsuario[];
  children?: React.ReactNode;
}

/**
 * Componente Guard de navegación para rutas protegidas en React Router.
 * Comprueba que el usuario mantenga una sesión corporativa válida y posea los roles requeridos.
 * - Si no está autenticado, redirige inmediatamente a la raíz '/' (SSO Login).
 * - Si no posee el rol autorizado, redirige a su pantalla principal correspondiente.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { usuario, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B2F6B]" aria-hidden="true" />
          <p className="text-sm font-medium text-[#58708F]">
            Verificando credenciales corporativas...
          </p>
        </div>
      </div>
    );
  }

  // Redirigir a login de inmediato si no hay usuario en sesión
  if (!usuario) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Validar rol de usuario si la ruta exige roles específicos
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(usuario.rol)) {
    // Si un colaborador intenta entrar a administración, llevarlo al catálogo
    // Si un administrador entra a otra ruta restringida, enviarlo a su panel
    const defaultRedirect =
      usuario.rol === 'administrador_ti' ? '/panel-encargado' : '/catalogo';
    return <Navigate to={defaultRedirect} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
