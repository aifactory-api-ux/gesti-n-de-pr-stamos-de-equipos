import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import * as client from 'prom-client';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import {
  SolicitudPrestamoEntity,
  EstadoSolicitud,
} from '../../database/entities/solicitud_prestamo.entity';
import { metricsRegistry } from '../../common/interceptors/metrics.interceptor';
import { MetricasResumenDto } from './dto/metricas-resumen.dto';
import { HealthCheckResponseDto } from './dto/health-check.dto';

/**
 * Métrica Prometheus tipo Gauge para monitorear préstamos por estado.
 */
export const prestamosStatusGauge =
  (metricsRegistry.getSingleMetric('prestamos_status_total') as client.Gauge<string>) ||
  new client.Gauge({
    name: 'prestamos_status_total',
    help: 'Total de préstamos según su estado actual (activo, devuelto, vencido)',
    labelNames: ['estado'],
    registers: [metricsRegistry],
  });

/**
 * Métrica Prometheus tipo Gauge para monitorear equipos por estado físico/operativo.
 */
export const equiposStatusGauge =
  (metricsRegistry.getSingleMetric('equipos_status_total') as client.Gauge<string>) ||
  new client.Gauge({
    name: 'equipos_status_total',
    help: 'Total de equipos en inventario según su estado operativo (disponible, prestado, en_mantencion, de_baja)',
    labelNames: ['estado'],
    registers: [metricsRegistry],
  });

/**
 * Servicio encargado de la agregación de métricas de negocio para el panel de administración,
 * verificación de salud del sistema e infraestructura (PostgreSQL), y exposición de métricas
 * para Prometheus y Google Cloud Monitoring.
 */
@Injectable()
export class MetricasService {
  private readonly logger = new Logger(MetricasService.name);

  constructor(
    @InjectRepository(EquipoEntity)
    private readonly equipoRepository: Repository<EquipoEntity>,
    @InjectRepository(PrestamoEntity)
    private readonly prestamoRepository: Repository<PrestamoEntity>,
    @InjectRepository(SolicitudPrestamoEntity)
    private readonly solicitudRepository: Repository<SolicitudPrestamoEntity>,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  /**
   * Obtiene los indicadores y contadores agregados en tiempo real para el dashboard de administración.
   * Realiza conteos paralelos en PostgreSQL para minimizar la latencia de respuesta.
   */
  async getMetricasResumen(): Promise<MetricasResumenDto> {
    const ahora = new Date();
    const limite3Dias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [
      totalEquipos,
      equiposDisponibles,
      equiposPrestados,
      equiposEnMantencion,
      prestamosActivos,
      prestamosVencidos,
      solicitudesPendientes,
      porVencer,
    ] = await Promise.all([
      this.equipoRepository.count(),
      this.equipoRepository.count({ where: { estado: EstadoEquipo.DISPONIBLE } }),
      this.equipoRepository.count({ where: { estado: EstadoEquipo.PRESTADO } }),
      this.equipoRepository.count({ where: { estado: EstadoEquipo.EN_MANTENCION } }),
      this.prestamoRepository.count({ where: { estado: EstadoPrestamo.ACTIVO } }),
      this.prestamoRepository.count({ where: { estado: EstadoPrestamo.VENCIDO } }),
      this.solicitudRepository.count({ where: { estado: EstadoSolicitud.PENDIENTE } }),
      this.prestamoRepository.count({
        where: {
          estado: EstadoPrestamo.ACTIVO,
          fecha_vencimiento: Between(ahora, limite3Dias),
        },
      }),
    ]);

    // Actualizar gauges de negocio en Prometheus
    equiposStatusGauge.set({ estado: EstadoEquipo.DISPONIBLE }, equiposDisponibles);
    equiposStatusGauge.set({ estado: EstadoEquipo.PRESTADO }, equiposPrestados);
    equiposStatusGauge.set({ estado: EstadoEquipo.EN_MANTENCION }, equiposEnMantencion);
    prestamosStatusGauge.set({ estado: EstadoPrestamo.ACTIVO }, prestamosActivos);
    prestamosStatusGauge.set({ estado: EstadoPrestamo.VENCIDO }, prestamosVencidos);

    return {
      total_equipos: totalEquipos,
      equipos_disponibles: equiposDisponibles,
      equipos_prestados: equiposPrestados,
      equipos_en_mantencion: equiposEnMantencion,
      prestamos_activos: prestamosActivos,
      prestamos_vencidos: prestamosVencidos,
      solicitudes_pendientes: solicitudesPendientes,
      total_activos: totalEquipos,
      por_vencer: porVencer,
    };
  }

  /**
   * Ejecuta la verificación de liveness/readiness del servicio.
   * Valida conectividad directa con PostgreSQL ejecutando 'SELECT 1'.
   * Lanza ServiceUnavailableException (HTTP 503) si la base de datos no responde.
   */
  async getHealthCheck(): Promise<HealthCheckResponseDto> {
    const timestamp = new Date().toISOString();
    const uptimeSeconds = Math.floor(process.uptime());

    try {
      if (!this.dataSource || !this.dataSource.isInitialized) {
        throw new Error('Conexión con PostgreSQL no inicializada o desconectada');
      }

      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        service: 'prestamo-equipos-backend',
        version: '1.0.0',
        timestamp,
        info: {
          database: {
            status: 'up',
          },
          uptime_seconds: uptimeSeconds,
        },
      };
    } catch (error) {
      const errorMessage = error?.message || 'Error desconocido de conexión con la base de datos';
      this.logger.error(`Fallo en health check de base de datos: ${errorMessage}`, error?.stack);

      throw new ServiceUnavailableException({
        status: 'error',
        service: 'prestamo-equipos-backend',
        version: '1.0.0',
        timestamp,
        info: {
          database: {
            status: 'down',
            error: errorMessage,
          },
          uptime_seconds: uptimeSeconds,
        },
      });
    }
  }

  /**
   * Genera el payload de métricas en formato texto estándar Prometheus.
   * Refresca previamente los indicadores de negocio del inventario.
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      await this.getMetricasResumen();
    } catch (error) {
      this.logger.warn(
        `No fue posible refrescar las métricas de negocio antes de exportar Prometheus: ${error?.message}`,
      );
    }
    return metricsRegistry.metrics();
  }

  /**
   * Retorna el Content-Type estándar para métricas Prometheus.
   */
  getPrometheusContentType(): string {
    return metricsRegistry.contentType;
  }
}
