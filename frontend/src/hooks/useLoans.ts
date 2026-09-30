import { useState, useEffect, useCallback } from 'react';
import apiClient from '../config/api';
import {
  SolicitudPrestamo,
  Prestamo,
  RegistrarDevolucionDto,
  RenovarPrestamoDto,
} from '../types';

export interface UseLoansResult {
  solicitudes: SolicitudPrestamo[];
  solicitudesPendientes: SolicitudPrestamo[];
  prestamos: Prestamo[];
  prestamosActivos: Prestamo[];
  loading: boolean;
  loadingSolicitudes: boolean;
  loadingPrestamos: boolean;
  actionLoading: boolean;
  error: string | null;
  fetchSolicitudes: (params?: { estado?: string; page?: number; limit?: number }) => Promise<void>;
  fetchPrestamos: (params?: {
    estado?: string;
    por_vencer?: boolean;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  fetchDashboardData: () => Promise<void>;
  refreshAll: () => Promise<void>;
  aprobarSolicitud: (
    id: string,
    diasPrestamo?: number,
    observaciones?: string
  ) => Promise<SolicitudPrestamo>;
  rechazarSolicitud: (id: string, observaciones?: string) => Promise<SolicitudPrestamo>;
  registrarDevolucion: (id: string, dto: RegistrarDevolucionDto) => Promise<Prestamo>;
  renovarPrestamo: (
    id: string,
    dtoOrDias?: RenovarPrestamoDto | number,
    motivo?: string
  ) => Promise<Prestamo>;
}

/**
 * Hook para la gestión integral de solicitudes de préstamos y préstamos activos.
 * Maneja carga de datos, flujos de aprobación/rechazo de solicitudes, registro
 * de devoluciones físicas e inspección de estado, y renovación de préstamos.
 */
export const useLoans = (): UseLoansResult => {
  const [solicitudes, setSolicitudes] = useState<SolicitudPrestamo[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState<boolean>(true);
  const [loadingPrestamos, setLoadingPrestamos] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolicitudes = useCallback(
    async (params?: { estado?: string; page?: number; limit?: number }) => {
      setLoadingSolicitudes(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (params?.estado) queryParams.append('estado', params.estado);
        if (params?.page) queryParams.append('page', String(params.page));
        if (params?.limit) queryParams.append('limit', String(params.limit));

        const url = `/api/v1/solicitudes${
          queryParams.toString() ? `?${queryParams.toString()}` : ''
        }`;
        const response = await apiClient.get<{ data: SolicitudPrestamo[] }>(url);
        setSolicitudes(response.data?.data || []);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Error al cargar las solicitudes de préstamo';
        setError(msg);
      } finally {
        setLoadingSolicitudes(false);
      }
    },
    []
  );

  const fetchPrestamos = useCallback(
    async (params?: {
      estado?: string;
      por_vencer?: boolean;
      page?: number;
      limit?: number;
    }) => {
      setLoadingPrestamos(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (params?.estado) queryParams.append('estado', params.estado);
        if (params?.por_vencer !== undefined)
          queryParams.append('por_vencer', String(params.por_vencer));
        if (params?.page) queryParams.append('page', String(params.page));
        if (params?.limit) queryParams.append('limit', String(params.limit));

        const url = `/api/v1/prestamos${
          queryParams.toString() ? `?${queryParams.toString()}` : ''
        }`;
        const response = await apiClient.get<{ data: Prestamo[] }>(url);
        setPrestamos(response.data?.data || []);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Error al cargar los préstamos de equipos';
        setError(msg);
      } finally {
        setLoadingPrestamos(false);
      }
    },
    []
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchSolicitudes({ estado: 'pendiente' }),
      fetchPrestamos(),
    ]);
  }, [fetchSolicitudes, fetchPrestamos]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const resolverSolicitud = async (
    id: string,
    estado: 'aprobada' | 'rechazada',
    diasPrestamo?: number,
    observaciones?: string
  ): Promise<SolicitudPrestamo> => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await apiClient.patch<SolicitudPrestamo>(
        `/api/v1/solicitudes/${id}/resolver`,
        {
          estado,
          dias_prestamo: diasPrestamo,
          observaciones,
        }
      );
      await refreshAll();
      return response.data;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al resolver la solicitud de préstamo';
      setError(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const aprobarSolicitud = async (
    id: string,
    diasPrestamo: number = 30,
    observaciones?: string
  ): Promise<SolicitudPrestamo> => {
    return resolverSolicitud(id, 'aprobada', diasPrestamo, observaciones);
  };

  const rechazarSolicitud = async (
    id: string,
    observaciones?: string
  ): Promise<SolicitudPrestamo> => {
    return resolverSolicitud(id, 'rechazada', undefined, observaciones);
  };

  const registrarDevolucion = async (
    id: string,
    dto: RegistrarDevolucionDto
  ): Promise<Prestamo> => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<Prestamo>(
        `/api/v1/prestamos/${id}/devolucion`,
        dto
      );
      await refreshAll();
      return response.data;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al registrar la devolución del préstamo';
      setError(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const renovarPrestamo = async (
    id: string,
    dtoOrDias?: RenovarPrestamoDto | number,
    motivo?: string
  ): Promise<Prestamo> => {
    setActionLoading(true);
    setError(null);
    try {
      let payload: RenovarPrestamoDto;
      if (typeof dtoOrDias === 'number') {
        payload = {
          dias_extension: dtoOrDias,
          motivo_renovacion: motivo || 'Renovación de préstamo solicitada por el encargado',
        };
      } else if (dtoOrDias && typeof dtoOrDias === 'object') {
        payload = {
          dias_extension: dtoOrDias.dias_extension ?? 30,
          motivo_renovacion:
            dtoOrDias.motivo_renovacion || motivo || 'Renovación de préstamo solicitada por el encargado',
        };
      } else {
        payload = {
          dias_extension: 30,
          motivo_renovacion: motivo || 'Renovación de préstamo solicitada por el encargado',
        };
      }

      const response = await apiClient.post<Prestamo>(
        `/api/v1/prestamos/${id}/renovar`,
        payload
      );
      await refreshAll();
      return response.data;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al renovar el préstamo de equipo';
      setError(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const loading = loadingSolicitudes || loadingPrestamos;
  const solicitudesPendientes = solicitudes.filter(
    (s) => !s.estado || s.estado === 'pendiente'
  );
  const prestamosActivos = prestamos.filter(
    (p) => !p.estado || p.estado === 'activo' || p.estado === 'vencido'
  );

  return {
    solicitudes,
    solicitudesPendientes,
    prestamos,
    prestamosActivos,
    loading,
    loadingSolicitudes,
    loadingPrestamos,
    actionLoading,
    error,
    fetchSolicitudes,
    fetchPrestamos,
    fetchDashboardData: refreshAll,
    refreshAll,
    aprobarSolicitud,
    rechazarSolicitud,
    registrarDevolucion,
    renovarPrestamo,
  };
};

export default useLoans;
