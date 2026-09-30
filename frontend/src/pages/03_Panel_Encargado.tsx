import React, { useState, useMemo } from 'react';
import {
  Laptop,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Check,
  ShieldCheck,
  Package,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLoans } from '../hooks/useLoans';
import { useMetrics } from '../hooks/useMetrics';
import {
  SolicitudPrestamo,
  Prestamo,
  RegistrarDevolucionDto,
} from '../types';
import AppNavbar from '../components/ui/AppNavbar';
import Breadcrumb from '../components/ui/Breadcrumb';
import Tabs, { TabItem } from '../components/ui/Tabs';
import Table, { ColumnDefinition } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Tag from '../components/ui/Tag';
import ReturnConfirmation from '../components/ReturnConfirmation';

/**
 * Formatea fechas ISO a formato legible en español chileno.
 */
const formatDate = (isoString?: string | null): string => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
};

/**
 * Formatea fecha y hora.
 */
const formatDateTime = (isoString?: string | null): string => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
};

/**
 * Calcula si un préstamo vence dentro de los próximos 3 días.
 */
const isExpiringSoon = (vencimientoStr: string): boolean => {
  const now = new Date();
  const vencimiento = new Date(vencimientoStr);
  const diffDays = (vencimiento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 3;
};

/**
 * Pantalla 03: Consola de Administración del Encargado de TI (Panel_Encargado).
 * Provee:
 * - Indicadores KPI superiores en tiempo real (Total Activos, Préstamos Activos, Solicitudes Pendientes, Por Vencer <= 3 días)
 * - Pestañas de trabajo para "Solicitudes Pendientes" y "Préstamos Activos y Devoluciones"
 * - Flujo de aprobación / rechazo de solicitudes con asignación de días
 * - Flujo de devolución física e inspección técnica con modal de confirmación
 * - Flujo de renovación de préstamos (máx 1 vez)
 * - Auditoría inmutable de 5 años conforme a ISO 27001
 */
export const PanelEncargado: React.FC = () => {
  const { usuario, logout } = useAuth();
  const { metrics, loading: loadingMetrics, fetchMetrics } = useMetrics();
  const {
    solicitudes,
    prestamos,
    loadingSolicitudes,
    loadingPrestamos,
    actionLoading,
    error: loansError,
    refreshAll,
    aprobarSolicitud,
    rechazarSolicitud,
    registrarDevolucion,
    renovarPrestamo,
  } = useLoans();

  // Pestaña activa ('solicitudes' | 'prestamos')
  const [activeTab, setActiveTab] = useState<string>('solicitudes');

  // Filtros de búsqueda
  const [searchSolicitudes, setSearchSolicitudes] = useState<string>('');
  const [searchPrestamos, setSearchPrestamos] = useState<string>('');
  const [filterEstadoPrestamo, setFilterEstadoPrestamo] = useState<string>('todos');

  // Mensajes de retroalimentación en la vista
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Estados de modales interactivos
  // 1. Modal Aprobar Solicitud
  const [solicitudToApprove, setSolicitudToApprove] = useState<SolicitudPrestamo | null>(null);
  const [approvalDays, setApprovalDays] = useState<number>(30);
  const [approvalNotes, setApprovalNotes] = useState<string>('');

  // 2. Modal Rechazar Solicitud
  const [solicitudToReject, setSolicitudToReject] = useState<SolicitudPrestamo | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionTouched, setRejectionTouched] = useState<boolean>(false);

  // 3. Modal Registrar Devolución (ReturnConfirmation)
  const [prestamoToReturn, setPrestamoToReturn] = useState<Prestamo | null>(null);

  // 4. Modal Renovar Préstamo
  const [prestamoToRenew, setPrestamoToRenew] = useState<Prestamo | null>(null);
  const [renewReason, setRenewReason] = useState<string>('Extensión de período aprobada por TI');

  // Función para refrescar todo (métricas + préstamos + solicitudes)
  const handleFullRefresh = async () => {
    setFeedbackSuccess(null);
    setFeedbackError(null);
    await Promise.all([fetchMetrics(), refreshAll()]);
  };

  // Filtrado de solicitudes pendientes
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((sol) => {
      // Por defecto en la pestaña de solicitudes pendientes mostramos las pendientes
      const isPendiente = sol.estado === 'pendiente';
      if (!isPendiente) return false;

      if (!searchSolicitudes.trim()) return true;
      const q = searchSolicitudes.toLowerCase();
      const colabName = sol.usuario?.nombre_completo?.toLowerCase() || '';
      const colabEmail = sol.usuario?.email?.toLowerCase() || '';
      const eqCodigo = sol.equipo?.codigo_inventario?.toLowerCase() || '';
      const eqMarca = sol.equipo?.marca?.toLowerCase() || '';
      const eqModelo = sol.equipo?.modelo?.toLowerCase() || '';
      const motivo = sol.motivo?.toLowerCase() || '';

      return (
        colabName.includes(q) ||
        colabEmail.includes(q) ||
        eqCodigo.includes(q) ||
        eqMarca.includes(q) ||
        eqModelo.includes(q) ||
        motivo.includes(q)
      );
    });
  }, [solicitudes, searchSolicitudes]);

  // Filtrado de préstamos activos
  const filteredPrestamos = useMemo(() => {
    return prestamos.filter((p) => {
      // Filtro de estado
      if (filterEstadoPrestamo === 'activos' && p.estado !== 'activo') return false;
      if (filterEstadoPrestamo === 'vencidos' && p.estado !== 'vencido') return false;
      if (filterEstadoPrestamo === 'devueltos' && p.estado !== 'devuelto') return false;
      if (filterEstadoPrestamo === 'por_vencer') {
        if (p.estado !== 'activo') return false;
        if (!isExpiringSoon(p.fecha_vencimiento)) return false;
      }

      if (!searchPrestamos.trim()) return true;
      const q = searchPrestamos.toLowerCase();
      const colabName = p.usuario?.nombre_completo?.toLowerCase() || '';
      const colabEmail = p.usuario?.email?.toLowerCase() || '';
      const eqCodigo = p.equipo?.codigo_inventario?.toLowerCase() || '';
      const eqMarca = p.equipo?.marca?.toLowerCase() || '';
      const eqModelo = p.equipo?.modelo?.toLowerCase() || '';
      const eqSerie = p.equipo?.numero_serie?.toLowerCase() || '';

      return (
        colabName.includes(q) ||
        colabEmail.includes(q) ||
        eqCodigo.includes(q) ||
        eqMarca.includes(q) ||
        eqModelo.includes(q) ||
        eqSerie.includes(q)
      );
    });
  }, [prestamos, searchPrestamos, filterEstadoPrestamo]);

  // Manejo de Aprobación
  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitudToApprove) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await aprobarSolicitud(
        solicitudToApprove.id,
        approvalDays,
        approvalNotes.trim() || undefined
      );
      setFeedbackSuccess(
        `Solicitud de ${solicitudToApprove.usuario?.nombre_completo || 'colaborador'} aprobada exitosamente.`
      );
      setSolicitudToApprove(null);
      setApprovalNotes('');
      setApprovalDays(30);
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackError(
        err?.response?.data?.message || err?.message || 'Error al aprobar la solicitud.'
      );
    }
  };

  // Manejo de Rechazo
  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitudToReject) return;
    if (rejectionReason.trim().length < 5) {
      setRejectionTouched(true);
      return;
    }
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await rechazarSolicitud(solicitudToReject.id, rejectionReason.trim());
      setFeedbackSuccess(
        `Solicitud de ${solicitudToReject.usuario?.nombre_completo || 'colaborador'} rechazada.`
      );
      setSolicitudToReject(null);
      setRejectionReason('');
      setRejectionTouched(false);
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackError(
        err?.response?.data?.message || err?.message || 'Error al rechazar la solicitud.'
      );
    }
  };

  // Manejo de Devolución Física (ReturnConfirmation)
  const handleConfirmReturn = async (dto: RegistrarDevolucionDto) => {
    if (!prestamoToReturn) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await registrarDevolucion(prestamoToReturn.id, dto);
      setFeedbackSuccess(
        `Devolución del equipo ${prestamoToReturn.equipo?.codigo_inventario || 'solicitado'} registrada exitosamente.`
      );
      setPrestamoToReturn(null);
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackError(
        err?.response?.data?.message ||
          err?.message ||
          'Error al registrar la devolución del equipo.'
      );
    }
  };

  // Manejo de Renovación
  const handleConfirmRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prestamoToRenew) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await renovarPrestamo(prestamoToRenew.id, {
        dias_extension: 30,
        motivo_renovacion: renewReason.trim(),
      });
      setFeedbackSuccess(
        `Préstamo del equipo ${prestamoToRenew.equipo?.codigo_inventario} extendido exitosamente por 30 días.`
      );
      setPrestamoToRenew(null);
      setRenewReason('Extensión de período aprobada por TI');
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackError(
        err?.response?.data?.message || err?.message || 'Error al renovar el préstamo.'
      );
    }
  };

  // Configuración de pestañas
  const tabsConfig: TabItem[] = [
    {
      id: 'solicitudes',
      label: 'Solicitudes Pendientes',
      count: metrics?.solicitudes_pendientes ?? filteredSolicitudes.length,
      icon: <Clock className="w-4 h-4" />,
    },
    {
      id: 'prestamos',
      label: 'Préstamos Activos y Devoluciones',
      count: metrics?.prestamos_activos ?? prestamos.filter((p) => p.estado === 'activo').length,
      icon: <CheckSquare className="w-4 h-4" />,
    },
  ];

  // Columnas para la tabla de solicitudes pendientes
  const columnsSolicitudes: ColumnDefinition<SolicitudPrestamo>[] = [
    {
      header: 'Fecha Solicitud',
      cell: (row) => (
        <div>
          <span className="font-medium text-[#102A56] block">
            {formatDate(row.fecha_solicitud)}
          </span>
          <span className="text-[11px] text-[#58708F]">
            {formatDateTime(row.fecha_solicitud).split(',')[1] || ''}
          </span>
        </div>
      ),
      width: '150px',
    },
    {
      header: 'Colaborador',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[#102A56]">
            {row.usuario?.nombre_completo || 'Colaborador'}
          </span>
          <span className="text-xs text-[#58708F] font-mono">
            {row.usuario?.email || '-'}
          </span>
        </div>
      ),
      width: '240px',
    },
    {
      header: 'Equipo Solicitado',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E8F2FF] border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0B2F6B]">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-[#0B2F6B] bg-[#EDF5FF] px-1.5 py-0.5 rounded border border-[#BFDBFE]">
                {row.equipo?.codigo_inventario}
              </span>
              <span className="text-xs text-[#58708F]">
                {row.equipo?.categoria?.nombre}
              </span>
            </div>
            <div className="font-medium text-[#102A56] text-xs mt-0.5">
              {row.equipo?.marca} {row.equipo?.modelo}
            </div>
          </div>
        </div>
      ),
      width: '260px',
    },
    {
      header: 'Motivo / Justificación',
      cell: (row) => (
        <div className="max-w-xs text-xs text-[#475569] line-clamp-2 leading-relaxed" title={row.motivo}>
          {row.motivo}
        </div>
      ),
    },
    {
      header: 'Acciones',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSolicitudToApprove(row);
              setApprovalDays(30);
              setApprovalNotes('');
            }}
            disabled={actionLoading}
            leftIcon={<Check className="w-3.5 h-3.5" />}
          >
            Aprobar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400"
            onClick={() => {
              setSolicitudToReject(row);
              setRejectionReason('');
              setRejectionTouched(false);
            }}
            disabled={actionLoading}
            leftIcon={<X className="w-3.5 h-3.5 text-red-600" />}
          >
            Rechazar
          </Button>
        </div>
      ),
      width: '190px',
    },
  ];

  // Columnas para la tabla de préstamos activos
  const columnsPrestamos: ColumnDefinition<Prestamo>[] = [
    {
      header: 'Código Equipo',
      cell: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-[#0B2F6B] bg-[#EDF5FF] px-2 py-0.5 rounded border border-[#BFDBFE] inline-block">
            {row.equipo?.codigo_inventario}
          </span>
          <span className="text-[11px] text-[#58708F] block mt-0.5">
            {row.equipo?.categoria?.nombre || 'Equipo TI'}
          </span>
        </div>
      ),
      width: '140px',
    },
    {
      header: 'Tipo / Modelo',
      cell: (row) => (
        <div>
          <span className="font-semibold text-[#102A56] text-xs block">
            {row.equipo?.marca} {row.equipo?.modelo}
          </span>
          <span className="text-[11px] font-mono text-[#58708F]">
            S/N: {row.equipo?.numero_serie}
          </span>
        </div>
      ),
      width: '200px',
    },
    {
      header: 'Colaborador',
      cell: (row) => (
        <div>
          <span className="font-semibold text-[#102A56] text-xs block">
            {row.usuario?.nombre_completo || 'Colaborador'}
          </span>
          <span className="text-[11px] text-[#58708F] font-mono">
            {row.usuario?.email}
          </span>
        </div>
      ),
      width: '200px',
    },
    {
      header: 'Fecha Entrega',
      cell: (row) => (
        <span className="text-xs text-[#475569]">
          {formatDate(row.fecha_inicio)}
        </span>
      ),
      width: '120px',
    },
    {
      header: 'Fecha Vencimiento',
      cell: (row) => {
        const expiring = isExpiringSoon(row.fecha_vencimiento);
        return (
          <div className="flex flex-col items-start gap-1">
            <span
              className={`text-xs font-medium ${
                row.estado === 'vencido'
                  ? 'text-red-600 font-bold'
                  : expiring
                  ? 'text-amber-700 font-semibold'
                  : 'text-[#475569]'
              }`}
            >
              {formatDate(row.fecha_vencimiento)}
            </span>
            {expiring && row.estado === 'activo' && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full inline-flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                Vence en &le; 3 días
              </span>
            )}
          </div>
        );
      },
      width: '160px',
    },
    {
      header: 'Estado',
      cell: (row) => {
        if (row.estado === 'activo') {
          return <Badge variant="activo" label="Al día" size="sm" />;
        }
        if (row.estado === 'vencido') {
          return <Badge variant="vencido" label="Vencido" size="sm" />;
        }
        return <Badge variant="devuelto" label="Devuelto" size="sm" />;
      },
      width: '110px',
    },
    {
      header: 'Renovado',
      cell: (row) => (
        <Tag
          variant={row.renovado ? 'warning' : 'default'}
          size="sm"
        >
          {row.renovado ? 'Sí (+30d)' : 'No'}
        </Tag>
      ),
      width: '100px',
    },
    {
      header: 'Acciones',
      cell: (row) => {
        const isActivo = row.estado === 'activo';
        const canRenew = isActivo && !row.renovado;

        return (
          <div className="flex items-center gap-2">
            {isActivo && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setPrestamoToReturn(row);
                }}
                disabled={actionLoading}
              >
                Registrar Devolución
              </Button>
            )}
            {isActivo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPrestamoToRenew(row);
                  setRenewReason('Extensión de período aprobada por TI');
                }}
                disabled={!canRenew || actionLoading}
                title={
                  row.renovado
                    ? 'Este préstamo ya fue renovado una vez (máximo permitido).'
                    : 'Extender vencimiento por 30 días.'
                }
              >
                Renovar
              </Button>
            )}
            {row.estado === 'devuelto' && (
              <span className="text-xs text-[#58708F] italic">
                Devuelto el {formatDate(row.fecha_devolucion)}
              </span>
            )}
          </div>
        );
      },
      width: '260px',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#102A56] flex flex-col font-sans antialiased">
      {/* 1. Barra de Navegación Persistente Administrador TI */}
      <AppNavbar
        usuario={usuario}
        activePath="/panel-encargado"
        onLogout={logout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* 2. Header Institucional (height ~132px responsive) */}
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Panel Encargado TI' },
            ]}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                Consola de Administración de Inventario TI
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#102A56] mt-2">
                Control de Préstamos y Devoluciones
              </h1>
              <p className="text-sm sm:text-base text-[#58708F] mt-1">
                Gestión de aprobaciones, entrega física y recepción de activos tecnológicos.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFullRefresh}
                disabled={loadingMetrics || loadingSolicitudes || loadingPrestamos}
                leftIcon={
                  <RefreshCw
                    className={`w-4 h-4 ${
                      loadingMetrics || loadingSolicitudes || loadingPrestamos
                        ? 'animate-spin'
                        : ''
                    }`}
                  />
                }
              >
                Actualizar Datos
              </Button>
            </div>
          </div>
        </div>

        {/* Mensajes Globales de Retroalimentación */}
        {feedbackSuccess && (
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4 flex items-center justify-between text-emerald-900 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium">{feedbackSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {(feedbackError || loansError) && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 flex items-center justify-between text-red-900 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-medium">{feedbackError || loansError}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackError(null)}
              className="text-red-700 hover:text-red-900 p-1 rounded"
              aria-label="Cerrar alerta de error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. Indicadores Clave de Inventario (Key Inventory Metrics Row - 4 Cards) */}
        <section
          aria-label="Indicadores clave de inventario TI"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Card 1: Total Activos TI */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#58708F]">
                Total Activos TI
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#E8F2FF] flex items-center justify-center text-[#0B2F6B]">
                <Package className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#102A56]">
                {metrics?.total_activos ?? 150}
              </span>
              <span className="text-xs text-[#58708F]">equipos</span>
            </div>
            <p className="mt-2 text-xs text-[#58708F]">
              Notebooks, monitores, periféricos
            </p>
          </div>

          {/* Card 2: Préstamos Activos */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#58708F]">
                Préstamos Activos
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                <Laptop className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#102A56]">
                {metrics?.prestamos_activos ?? 42}
              </span>
              <span className="text-xs text-[#58708F]">en custodia</span>
            </div>
            <p className="mt-2 text-xs text-[#58708F]">
              Equipos actualmente prestados
            </p>
          </div>

          {/* Card 3: Solicitudes Pendientes */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#58708F]">
                Solicitudes Pendientes
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[#92400E]">
                <Clock className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#102A56]">
                {metrics?.solicitudes_pendientes ?? 5}
              </span>
              <span className="text-xs text-[#58708F]">por resolver</span>
            </div>
            <p className="mt-2 text-xs text-[#58708F]">
              Requieren aprobación del encargado
            </p>
          </div>

          {/* Card 4: Por Vencer (<= 3 días) */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#58708F]">
                Por Vencer (&le; 3 días)
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#FEE2E2] flex items-center justify-center text-[#991B1B]">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-600">
                {metrics?.por_vencer ?? 3}
              </span>
              <span className="text-xs text-[#58708F]">alertas activas</span>
            </div>
            <p className="mt-2 text-xs text-[#58708F]">
              Caducan en breve con aviso enviado
            </p>
          </div>
        </section>

        {/* 4. Pestañas de Trabajo (Work Tabs - Surface #FFFFFF, height 66px) */}
        <section className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-6 pt-3">
            <Tabs
              tabs={tabsConfig}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id)}
              variant="underline"
            />
          </div>

          {/* Contenido Pestaña 1: Solicitudes Pendientes */}
          {activeTab === 'solicitudes' && (
            <div className="p-6 space-y-4">
              {/* Barra de búsqueda y filtros rápidos */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#58708F]">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchSolicitudes}
                    onChange={(e) => setSearchSolicitudes(e.target.value)}
                    placeholder="Buscar por colaborador, código de equipo o motivo..."
                    className="w-full pl-10 pr-10 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#102A56] placeholder-[#58708F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                  {searchSolicitudes && (
                    <button
                      type="button"
                      onClick={() => setSearchSolicitudes('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#58708F] hover:text-[#102A56]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-[#58708F] flex items-center gap-2">
                  <span>
                    Mostrando <strong>{filteredSolicitudes.length}</strong> solicitud(es) pendiente(s)
                  </span>
                </div>
              </div>

              {/* Tabla de Solicitudes */}
              <Table
                columns={columnsSolicitudes}
                data={filteredSolicitudes}
                loading={loadingSolicitudes}
                keyExtractor={(item) => item.id}
                emptyMessage="No hay solicitudes de préstamo pendientes en este momento."
              />
            </div>
          )}

          {/* Contenido Pestaña 2: Préstamos Activos y Devoluciones */}
          {activeTab === 'prestamos' && (
            <div className="p-6 space-y-4">
              {/* Barra de búsqueda y selector de estado */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#58708F]">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchPrestamos}
                    onChange={(e) => setSearchPrestamos(e.target.value)}
                    placeholder="Buscar por equipo, serie o colaborador..."
                    className="w-full pl-10 pr-10 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#102A56] placeholder-[#58708F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                  {searchPrestamos && (
                    <button
                      type="button"
                      onClick={() => setSearchPrestamos('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#58708F] hover:text-[#102A56]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor="filter-loan-status" className="text-xs font-semibold text-[#58708F]">
                    Filtrar:
                  </label>
                  <select
                    id="filter-loan-status"
                    value={filterEstadoPrestamo}
                    onChange={(e) => setFilterEstadoPrestamo(e.target.value)}
                    className="px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#102A56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-medium"
                  >
                    <option value="todos">Todos los Préstamos</option>
                    <option value="activos">Préstamos Activos</option>
                    <option value="por_vencer">Próximos a Vencer (&le; 3 días)</option>
                    <option value="vencidos">Préstamos Vencidos</option>
                    <option value="devueltos">Devueltos</option>
                  </select>
                </div>
              </div>

              {/* Tabla de Préstamos */}
              <Table
                columns={columnsPrestamos}
                data={filteredPrestamos}
                loading={loadingPrestamos}
                keyExtractor={(item) => item.id}
                emptyMessage="No se encontraron préstamos que coincidan con los criterios."
              />
            </div>
          )}
        </section>
      </main>

      {/* 5. Pie Corporativo Institucional */}
      <footer className="w-full bg-[#F5F7FC] border-t border-[#E2E8F0] py-4 text-xs text-[#58708F] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span>Apiux SpA &middot; Consola de Administración TI</span>
          <span className="text-[11px] text-[#6A7F99]">
            Registro inmutable para auditoría conforme a ISO 27001 (5 años de retención obligatoria)
          </span>
        </div>
      </footer>

      {/* =========================================================================
          MODAL 1: APROBAR SOLICITUD DE PRÉSTAMO
          ========================================================================= */}
      <Modal
        isOpen={Boolean(solicitudToApprove)}
        onClose={() => setSolicitudToApprove(null)}
        title="Aprobar Solicitud de Préstamo"
        description="Confirma la entrega física del equipo y establece la vigencia del préstamo."
        maxWidth="md"
      >
        {solicitudToApprove && (
          <form onSubmit={handleConfirmApproval} className="space-y-4">
            <div className="bg-[#EDF5FF] border border-[#BFDBFE] rounded-lg p-3.5 space-y-1.5 text-xs text-[#102A56]">
              <div className="flex justify-between">
                <span className="text-[#58708F]">Colaborador:</span>
                <strong className="font-semibold">
                  {solicitudToApprove.usuario?.nombre_completo}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58708F]">Equipo:</span>
                <strong className="font-mono">
                  {solicitudToApprove.equipo?.codigo_inventario} &mdash;{' '}
                  {solicitudToApprove.equipo?.marca} {solicitudToApprove.equipo?.modelo}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58708F]">Motivo Solicitud:</span>
                <span className="truncate max-w-[200px]" title={solicitudToApprove.motivo}>
                  {solicitudToApprove.motivo}
                </span>
              </div>
            </div>

            {/* Días de préstamo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#102A56]">
                Días de Préstamo <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[7, 15, 30].map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => setApprovalDays(dias)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      approvalDays === dias
                        ? 'border-[#0B2F6B] bg-[#E8F2FF] text-[#0B2F6B] ring-1 ring-[#0B2F6B]'
                        : 'border-[#CBD5E1] bg-white text-[#58708F] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {dias} Días
                  </button>
                ))}
              </div>
            </div>

            {/* Observaciones de entrega */}
            <div className="space-y-1.5">
              <label
                htmlFor="approval-notes"
                className="block text-xs font-bold uppercase tracking-wider text-[#102A56]"
              >
                Observaciones de Entrega (Opcional)
              </label>
              <textarea
                id="approval-notes"
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ej: Se entrega con cargador original, funda y mouse óptico..."
                className="w-full p-2.5 rounded-lg border border-[#CBD5E1] text-xs text-[#102A56] placeholder-[#58708F] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setSolicitudToApprove(null)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={actionLoading}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Aprobar y Registrar Préstamo
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 2: RECHAZAR SOLICITUD DE PRÉSTAMO
          ========================================================================= */}
      <Modal
        isOpen={Boolean(solicitudToReject)}
        onClose={() => setSolicitudToReject(null)}
        title="Rechazar Solicitud de Préstamo"
        description="Ingresa la justificación del rechazo para informar al colaborador."
        maxWidth="md"
      >
        {solicitudToReject && (
          <form onSubmit={handleConfirmRejection} className="space-y-4">
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3 text-xs text-red-900">
              Estás por rechazar la solicitud de{' '}
              <strong>{solicitudToReject.usuario?.nombre_completo}</strong> para el equipo{' '}
              <strong>{solicitudToReject.equipo?.codigo_inventario}</strong>. El equipo volverá a estar disponible en el catálogo.
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rejection-reason"
                className="block text-xs font-bold uppercase tracking-wider text-[#102A56]"
              >
                Motivo de Rechazo <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejection-reason"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                onBlur={() => setRejectionTouched(true)}
                placeholder="Indica el motivo técnico o administrativo del rechazo..."
                className={`w-full p-2.5 rounded-lg border text-xs text-[#102A56] placeholder-[#58708F] focus:outline-none focus:ring-2 transition-all ${
                  rejectionTouched && rejectionReason.trim().length < 5
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-[#CBD5E1] focus:ring-[#2563EB]'
                }`}
                aria-required="true"
              />
              {rejectionTouched && rejectionReason.trim().length < 5 && (
                <p className="text-xs text-red-600">
                  Por favor proporciona un motivo de al menos 5 caracteres.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setSolicitudToReject(null)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="md"
                type="submit"
                isLoading={actionLoading}
                disabled={rejectionReason.trim().length < 5 || actionLoading}
                leftIcon={<X className="w-4 h-4" />}
              >
                Confirmar Rechazo
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 3: REGISTRAR DEVOLUCIÓN FÍSICA (ReturnConfirmation)
          ========================================================================= */}
      <ReturnConfirmation
        isOpen={Boolean(prestamoToReturn)}
        onClose={() => setPrestamoToReturn(null)}
        prestamo={prestamoToReturn}
        onConfirm={handleConfirmReturn}
        isLoading={actionLoading}
      />

      {/* =========================================================================
          MODAL 4: RENOVAR PRÉSTAMO (+30 DÍAS)
          ========================================================================= */}
      <Modal
        isOpen={Boolean(prestamoToRenew)}
        onClose={() => setPrestamoToRenew(null)}
        title="Renovar Período de Préstamo"
        description="Extiende la vigencia del préstamo por 30 días adicionales (máximo 1 renovación permitida)."
        maxWidth="md"
      >
        {prestamoToRenew && (
          <form onSubmit={handleConfirmRenewal} className="space-y-4">
            <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-lg p-3 text-xs text-amber-950">
              Se extenderá la fecha de vencimiento del equipo{' '}
              <strong>{prestamoToRenew.equipo?.codigo_inventario}</strong> en custodia de{' '}
              <strong>{prestamoToRenew.usuario?.nombre_completo}</strong> por <strong>30 días corridos</strong>.
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="renew-reason"
                className="block text-xs font-bold uppercase tracking-wider text-[#102A56]"
              >
                Motivo de Renovación <span className="text-red-500">*</span>
              </label>
              <textarea
                id="renew-reason"
                rows={2}
                value={renewReason}
                onChange={(e) => setRenewReason(e.target.value)}
                placeholder="Indica la justificación de extensión del plazo..."
                className="w-full p-2.5 rounded-lg border border-[#CBD5E1] text-xs text-[#102A56] placeholder-[#58708F] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                aria-required="true"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setPrestamoToRenew(null)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={actionLoading}
                disabled={!renewReason.trim() || actionLoading}
                leftIcon={<Clock className="w-4 h-4" />}
              >
                Confirmar Renovación (+30 días)
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 8. Footer Corporativo Encargado TI (height ~72px, bg-[#0E295C]) */}
      <footer className="w-full bg-[#0E295C] border-t border-[#1E3A8A] text-white py-4 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#94A3B8]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Apiux Tecnología © 2026 &bull; Consola de Administración TI &bull; ISO 27001 Auditoría Inmutable (5 años)
            </span>
          </div>
          <div className="text-[#94A3B8] text-[11px]">
            Soporte TI: <span className="text-white font-medium">soporte@apiux.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PanelEncargado;
