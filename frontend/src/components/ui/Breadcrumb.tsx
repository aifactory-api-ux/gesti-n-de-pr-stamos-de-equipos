import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  showHome = true,
  homeHref = '/',
  className = '',
}) => {
  return (
    <nav aria-label="Ruta de navegación" className={`flex items-center text-xs text-[#58708F] ${className}`}>
      <ol className="inline-flex items-center space-x-1.5 md:space-x-2">
        {showHome && (
          <li className="inline-flex items-center">
            <Link
              to={homeHref}
              className="inline-flex items-center text-[#58708F] hover:text-[#0B2F6B] transition-colors"
              title="Inicio"
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="inline-flex items-center">
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 mx-1 shrink-0" aria-hidden="true" />
              {isLast ? (
                <span className="font-semibold text-[#102A56] truncate max-w-[200px]" aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  to={item.href}
                  className="hover:text-[#0B2F6B] transition-colors truncate max-w-[150px]"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-[#0B2F6B] transition-colors truncate max-w-[150px] text-left"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
