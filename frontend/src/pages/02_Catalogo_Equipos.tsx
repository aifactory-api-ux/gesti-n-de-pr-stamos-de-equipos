import React, { useState } from 'react';
import {
  Laptop,
  Monitor,
  Headphones,
  Package,
  Search,
  X,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Filter,
  Lock,
  HardDrive,
  Smartphone,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCatalog } from '../hooks/useCatalog';
import { Equipo, EstadoEquipo, SolicitudPrestamo } from '../types';
import AppNavbar from '../components/ui/AppNavbar';
import Breadcrumb from '../components/ui/Breadcrumb';
import ProgressBar from '../components/ui/ProgressBar';
import Badge from '../components/ui/Badge';
import Chip from '../components/ui/Chip';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Checkbox from '../components/ui/Checkbox';
import Tag from '../components/ui/Tag';

/**
 * Retorna un ícono temático según la categoría o nombre del equipo.
 */
const getEquipmentIcon = (categoriaNombre?: string, modelo?: string) => {
  const text = `${categoriaNombre || ''} ${modelo || ''}`.toLowerCase();
  if (
    text.includes('notebook') ||
    text.includes('laptop') ||
    text.includes('macbook') ||
    text.includes('thinkpad') ||
    text.includes('portátil')
  ) {
    return <Laptop className="w-8 h-8 text-[#0B2F6B]" aria-hidden="true" />;
  }
  if (text.includes('monitor') || text.includes('pantalla') || text.includes('display')) {
    return <Monitor className="w-8 h-8 text-[#2563EB]" aria-hidden="true" />;
  }
  if (text.includes('celular') || text.includes('phone') || text.includes('smartphone')) {
    return <Smartphone className="w-8 h-8 text-[#0284C7]" aria-hidden="true" />;
  }
  if (text.includes('disco') || text.includes('ssd') || text.includes('hdd') || text.includes('almacenamiento')) {
    return <HardDrive className="w-8 h-8 text-[#0D9488]" aria-hidden="true" />;
  }
  if (text.includes('audifono') || text.includes('headphone') || text.includes('headset') || text.includes('auricular')) {
    return <Headphones className="w-8 h-8 text-[#7C3AED]" aria-hidden="true" />;
  }
  return <Package className="w-8 h-8 text-[#58708F]" aria-hidden="true" />;
};

/**
 * Retorna el ícono apropiado para el chip de filtro de categoría.
 */
const getCategoryChipIcon = (catName: string) => {
  const name = catName.toLowerCase();
  if (name.includes('notebook') || name.includes('laptop')) {
    return <Laptop className="w-3.5 h-3.5" />;
  }
  if (name.includes('monitor')) {
    return <Monitor className="w-3.5 h-3.5" />;
  }
  if (name.includes('accesorio') || name.includes('audio')) {
    return <Headphones className="w-3.5 h-3.5" />;
  }
  return <Package className="w-3.5 h-3.5" />;
};

/**
 * Calcula y formatea en español la fecha estimada de devolución.
 */
const formatEstimatedReturnDate = (days: number): string => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(targetDate);
};

/**
 * Pantalla 02: Catálogo de Equipos TI y Gestión de Préstamos para Colaboradores.
 * Permite explorar equipamiento corporativo, filtrar por categorías/búsqueda debounced,
 * monitorear cuotas en tiempo real (máx 2 préstamos activos) y solicitar préstamos
 * mediante un modal de confirmación con responsabilidades ISO 27001.
 */
