import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Laptop,
  ShieldCheck,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * Logotipo corporativo de 4 cuadrantes de Microsoft según directrices de marca oficiales.
 */
const MicrosoftIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 21 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

/**
 * Pantalla 01: Inicio de Sesión Corporativo SSO (Microsoft Entra ID).
 * Implementación 1:1 basada en Figma (1440x900, nodo 3:2):
 * - Hero visual corporativo (#0B2F6B, 108px) con identidad Apiux e insignia ISO 27001
 * - Área central de autenticación (#F4F7FB) con tarjeta de acceso corporativo (410px-480px)
 * - Botón SSO con cuadrantes Microsoft y spinner interactivo
 * - Footer corporativo de políticas y auditoría de 5 años (#FFFFFF, 75px)
 */
export const LoginSSO: React.FC = () => {
  const { usuario, loading: authLoading, error: authContextError, loginWithAzureSSO } = useAuth();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirección automática si el usuario ya cuenta con sesión corporativa activa
  useEffect(() => {
    if (!authLoading && usuario) {
      if (usuario.rol === 'administrador_ti') {
        navigate('/panel-encargado', { replace: true });
      } else {
        navigate('/catalogo', { replace: true });
      }
    }
  }, [usuario, authLoading, navigate]);

  const handleMicrosoftLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await loginWithAzureSSO();
      // La redirección ocurrirá automáticamente por el useEffect al actualizar 'usuario'
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'No se pudo completar el inicio de sesión con Microsoft Entra ID. Verifica tus credenciales.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = authLoading || isSubmitting;
  const displayError = errorMessage || authContextError;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FB] text-[#102A56] font-sans antialiased selection:bg-blue-100 selection:text-[#0B2F6B]">
      {/* =========================================================================
          1. HERO VISUAL CORPORATIVO (Figma: height 108px, fill #0B2F6B)
          ========================================================================= */}
      <header className="w-full h-[108px] bg-[#0B2F6B] text-white shadow-md border-b border-blue-900/40 flex items-center shrink-0">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Identidad de marca Apiux */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Laptop className="w-6 h-6 text-blue-200" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white leading-tight">
                  APIUX
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  TI
                </span>
              </div>
              <span className="text-xs text-blue-200 font-normal tracking-wide">
                Gestión de Préstamos de Equipos
              </span>
            </div>
          </div>

          {/* Insignia de seguridad corporativa */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-blue-100 backdrop-blur-sm shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>ISO 27001 · Acceso Seguro Azure AD</span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. ÁREA DE AUTENTICACIÓN (Figma: height ~717px, fill #F4F7FB)
          ========================================================================= */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-[440px] flex flex-col items-center">
          {/* Introducción del portal */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#102A56] tracking-tight">
              Portal de Autoservicio TI
            </h1>
            <p className="mt-2 text-sm text-[#58708F] max-w-sm mx-auto leading-relaxed">
              Préstamo y devolución de notebooks, monitores y accesorios
            </p>
          </div>

          {/* Tarjeta SSO de acceso corporativo */}
          <div className="w-full bg-white rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-6 sm:p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#0B2F6B]/10 flex items-center justify-center text-[#0B2F6B]">
                  <Lock className="w-4 h-4 text-[#0B2F6B]" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold text-[#102A56]">
                  Acceso Corporativo
                </h2>
              </div>
              <p className="text-xs text-[#58708F] leading-relaxed">
                Accede con tu cuenta institucional de Microsoft (<span className="font-semibold text-slate-700">@apiux.com</span>) para solicitar notebooks, monitores y accesorios.
              </p>
            </div>

            {/* Notificación de error si ocurre */}
            {displayError && (
              <div
                className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2.5 animate-fadeIn"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="leading-relaxed">{displayError}</span>
              </div>
            )}

            {/* Botón interactivo de inicio de sesión SSO con Microsoft */}
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className="w-full h-12 flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 active:bg-slate-100 text-[#102A56] font-semibold text-sm shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed select-none group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#0B2F6B]" aria-hidden="true" />
                  <span className="text-[#0B2F6B]">Autenticando con Microsoft Entra ID...</span>
                </>
              ) : (
                <>
                  <MicrosoftIcon className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  <span>Iniciar sesión con Microsoft</span>
                </>
              )}
            </button>

            {/* Separador con etiqueta de dominio exclusivo */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-[#E2E8F0]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-white px-3 font-semibold text-[#6A7F99]">
                  EXCLUSIVO @API-UX.COM
                </span>
              </div>
            </div>

            {/* Características de seguridad */}
            <div className="space-y-2.5 text-xs text-[#58708F] bg-[#F8FAFC] p-3.5 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Autenticación federada SSO OAuth2 / OIDC</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Restringido a colaboradores autorizados</span>
              </div>
            </div>

            {/* Soporte técnico de TI */}
            <div className="mt-6 pt-4 border-t border-[#E2E8F0] text-center">
              <p className="text-xs text-[#58708F]">
                ¿Tienes problemas para ingresar? Contacta a soporte TI:{' '}
                <a
                  href="mailto:soporte@apiux.com"
                  className="text-[#0B2F6B] font-semibold hover:underline"
                >
                  soporte@apiux.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          3. POLÍTICA Y FOOTER CORPORATIVO (Figma: height 75px, fill #FFFFFF, border-t)
          ========================================================================= */}
      <footer className="w-full min-h-[75px] bg-white border-t border-[#E2E8F0] text-[#6A7F99] py-4 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          {/* Política de uso interno y auditoría */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-1 sm:gap-2 text-center sm:text-left">
            <span className="font-semibold text-[#102A56]">
              Política de Uso y Responsabilidad de Equipos:
            </span>
            <span>
              Uso exclusivo para colaboradores autorizados de Apiux SpA. Las acciones quedan registradas en auditoría inmutable por 5 años.
            </span>
          </div>

          {/* Metadatos técnicos */}
          <div className="flex items-center gap-3 shrink-0 text-slate-500 font-medium">
            <span>Apiux TI · Sistema de Gestión de Préstamos v1.0</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span className="hidden sm:inline">Microsoft Entra ID · GCP Cloud Run</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LoginSSO;
