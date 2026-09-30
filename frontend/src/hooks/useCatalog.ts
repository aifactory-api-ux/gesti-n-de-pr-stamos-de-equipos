import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../config/api';
import { Equipo, Categoria, SolicitarPrestamoDto, SolicitudPrestamo } from '../types';
import { useAuth } from './useAuth';

export interface UseCatalogReturn {
  equipos: Equipo[];
  categorias: Categoria[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null;
  searchTerm: string;
  statusFilter: string;
  setSelectedCategory: (catId: string | null) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  fetchCatalog: () => Promise<void>;
  submitSolicitud: (dto: SolicitarPrestamoDto) => Promise<SolicitudPrestamo>;
  requesting: boolean;
  totalEquipos: number;
}

export function useCatalog(): UseCatalogReturn {
  const { refreshProfile } = useAuth();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [requesting, setRequesting] = useState<boolean>(false);
  const [totalEquipos, setTotalEquipos] = useState<number>(0);

  // Debounce para el término de búsqueda (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Carga inicial de categorías una sola vez
  useEffect(() => {
    let isMounted = true;
    const loadCategorias = async () => {
      try {
        const res = await apiClient.get<Categoria[]>('/api/v1/categorias');
        if (isMounted && Array.isArray(res.data)) {
          setCategorias(res.data);
        }
      } catch (err: any) {
        console.warn('Error al cargar categorías:', err);
      }
    };

    loadCategorias();
    return () => {
      isMounted = false;
    };
  }, []);

  // Función principal para obtener equipos con filtros aplicados
  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        page: 1,
        limit: 50,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (selectedCategory && selectedCategory !== 'todos') {
        params.categoria_id = selectedCategory;
      }

      if (statusFilter && statusFilter !== 'todos') {
        params.estado = statusFilter;
      }

      const res = await apiClient.get<{
        data: Equipo[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>('/api/v1/equipos', { params });

      if (res.data && Array.isArray(res.data.data)) {
        setEquipos(res.data.data);
        setTotalEquipos(res.data.total ?? res.data.data.length);
      } else if (Array.isArray(res.data)) {
        setEquipos(res.data);
        setTotalEquipos((res.data as any[]).length);
      } else {
        setEquipos([]);
        setTotalEquipos(0);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al obtener el catálogo de equipos.';
      setError(msg);
      setEquipos([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory, statusFilter]);

  // Ejecuta la consulta cada vez que cambien los filtros reactivos
  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Envío seguro de solicitud de préstamo a la API
  const submitSolicitud = useCallback(
    async (dto: SolicitarPrestamoDto): Promise<SolicitudPrestamo> => {
      try {
        setRequesting(true);
        setError(null);

        const res = await apiClient.post<SolicitudPrestamo>('/api/v1/solicitudes', {
          equipo_id: dto.equipo_id,
          motivo: dto.motivo,
          dias_solicitados: dto.dias_solicitados,
        });

        // Refrescar el catálogo para reflejar nuevo estado de equipos
        await fetchCatalog();

        // Refrescar cupo de usuario en contexto de autenticación
        try {
          await refreshProfile();
        } catch {
          // Si el perfil no actualiza de inmediato, no bloquear el éxito de la solicitud
        }

        return res.data;
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          'Error al procesar la solicitud de préstamo.';
        setError(errorMsg);
        throw err;
      } finally {
        setRequesting(false);
      }
    },
    [fetchCatalog, refreshProfile]
  );

  return {
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
  };
}

export default useCatalog;
