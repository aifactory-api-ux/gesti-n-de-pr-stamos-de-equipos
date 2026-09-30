import { useState, useEffect, useCallback } from 'react';
import apiClient from '../config/api';
import { InventoryMetrics } from '../types';

export interface UseMetricsResult {
  metrics: InventoryMetrics | null;
  loading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
  refetchMetrics: () => Promise<void>;
}

/**
 * Hook personalizado para consultar y refrescar los indicadores de resumen de inventario
 * corporativo desde el endpoint protegido de métricas (/api/v1/metricas/resumen).
 * Consumido principalmente por la consola del Encargado de TI (03_Panel_Encargado).
 */
export const useMetrics = (): UseMetricsResult => {
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<InventoryMetrics>('/api/v1/metricas/resumen');
      setMetrics(response.data);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Error al cargar las métricas de inventario';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    fetchMetrics,
    refetchMetrics: fetchMetrics,
  };
};

export default useMetrics;
