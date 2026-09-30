import React from 'react';

export interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  count?: number;
  className?: string;
  disabled?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  onClick,
  icon,
  count,
  className = '',
  disabled = false,
}) => {
  const isClickable = typeof onClick === 'function' && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border select-none
        ${
          active
            ? 'bg-[#0B2F6B] text-white border-[#0B2F6B] shadow-sm ring-1 ring-[#0B2F6B]'
            : 'bg-white text-[#58708F] border-[#E2E8F0] hover:border-[#CBD5E1] hover:text-[#102A56] hover:bg-[#F8FAFC]'
        }
        ${!isClickable ? 'cursor-default pointer-events-none' : 'cursor-pointer'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1
        ${className}
      `}
      aria-pressed={active}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
            active
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

export default Chip;
