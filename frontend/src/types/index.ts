/**
 * Contratos de datos del Frontend para el Sistema de Gestión de Préstamos Apiux.
 * Corresponden 1:1 con el esquema del backend y la especificación técnica.
 */

export type RolUsuario = 'colaborador' | 'administrador_ti';
export type EstadoUsuario = 'activo' | 'inactivo';
export type EstadoEquipo = 'disponible' | 'prestado' | 'en_mantencion' | 'de_baja';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';
export type EstadoPrestamo = 'activo' | 'devuelto' | 'vencido';

export interface Usuario {
  id: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  creado_en: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Equipo {
  id: string;
  codigo_inventario: string;
  categoria_id: string;
  categoria?: Categoria;
  marca: string;
  modelo: string;
  numero_serie: string;
  estado: EstadoEquipo;
  creado_en: string;
}

export interface SolicitudPrestamo {
  id: string;
  usuario_id: string;
  usuario?: Usuario;
  equipo_id: string;
  equipo?: Equipo;
  estado: EstadoSolicitud;
  motivo: string;
  fecha_solicitud: string;
  fecha_resolucion: string | null;
  resuelto_por: string | null;
  resolutor?: Usuario | null;
}

export interface Prestamo {
  id: string;
  solicitud_id: string;
  solicitud?: SolicitudPrestamo;
  usuario_id: string;
  usuario?: Usuario;
  equipo_id: string;
  equipo?: Equipo;
  encargado_entrega_id: string;
  encargado_entrega?: Usuario;
  encargado_devolucion_id: string | null;
  encargado_devolucion?: Usuario | null;
  fecha_inicio: string;
  fecha_vencimiento: string;
  renovado: boolean;
  fecha_devolucion: string | null;
  estado: EstadoPrestamo;
  observaciones: string | null;
}

export interface Auditoria {
  id: string;
  tabla_afectada: string;
  registro_id: string;
  accion: string;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario?: Usuario | null;
  fecha_evento: string;
  direccion_ip: string;
}

export interface InventoryMetrics {
  total_activos: number;
  total_equipos?: number;
  equipos_disponibles?: number;
  equipos_prestados?: number;
  equipos_en_mantencion?: number;
  prestamos_activos: number;
  prestamos_vencidos?: number;
  solicitudes_pendientes: number;
  por_vencer: number;
}

export interface CollaboratorQuota {
  prestamos_activos_count: number;
  cupo_maximo: number;
  cupo_restante: number;
  puede_solicitar: boolean;
}

export interface SolicitarPrestamoDto {
  equipo_id: string;
  motivo: string;
  dias_solicitados: number; // 1 a 30 días
}

export interface ResolverSolicitudDto {
  estado: 'aprobada' | 'rechazada';
  observaciones?: string;
  dias_prestamo?: number; // Por defecto 30 días si es aprobada
}

export interface RegistrarDevolucionDto {
  observaciones: string;
  estado_fisico_equipo: 'disponible' | 'en_mantencion' | 'de_baja';
}

export interface RenovarPrestamoDto {
  dias_extension: number; // Hasta 30 días, permitido una sola vez
  motivo_renovacion: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}
