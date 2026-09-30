import React from 'react';
import ReactDOM from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './config/authConfig';
import App from './App';
import './styles/index.css';

/**
 * Instancia global de Microsoft Authentication Library (MSAL Browser v3).
 */
export const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Inicialización asíncrona de MSAL y montaje de la aplicación en el DOM raíz.
 */
export async function initializeApp(): Promise<void> {
  try {
    await msalInstance.initialize();

    // Procesar respuesta de redirección si aplica
    await msalInstance.handleRedirectPromise().catch((error) => {
      console.error('[MSAL handleRedirectPromise Error]:', error);
    });
  } catch (initError) {
    console.error('[MSAL Initialize Error]:', initError);
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Elemento #root no encontrado en el documento HTML');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App pca={msalInstance} />
    </React.StrictMode>
  );
}

// Iniciar aplicación
initializeApp();

export default initializeApp;
