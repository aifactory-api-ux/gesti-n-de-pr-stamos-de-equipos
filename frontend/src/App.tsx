import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { IPublicClientApplication, PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './config/authConfig';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import LoginSSO from './pages/01_Login_SSO';
import CatalogoEquipos from './pages/02_Catalogo_Equipos';
import PanelEncargado from './pages/03_Panel_Encargado';

/**
 * Instancia diferida de respaldo de MSAL Browser en caso de montaje directo sin props.
 */
let cachedFallbackPca: IPublicClientApplication | null = null;
const getFallbackPca = (): IPublicClientApplication => {
  if (!cachedFallbackPca) {
    cachedFallbackPca = new PublicClientApplication(msalConfig);
  }
  return cachedFallbackPca;
};

export interface AppProps {
  pca?: IPublicClientApplication;
}

/**
 * Componente raíz de la aplicación frontend de Préstamo de Equipos Apiux.
 * Provee los contextos globales de autenticación federada con Azure AD y enrutamiento SPA.
 */
export const App: React.FC<AppProps> = ({ pca }) => {
  const instance = pca || getFallbackPca();

  return (
    <MsalProvider instance={instance}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Pantalla 01: Inicio de sesión corporativo SSO */}
            <Route path="/" element={<LoginSSO />} />

            {/* Pantalla 02: Catálogo de Equipos (Colaborador y Administrador TI) */}
            <Route
              path="/catalogo"
              element={
                <ProtectedRoute allowedRoles={['colaborador', 'administrador_ti']}>
                  <CatalogoEquipos />
                </ProtectedRoute>
              }
            />

            {/* Pantalla 03: Consola Panel Encargado TI (Exclusivo Administrador TI) */}
            <Route
              path="/panel-encargado"
              element={
                <ProtectedRoute allowedRoles={['administrador_ti']}>
                  <PanelEncargado />
                </ProtectedRoute>
              }
            />

            {/* Redirección por defecto a raíz */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </MsalProvider>
  );
};

export default App;
