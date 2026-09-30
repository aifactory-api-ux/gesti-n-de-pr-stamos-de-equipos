import React, { useState, useEffect } from 'react';
import { Laptop, ShieldCheck, CheckSquare, AlertCircle } from 'lucide-react';
import { Prestamo, RegistrarDevolucionDto } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';

export interface ReturnConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  prestamo: Prestamo | null;
  onConfirm: (dto: RegistrarDevolucionDto) => Promise<void> | void;
  isLoading?: boolean;
}

/**
 * Modal de Confirmación de Devolución Física e Inspección Técnica de Activo.
 * Cumple con SPEC §11.3 y Figma blueprint (fill: #EDF5FF, selector de estado
 * físico disponible/en_mantencion, observaciones de inspección >= 5 caracteres).
 */
export const ReturnConfirmation: React.FC<ReturnConfirmationProps> = ({
  isOpen,
  onClose,
  prestamo,
  onConfirm,
  isLoading = false,
}) => {
  const [returnCondition, setReturnCondition] = useState<'disponible' | 'en_mantencion'>('disponible');
  const [observaciones, setObservaciones] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReturnCondition('disponible');
      setObservaciones('');
      setTouched(false);
      setLocalError(null);
    }
  }, [isOpen, prestamo]);

  const isFormValid = observaciones.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!isFormValid) {
      setLocalError('Las observaciones de inspección física deben tener al menos 5 caracteres.');
      return;
    }

    setLocalError(null);
    await onConfirm({
      estado_fisico_equipo: returnCondition,
      observaciones: observaciones.trim(),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Devolución Física"
      description="Verifica el estado físico del equipo e inspecciona sus accesorios antes de reintegrarlo al inventario."
      maxWidth="lg"
    >
      {prestamo && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Resumen del equipo y custodio con estilo azul corporativo #EDF5FF */}
          <div className="bg-[#EDF5FF] border border-[#BFDBFE] rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0B2F6B]">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                  {prestamo.equipo?.codigo_inventario || 'ACTIVO-TI'}
                </span>
                {prestamo.equipo?.numero_serie && (
                  <span className="text-blue-800">
                    S/N: {prestamo.equipo.numero_serie}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-[#0B2F6B] mt-0.5 truncate">
                {prestamo.equipo?.marca} {prestamo.equipo?.modelo}
              </h4>
              <p className="text-blue-700">
                Custodio: <strong>{prestamo.usuario?.nombre_completo || 'Colaborador'}</strong>
                {prestamo.usuario?.email && ` (${prestamo.usuario.email})`}
              </p>
            </div>
          </div>

          {/* Selector de estado físico del activo reintegrado */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#102A56]">
              Estado Físico del Activo al Devolver <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  returnCondition === 'disponible'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-[#CBD5E1] bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="returnCondition"
                  value="disponible"
                  checked={returnCondition === 'disponible'}
                  onChange={() => setReturnCondition('disponible')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">
                    Disponible para préstamo inmediato
                  </span>
                  <span className="text-[11px] text-[#58708F] leading-tight block mt-0.5">
                    Activo operativo en óptimas condiciones, listo para reasignar en catálogo.
                  </span>
                </div>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  returnCondition === 'en_mantencion'
                    ? 'border-amber-600 bg-amber-50/50 ring-1 ring-amber-600'
                    : 'border-[#CBD5E1] bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="returnCondition"
                  value="en_mantencion"
                  checked={returnCondition === 'en_mantencion'}
                  onChange={() => setReturnCondition('en_mantencion')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-amber-950 block">
                    Requiere Mantenimiento / Reparación
                  </span>
                  <span className="text-[11px] text-[#58708F] leading-tight block mt-0.5">
                    Fallas técnicas, formateo pendiente, daño estético o revisión requerida.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Observaciones de recepción física e inspección técnica */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label
                htmlFor="return-notes"
                className="block text-xs font-bold uppercase tracking-wider text-[#102A56]"
              >
                Observaciones de Recepción Física <span className="text-red-500">*</span>
              </label>
              <span className={`text-[11px] ${observaciones.trim().length < 5 ? 'text-[#58708F]' : 'text-emerald-600 font-medium'}`}>
                {observaciones.trim().length}/5 caracteres mín.
              </span>
            </div>
            <textarea
              id="return-notes"
              rows={3}
              value={observaciones}
              onChange={(e) => {
                setObservaciones(e.target.value);
                if (localError) setLocalError(null);
              }}
              onBlur={() => setTouched(true)}
              placeholder="Detalle de recepción física, cargador, accesorios y estado del chasis..."
              className={`w-full p-2.5 rounded-lg border text-xs text-[#102A56] placeholder-[#58708F] focus:outline-none focus:ring-2 transition-all ${
                (touched && !isFormValid) || localError
                  ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                  : 'border-[#CBD5E1] focus:ring-[#2563EB]'
              }`}
              aria-required="true"
            />
            {((touched && !isFormValid) || localError) && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {localError || 'Ingresa al menos 5 caracteres de detalle de inspección física.'}
                </span>
              </p>
            )}
          </div>

          {/* Compliance & Audit banner */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg text-[11px] text-[#58708F] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Esta acción genera un registro inmutable en la tabla de auditoría corporativa y actualiza el inventario en tiempo real.
            </span>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isLoading}
              disabled={!isFormValid || isLoading}
              leftIcon={<CheckSquare className="w-4 h-4" />}
            >
              Confirmar Devolución y Liberar Activo
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ReturnConfirmation;
