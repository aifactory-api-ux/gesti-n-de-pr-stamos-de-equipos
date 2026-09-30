import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import Button, { ButtonProps } from './Button';

export interface ExportButtonProps extends Omit<ButtonProps, 'onClick'> {
  onExport: () => void | Promise<void>;
  label?: string;
  isExporting?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  label = 'Exportar',
  isExporting = false,
  variant = 'secondary',
  size = 'md',
  disabled,
  className = '',
  ...rest
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onExport}
      disabled={disabled || isExporting}
      isLoading={isExporting}
      leftIcon={!isExporting ? <Download className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
      className={className}
      {...rest}
    >
      {label}
    </Button>
  );
};

export default ExportButton;
