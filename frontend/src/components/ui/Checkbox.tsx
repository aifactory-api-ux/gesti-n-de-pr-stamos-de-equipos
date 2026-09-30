import React from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: React.ReactNode;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      id,
      label,
      description,
      checked,
      onChange,
      disabled = false,
      error,
      className = '',
      ...rest
    },
    ref
  ) => {
    const inputId = id || (typeof label === 'string' ? `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.checked);
    };

    return (
      <div className={`flex items-start gap-3 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}>
        <div className="relative flex items-center justify-center pt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className="peer sr-only"
            {...rest}
          />
          <div
            onClick={() => !disabled && onChange(!checked)}
            className={`w-5 h-5 rounded border transition-colors flex items-center justify-center cursor-pointer select-none
              ${
                checked
                  ? 'bg-[#0B2F6B] border-[#0B2F6B] text-white'
                  : 'bg-white border-[#CBD5E1] hover:border-[#94A3B8]'
              }
              ${error ? 'border-red-500' : ''}
              peer-focus-visible:ring-2 peer-focus-visible:ring-[#2563EB] peer-focus-visible:ring-offset-1
              ${disabled ? 'cursor-not-allowed' : ''}
            `}
            role="checkbox"
            aria-checked={checked}
            aria-disabled={disabled}
          >
            {checked && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
          </div>
        </div>

        {(label || description) && (
          <div className="flex flex-col text-sm select-none">
            {label && (
              <label
                htmlFor={inputId}
                className={`font-medium text-[#102A56] ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-[#58708F] mt-0.5">{description}</p>
            )}
            {error && <span className="text-xs text-red-600 mt-1">{error}</span>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
