import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#0B2F6B] text-white hover:bg-[#082352] focus-visible:ring-[#2563EB] shadow-sm active:bg-[#061A3D]',
  secondary:
    'bg-white text-[#102A56] border border-[#E2E8F0] hover:bg-[#F4F7FB] hover:border-[#CBD5E1] focus-visible:ring-[#2563EB] shadow-sm active:bg-[#EDF2F7]',
  danger:
    'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus-visible:ring-red-500 shadow-sm active:bg-[#991B1B]',
  ghost:
    'bg-transparent text-[#58708F] hover:bg-[#F4F7FB] hover:text-[#102A56] focus-visible:ring-[#2563EB]',
  outline:
    'bg-transparent border border-[#0B2F6B] text-[#0B2F6B] hover:bg-[#E8F2FF] focus-visible:ring-[#2563EB] active:bg-[#D4E6FC]',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded gap-1.5 font-medium',
  md: 'text-sm px-4 py-2 rounded-md gap-2 font-medium',
  lg: 'text-base px-5 py-2.5 rounded-lg gap-2.5 font-semibold',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={`inline-flex items-center justify-center transition-all duration-150 ease-in-out select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...rest}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
