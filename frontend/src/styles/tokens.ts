/**
 * Tokens de diseño del sistema institucional Apiux.
 * Fuente de verdad: Contrato UI/UX de Figma y especificación técnica de arquitectura.
 */

export const tokens = {
  colors: {
    primary: '#0B2F6B', // Hero Visual corporativo & buttons
    primaryHover: '#082352',
    navDark: '#0E2045', // Colaborador navbar fill
    navAdmin: '#0E295C', // Panel Encargado navbar fill
    cardHeader: '#102A56', // Brand title text
    textPrimary: '#102A56', // High-contrast primary corporate navy
    textSecondary: '#58708F', // Subtitle text
    textMuted: '#6A7F99', // Eyebrow and metadata text
    background: '#F4F7FB', // Login background
    bgCatalog: '#F6F9FC', // Catalog background
    bgAdmin: '#F5F7FC', // Admin panel background
    surfaceWhite: '#FFFFFF', // Cards, tables, modals
    accentLight: '#E8F2FF', // Loan confirmation banner
    accentLightAdmin: '#EDF5FF', // Admin return confirmation modal
    borderLight: '#E2E8F0',
    borderFocus: '#2563EB',
    status: {
      disponible: {
        bg: '#ECFDF5',
        text: '#065F46',
        border: '#A7F3D0',
        dot: '#10B981',
      },
      prestado: {
        bg: '#FEF3C7',
        text: '#92400E',
        border: '#FDE68A',
        dot: '#F59E0B',
      },
      pendiente: {
        bg: '#EFF6FF',
        text: '#1E40AF',
        border: '#BFDBFE',
        dot: '#3B82F6',
      },
      vencido: {
        bg: '#FEE2E2',
        text: '#991B1B',
        border: '#FECACA',
        dot: '#EF4444',
      },
      mantenimiento: {
        bg: '#F3F4F6',
        text: '#374151',
        border: '#E5E7EB',
        dot: '#6B7280',
      },
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      base: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.625,
    },
  },
  spacing: {
    1: '0.25rem', // 4px
    2: '0.5rem', // 8px
    3: '0.75rem', // 12px
    4: '1rem', // 16px
    5: '1.25rem', // 20px
    6: '1.5rem', // 24px
    8: '2rem', // 32px
    10: '2.5rem', // 40px
    12: '3rem', // 48px
  },
  borderRadius: {
    none: '0',
    sm: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    card: '0 1px 3px 0 rgba(16, 42, 86, 0.08), 0 1px 2px 0 rgba(16, 42, 86, 0.04)',
    dropdown: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    modal: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
} as const;

export default tokens;
