import React from 'react';

export interface BadgeProps {
  variant:
    | 'disponible'
    | 'prestado'
    | 'en_mantencion'
    | 'de_baja'
    | 'pendiente'
    | 'aprobada'
    | 'rechazada'
    | 'activo'
    | 'devuelto'
    | 'vencido';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

interface VariantConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  defaultLabel: string;
}

const variantMap: Record<BadgeProps['variant'], VariantConfig> = {
  disponible: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    border: 'border-[#A7F3D0]',
    dot: 'bg-[#10B981]',
    defaultLabel: 'Disponible',
  },
  prestado: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#92400E]',
    border: 'border-[#FDE68A]',
    dot: 'bg-[#F59E0B]',
    defaultLabel: 'Prestado',
  },
  en_mantencion: {
    bg: 'bg-[#F3F4F6]',
    text: 'text-[#374151]',
    border: 'border-[#E5E7EB]',
    dot: 'bg-[#6B7280]',
    defaultLabel: 'En Mantención',
  },
  de_baja: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]',
    dot: 'bg-[#9CA3AF]',
    defaultLabel: 'De Baja',
  },
  pendiente: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1E40AF]',
    border: 'border-[#BFDBFE]',
    dot: 'bg-[#3B82F6]',
    defaultLabel: 'Pendiente',
  },
  aprobada: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    border: 'border-[#A7F3D0]',
    dot: 'bg-[#10B981]',
    defaultLabel: 'Aprobada',
  },
  rechazada: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]',
    dot: 'bg-[#EF4444]',
    defaultLabel: 'Rechazada',
  },
  activo: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    border: 'border-[#A7F3D0]',
    dot: 'bg-[#10B981]',
    defaultLabel: 'Al día',
  },
  devuelto: {
    bg: 'bg-[#F1F5F9]',
    text: 'text-[#475569]',
    border: 'border-[#CBD5E1]',
    dot: 'bg-[#94A3B8]',
    defaultLabel: 'Devuelto',
  },
  vencido: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]',
    dot: 'bg-[#EF4444]',
    defaultLabel: 'Vencido',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant,
  label,
  size = 'md',
  className = '',
}) => {
  const config = variantMap[variant] || variantMap.disponible;
  const displayText = label || config.defaultLabel;

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 gap-1.5'
      : 'text-sm px-2.5 py-1 gap-2';

  const dotSizeClasses = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      <span
        className={`rounded-full shrink-0 ${config.dot} ${dotSizeClasses}`}
        aria-hidden="true"
      />
      <span>{displayText}</span>
    </span>
  );
};

export default Badge;
