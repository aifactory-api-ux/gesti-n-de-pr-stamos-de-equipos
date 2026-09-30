import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Laptop, User, ShieldCheck } from 'lucide-react';
import { Usuario } from '../../types';

export interface AppNavbarProps {
  usuario: Usuario | null;
  activePath: string;
  onLogout: () => void;
}

interface NavItem {
  name: string;
  path: string;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  usuario,
  activePath,
  onLogout,
}) => {
  const isAdmin = usuario?.rol === 'administrador_ti';

  // Barra con tono navAdmin (#0E295C) para Administrador TI y navDark (#0E2045) para Colaborador
  const navBg = isAdmin ? 'bg-[#0E295C]' : 'bg-[#0E2045]';

  const navItems: NavItem[] = isAdmin
    ? [
        { name: 'Panel Encargado TI', path: '/panel-encargado' },
        { name: 'Inventario', path: '/inventario' },
        { name: 'Auditoría', path: '/auditoria' },
      ]
    : [
        { name: 'Catálogo', path: '/catalogo' },
        { name: 'Mis Préstamos', path: '/mis-prestamos' },
      ];

  const getInitials = (name?: string): string => {
    if (!name) return 'U';
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header
      className={`w-full ${navBg} text-white shadow-md border-b border-white/10 transition-colors duration-200 z-40`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[76px] flex items-center justify-between gap-4">
        {/* Marca institucional e identidad de marca Apiux */}
        <div className="flex items-center gap-8">
          <Link
            to={isAdmin ? '/panel-encargado' : '/catalogo'}
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg p-1"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0B2F6B] border border-blue-400/30 flex items-center justify-center text-white shadow-inner group-hover:bg-[#082352] transition-colors">
              <Laptop className="w-5 h-5 text-blue-300" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 leading-tight">
                APIUX
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/20">
                  TI
                </span>
              </span>
              <span className="text-xs text-slate-300 font-normal tracking-wide">
                Préstamo de Equipos
              </span>
            </div>
          </Link>

          {/* Menú de navegación principal contextualizado por rol */}
          <nav
            className="hidden md:flex items-center gap-1.5"
            aria-label="Navegación principal"
          >
            {navItems.map((item) => {
              const isActive =
                activePath === item.path ||
                (item.path !== '/' && activePath.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/20'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sección de perfil de usuario y cierre de sesión seguro */}
        <div className="flex items-center gap-3 sm:gap-4">
          {usuario ? (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
              {/* Avatar con iniciales */}
              <div
                className="w-8 h-8 rounded-full bg-blue-600/40 border border-blue-400/30 flex items-center justify-center text-xs font-semibold text-white shrink-0"
                title={usuario.nombre_completo}
              >
                {getInitials(usuario.nombre_completo)}
              </div>

              {/* Información y rol */}
              <div className="hidden sm:flex flex-col text-left leading-none">
                <span className="text-xs font-medium text-white truncate max-w-[160px]">
                  {usuario.nombre_completo}
                </span>
                <div className="mt-1 flex items-center gap-1">
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                      Administrador TI
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-200 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/30">
                      <User className="w-3 h-3 text-blue-300" />
                      Colaborador
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center text-xs text-slate-300">
              <span>No autenticado</span>
            </div>
          )}

          {/* Botón de cierre de sesión */}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            title="Cerrar sesión corporativa"
            aria-label="Cerrar sesión corporativa"
          >
            <LogOut className="w-4 h-4 text-slate-300" aria-hidden="true" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppNavbar;
