/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apiux: {
          primary: '#0B2F6B',
          primaryHover: '#082352',
          navDark: '#0E2045',
          navAdmin: '#0E295C',
          cardHeader: '#102A56',
          textPrimary: '#102A56',
          textSecondary: '#58708F',
          textMuted: '#6A7F99',
          background: '#F4F7FB',
          bgCatalog: '#F6F9FC',
          bgAdmin: '#F5F7FC',
          surfaceWhite: '#FFFFFF',
          accentLight: '#E8F2FF',
          accentLightAdmin: '#EDF5FF',
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
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 1px 3px 0 rgba(16, 42, 86, 0.08), 0 1px 2px 0 rgba(16, 42, 86, 0.04)',
        dropdown: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        modal: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
};