export const CatalogoEquipos: React.FC = () => {
  const { usuario, quota, logout } = useAuth();
  const {
    equipos,
    categorias,
    loading,
    error,
    selectedCategory,
    searchTerm,
    statusFilter,
    setSelectedCategory,
    setSearchTerm,
    setStatusFilter,
    fetchCatalog,
    submitSolicitud,
    requesting,
    totalEquipos,
  } = useCatalog();

  // Estados del modal de confirmación de solicitud de préstamo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState<Equipo | null>(null);
  const [diasSolicitados, setDiasSolicitados] = useState<number>(30);
  const [motivo, setMotivo] = useState<string>('');
  const [motivoTouched, setMotivoTouched] = useState<boolean>(false);
  const [aceptaCustodia, setAceptaCustodia] = useState<boolean>(false);
  const [solicitudError, setSolicitudError] = useState<string | null>(null);
  const [solicitudExitosa, setSolicitudExitosa] = useState<SolicitudPrestamo | null>(null);

  // Métricas de cupo del colaborador con valores predeterminados seguros
  const activosCount = quota?.prestamos_activos_count ?? 0;
  const cupoMaximo = quota?.cupo_maximo ?? 2;
  const cupoRestante = quota?.cupo_restante ?? Math.max(0, cupoMaximo - activosCount);
  const puedeSolicitar = quota?.puede_solicitar ?? (cupoRestante > 0);

  /**
   * Abre el modal de solicitud preparando el formulario para el equipo seleccionado.
   */
  const handleOpenSolicitudModal = (equipo: Equipo) => {
    setSelectedEquipo(equipo);
    setDiasSolicitados(30);
    setMotivo('');
    setMotivoTouched(false);
    setAceptaCustodia(false);
    setSolicitudError(null);
    setSolicitudExitosa(null);
    setIsModalOpen(true);
  };

  /**
   * Cierra el modal y restablece el estado temporal.
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEquipo(null);
    setSolicitudExitosa(null);
    setSolicitudError(null);
    setMotivo('');
    setMotivoTouched(false);
    setAceptaCustodia(false);
  };

  /**
   * Envía la solicitud al backend validando requisitos locales.
   */
  const handleSubmitPrestamo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipo) return;

    if (motivo.trim().length < 10) {
      setMotivoTouched(true);
      return;
    }

    if (!aceptaCustodia) {
      return;
    }

    setSolicitudError(null);
    try {
      const res = await submitSolicitud({
        equipo_id: selectedEquipo.id,
        motivo: motivo.trim(),
        dias_solicitados: diasSolicitados,
      });
      setSolicitudExitosa(res);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Ocurrió un error al procesar la solicitud de préstamo.';
      setSolicitudError(msg);
    }
  };

  /**
   * Limpia todos los filtros de búsqueda activos.
   */
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setStatusFilter('todos');
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || selectedCategory !== null || statusFilter !== 'todos'
  );

  return (
    <div className="min-h-screen bg-[#F6F9FC] text-[#102A56] flex flex-col font-sans antialiased">
      {/* =========================================================================
          1. BARRA DE NAVEGACIÓN PERSISTENTE (Colaborador / Admin)
          ========================================================================= */}
      <AppNavbar
        usuario={usuario}
        activePath="/catalogo"
        onLogout={logout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* =========================================================================
            2. ENCABEZADO Y BREADCRUMB
            ========================================================================= */}
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Catálogo de Equipos' },
            ]}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#102A56]">
                Catálogo de Equipos
              </h1>
              <p className="text-sm sm:text-base text-[#58708F] mt-1">
                Explora el inventario tecnológico disponible y gestiona solicitudes de préstamo institucional.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchCatalog}
                disabled={loading}
                leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
              >
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. MÉTRICAS DE CUPO DEL COLABORADOR (QUICK METRICS HEADER)
            ========================================================================= */}
        <section
          aria-label="Panel de cuotas de préstamo"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Tarjeta 1: Mis Préstamos Activos */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#58708F]">
                Mis Préstamos Activos
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#E8F2FF] flex items-center justify-center text-[#0B2F6B]">
                <Laptop className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#102A56]">
                {activosCount}
              </span>
              <span className="text-sm text-[#58708F]">
                / {cupoMaximo} asignados
              </span>
            </div>
            <div className="mt-3">
              <Tag
                variant={activosCount > 0 ? 'primary' : 'default'}
                size="sm"
              >
                {activosCount === 0
                  ? 'Sin préstamos en custodia'
                  : `${activosCount} equipo(s) actualmente en uso`}
              </Tag>
            </div>
          </div>

          {/* Tarjeta 2: Cupo Restante y Barra de Progreso */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#58708F]">
                Cupo Restante
              </span>
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  puedeSolicitar
                    ? 'bg-[#ECFDF5] text-[#065F46]'
                    : 'bg-[#FEF3C7] text-[#92400E]'
                }`}
              >
                {puedeSolicitar ? (
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#102A56]">
                {cupoRestante}
              </span>
              <span className="text-sm text-[#58708F]">
                {cupoRestante === 1 ? 'disponible' : 'disponibles'}
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar
                value={activosCount}
                max={cupoMaximo}
                size="sm"
                variant={cupoRestante === 0 ? 'warning' : 'primary'}
              />
              <p className="mt-2 text-xs text-[#58708F] flex items-center justify-between">
                <span>{activosCount} en uso</span>
                <span className={puedeSolicitar ? 'text-emerald-700 font-medium' : 'text-amber-800 font-medium'}>
                  {puedeSolicitar ? 'Puede solicitar' : 'Cupo máximo alcanzado'}
                </span>
              </p>
            </div>
          </div>

          {/* Tarjeta 3: Días Máximos por Préstamo */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#58708F]">
                Días Máximos por Préstamo
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#E8F2FF] flex items-center justify-center text-[#0B2F6B]">
                <Calendar className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#102A56]">
                30
              </span>
              <span className="text-sm text-[#58708F]">
                días por solicitud
              </span>
            </div>
            <div className="mt-3">
              <Tag variant="success" size="sm">
                Extensible 1 vez hasta +30 días
              </Tag>
            </div>
          </div>
        </section>

        {/* =========================================================================
            4. BARRA DE BÚSQUEDA Y FILTROS POR CATEGORÍA & ESTADO
            ========================================================================= */}
        <section
          aria-label="Filtros del catálogo"
          className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm space-y-4"
        >
          {/* Fila superior: Input de búsqueda y selector de estado */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Buscador debounced */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#58708F]">
                <Search className="w-4 h-4" aria-hidden="true" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por marca, modelo, código de inventario o serie..."
                className="w-full pl-10 pr-10 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#102A56] placeholder-[#58708F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                aria-label="Buscar equipos en catálogo"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#58708F] hover:text-[#102A56]"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selector de estado de inventario */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="filter-status" className="text-xs font-semibold text-[#58708F] whitespace-nowrap">
                Estado:
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EstadoEquipo | 'todos')}
                className="px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#102A56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-colors font-medium"
              >
                <option value="todos">Todos los Estados</option>
                <option value="disponible">Disponibles</option>
                <option value="prestado">Prestados</option>
                <option value="en_mantencion">En Mantención</option>
                <option value="de_baja">De Baja</option>
              </select>
            </div>
          </div>

          {/* Fila inferior: Chips de categoría y resumen */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F5F9]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#58708F] mr-1">
                Categorías:
              </span>
              <Chip
                label="Todos"
                active={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
                icon={<Filter className="w-3.5 h-3.5" />}
              />
              {categorias.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <Chip
                    key={cat.id}
                    label={cat.nombre}
                    active={isSelected}
                    onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                    icon={getCategoryChipIcon(cat.nombre)}
                  />
                );
              })}
            </div>

            {/* Contador de resultados y botón para limpiar */}
            <div className="flex items-center gap-3 text-xs text-[#58708F]">
              <span>
                Mostrando <strong className="text-[#102A56]">{equipos.length}</strong> de <strong className="text-[#102A56]">{totalEquipos}</strong> {totalEquipos === 1 ? 'equipo' : 'equipos'}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Alerta si el colaborador ya agotó su cupo de préstamos */}
        {!puedeSolicitar && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 flex items-start gap-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <strong className="font-semibold text-amber-950">
                Has alcanzado el límite máximo de préstamos activos (2 de 2).
              </strong>
              <p className="mt-0.5 text-amber-900/90 leading-relaxed">
                Para solicitar un nuevo equipo, debes gestionar la devolución de alguno de tus equipos actuales con el Encargado de TI.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            5. CATÁLOGO GRID (EQUIPOS)
            ========================================================================= */}
        <section aria-label="Listado de equipamiento tecnológico">
          {/* Estado de carga con Skeleton Cards */}
          {loading && equipos.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4 shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-5 bg-slate-200 rounded w-24" />
                    <div className="h-5 bg-slate-200 rounded w-20" />
                  </div>
                  <div className="h-24 bg-slate-100 rounded-lg flex items-center justify-center" />
                  <div className="space-y-2">
                    <div className="h-6 bg-slate-200 rounded w-3/4" />
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="h-10 bg-slate-200 rounded-lg w-full mt-4" />
                </div>
              ))}
            </div>
          )}

          {/* Estado de error */}
          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 text-center text-red-900 max-w-lg mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-red-950">
                Error al cargar el catálogo
              </h2>
              <p className="text-sm text-red-800 mt-1">{error}</p>
              <Button
                variant="danger"
                size="sm"
                className="mt-4"
                onClick={fetchCatalog}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Reintentar
              </Button>
            </div>
          )}

          {/* Estado vacío (sin resultados) */}
          {!loading && !error && equipos.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center max-w-lg mx-auto shadow-sm">
              <div className="w-14 h-14 rounded-full bg-[#F1F5F9] text-[#58708F] flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-[#102A56]">
                No se encontraron equipos
              </h2>
              <p className="text-sm text-[#58708F] mt-2 leading-relaxed">
                No hay equipos disponibles que coincidan con los criterios de búsqueda o filtros seleccionados.
              </p>
              {hasActiveFilters && (
                <div className="mt-5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    leftIcon={<RotateCcw className="w-4 h-4" />}
                  >
                    Restablecer Filtros
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Grilla de tarjetas de equipos */}
          {!error && equipos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equipos.map((equipo) => {
                const isDisponible = equipo.estado === 'disponible';
                const canRequestThis = isDisponible && puedeSolicitar;

                return (
                  <article
                    key={equipo.id}
                    className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group"
                  >
                    {/* Encabezado de la tarjeta con categoría y código */}
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#F8FAFC]">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#F1F5F9] text-[#102A56]">
                        {equipo.categoria?.nombre || 'Tecnología TI'}
                      </span>
                      <span className="font-mono text-xs font-medium text-[#58708F] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
                        {equipo.codigo_inventario}
                      </span>
                    </div>

                    {/* Ilustración / ícono del equipo */}
                    <div className="px-5 py-6 bg-gradient-to-b from-[#F8FAFC] to-white flex items-center justify-center border-b border-[#F1F5F9]">
                      <div className="w-20 h-20 rounded-2xl bg-white shadow-sm border border-[#E2E8F0] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200">
                        {getEquipmentIcon(equipo.categoria?.nombre, equipo.modelo)}
                      </div>
                    </div>

                    {/* Información del equipo */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className="text-base sm:text-lg font-bold text-[#102A56] leading-tight line-clamp-2"
                            title={`${equipo.marca} ${equipo.modelo}`}
                          >
                            {equipo.marca} {equipo.modelo}
                          </h3>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-[#58708F]">
                          <div className="flex items-center justify-between">
                            <span>Número de Serie:</span>
                            <span className="font-mono font-medium text-[#102A56]">
                              {equipo.numero_serie}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Estado Operativo:</span>
                            <Badge variant={equipo.estado} size="sm" />
                          </div>
                        </div>
                      </div>

                      {/* Botón de acción contextual */}
                      <div className="pt-2 border-t border-[#F8FAFC]">
                        {isDisponible ? (
                          canRequestThis ? (
                            <Button
                              variant="primary"
                              size="md"
                              className="w-full"
                              onClick={() => handleOpenSolicitudModal(equipo)}
                              leftIcon={<ArrowRight className="w-4 h-4" />}
                            >
                              Solicitar Préstamo
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="md"
                              className="w-full text-slate-400 border-slate-200 bg-slate-50 cursor-not-allowed"
                              disabled
                              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                              title="No puedes solicitar más equipos hasta liberar cupo activo (máx 2)."
                            >
                              Cupo Agotado (2/2)
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="secondary"
                            size="md"
                            className="w-full text-slate-400 border-slate-200 bg-slate-50 cursor-not-allowed"
                            disabled
                          >
                            {equipo.estado === 'prestado' && 'En Préstamo Activo'}
                            {equipo.estado === 'en_mantencion' && 'En Mantenimiento'}
                            {equipo.estado === 'de_baja' && 'De Baja'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* =========================================================================
          6. PIE CORPORATIVO INSTITUCIONAL (Figma: height 33px, fill #F6F9FC)
          ========================================================================= */}
      <footer className="w-full bg-[#F6F9FC] border-t border-[#E2E8F0] py-3 text-xs text-[#58708F] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span>Apiux SpA · Gestión Interna de Préstamos de Equipos TI</span>
          <span className="text-[11px] text-[#6A7F99]">
            Registro inmutable para auditoría conforme a ISO 27001 (5 años de retención)
          </span>
        </div>
      </footer>

      {/* =========================================================================
          7. MODAL DE SOLICITUD DE PRÉSTAMO / CONFIRMACIÓN
          ========================================================================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={solicitudExitosa ? 'Solicitud Registrada con Éxito' : 'Solicitar Préstamo de Equipo'}
        description={
          solicitudExitosa
            ? 'Tu requerimiento ha sido ingresado al sistema institucional bajo revisión.'
            : 'Confirma los detalles del equipo y la justificación técnica requerida por política de TI.'
        }
        maxWidth="lg"
      >
        {/* Caso 1: Éxito en la solicitud */}
        {solicitudExitosa ? (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#10B981] flex items-center justify-center mx-auto shadow-sm animate-in zoom-in-75 duration-300">
              <Check className="w-8 h-8 stroke-[2.5]" aria-hidden="true" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-bold text-[#102A56]">
                ¡Solicitud Enviada con Éxito!
              </h4>
              <p className="text-sm text-[#58708F] max-w-md mx-auto leading-relaxed">
                Tu solicitud quedó registrada con estado{' '}
                <strong className="text-blue-700 uppercase font-semibold">PENDIENTE</strong>. El
                Encargado de TI validará el requerimiento y te notificará la aprobación para la entrega física.
              </p>
            </div>

            {/* Ficha resumen de la solicitud procesada */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-left space-y-2.5 text-xs text-[#58708F]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-semibold text-[#102A56]">ID de Solicitud:</span>
                <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {solicitudExitosa.id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Equipo Solicitado:</span>
                <span className="font-semibold text-[#102A56]">
                  {selectedEquipo?.marca} {selectedEquipo?.modelo}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Código Inventario:</span>
                <span className="font-mono text-[#102A56]">
                  {selectedEquipo?.codigo_inventario}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Duración Solicitada:</span>
                <span className="font-medium text-[#102A56]">
                  {diasSolicitados} días corridos
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fecha Estimada Devolución:</span>
                <span className="font-medium text-emerald-700">
                  {formatEstimatedReturnDate(diasSolicitados)}
                </span>
              </div>
            </div>

            <div className="pt-3">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleCloseModal}
              >
                Volver al Catálogo
              </Button>
            </div>
          </div>
        ) : (
          /* Caso 2: Formulario de solicitud activa */
          <form onSubmit={handleSubmitPrestamo} className="space-y-5">
            {/* Banner resumen del equipo seleccionado */}
            {selectedEquipo && (
              <div className="bg-[#E8F2FF] border border-[#BFDBFE] rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0">
                  {getEquipmentIcon(selectedEquipo.categoria?.nombre, selectedEquipo.modelo)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                      {selectedEquipo.categoria?.nombre || 'Equipo TI'}
                    </span>
                    <span className="font-mono text-xs text-blue-800">
                      {selectedEquipo.codigo_inventario}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-[#0B2F6B] truncate mt-0.5">
                    {selectedEquipo.marca} {selectedEquipo.modelo}
                  </h4>
                  <p className="text-xs text-blue-700">
                    S/N: {selectedEquipo.numero_serie}
                  </p>
                </div>
              </div>
            )}

            {/* Selector de duración del préstamo (7, 15, 30 días) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#102A56]">
                Duración del Préstamo <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[7, 15, 30].map((dias) => {
                  const isSelected = diasSolicitados === dias;
                  return (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => setDiasSolicitados(dias)}
                      className={`py-2.5 px-3 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? 'border-[#0B2F6B] bg-[#E8F2FF] text-[#0B2F6B] font-bold shadow-sm ring-1 ring-[#0B2F6B]'
                          : 'border-[#CBD5E1] bg-white text-[#58708F] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <span className="text-sm font-semibold">{dias} Días</span>
                      <span className="text-[10px] opacity-80 mt-0.5">
                        {dias === 30 ? 'Máximo estándar' : 'Temporal'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[#58708F] flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                Fecha estimada de devolución: <strong className="text-[#102A56] capitalize">{formatEstimatedReturnDate(diasSolicitados)}</strong>
              </p>
            </div>

            {/* Motivo y Justificación Técnica */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="loan-motive"
                  className="block text-xs font-bold uppercase tracking-wider text-[#102A56]"
                >
                  Motivo y Requerimiento Técnico <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    motivo.trim().length >= 10 ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {motivo.trim().length}/10 mín.
                </span>
              </div>
              <textarea
                id="loan-motive"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                onBlur={() => setMotivoTouched(true)}
                placeholder="Especifica el proyecto cliente, rol o justificación técnica para el uso del equipo..."
                className={`w-full p-3 rounded-lg border text-sm text-[#102A56] placeholder-[#58708F] focus:outline-none focus:ring-2 transition-all ${
                  motivoTouched && motivo.trim().length < 10
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-[#CBD5E1] focus:ring-[#2563EB] bg-white'
                }`}
                aria-required="true"
              />
              {motivoTouched && motivo.trim().length < 10 && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  El motivo debe contener al menos 10 caracteres explicativos.
                </p>
              )}
            </div>

            {/* Checkbox de responsabilidad y custodia ISO 27001 */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-lg">
              <Checkbox
                id="custody-agreement"
                checked={aceptaCustodia}
                onChange={(checked) => setAceptaCustodia(checked)}
                label="Declaro responsabilidad de custodia corporativa"
                description="Asumo la custodia y buen uso del equipo asignado bajo las políticas de seguridad de la información ISO 27001 de Apiux Tecnología. Me comprometo a reportar cualquier incidente y gestionar su restitución en la fecha pactada."
                required
              />
            </div>

            {/* Mensaje de error si falla la llamada al endpoint */}
            {solicitudError && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-normal">{solicitudError}</div>
              </div>
            )}

            {/* Botones de acción del formulario */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={handleCloseModal}
                disabled={requesting}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={requesting}
                disabled={!aceptaCustodia || motivo.trim().length < 10 || requesting}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                Confirmar Solicitud
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default CatalogoEquipos;
