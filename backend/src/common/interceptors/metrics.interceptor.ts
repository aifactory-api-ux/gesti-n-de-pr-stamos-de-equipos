import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import * as client from 'prom-client';

/**
 * Registro de métricas de Prometheus.
 */
export const metricsRegistry = client.register;

// Inicialización de recolección de métricas por defecto de Node.js (CPU, memoria, GC)
if (!client.register.getSingleMetric('process_cpu_user_seconds_total')) {
  client.collectDefaultMetrics({ register: metricsRegistry });
}

/**
 * Histograma para medir la latencia de las peticiones HTTP en segundos.
 * Incluye un bucket explícito en 0.5s para verificar el SLA de 500ms bajo carga concurrente.
 */
export const httpRequestDurationHistogram =
  (metricsRegistry.getSingleMetric(
    'http_request_duration_seconds',
  ) as client.Histogram<string>) ||
  new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duración de las peticiones HTTP procesadas por la API en segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [metricsRegistry],
  });

/**
 * Contador acumulativo del total de peticiones HTTP recibidas por la API.
 */
export const httpRequestsTotalCounter =
  (metricsRegistry.getSingleMetric('http_requests_total') as client.Counter<string>) ||
  new client.Counter({
    name: 'http_requests_total',
    help: 'Total de peticiones HTTP procesadas por método, ruta y código de estado',
    labelNames: ['method', 'route', 'status_code'],
    registers: [metricsRegistry],
  });

/**
 * Indicador de peticiones HTTP activas en procesamiento simultáneo.
 */
export const httpRequestsActiveGauge =
  (metricsRegistry.getSingleMetric(
    'http_requests_active',
  ) as client.Gauge<string>) ||
  new client.Gauge({
    name: 'http_requests_active',
    help: 'Cantidad de peticiones HTTP activas actualmente en ejecución',
    labelNames: ['method'],
    registers: [metricsRegistry],
  });

/**
 * Interceptor para recopilar métricas de rendimiento y disponibilidad de la API REST
 * compatibles con Prometheus y Cloud Monitoring.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method?.toUpperCase() || 'UNKNOWN';
    const route = this.normalizarRuta(request);

    // Incrementar peticiones en vuelo
    httpRequestsActiveGauge.inc({ method });

    const hrstartTime = process.hrtime();

    const registrarMetricas = (statusCode: number) => {
      httpRequestsActiveGauge.dec({ method });

      const hrendTime = process.hrtime(hrstartTime);
      const duracionSegundos = hrendTime[0] + hrendTime[1] / 1e9;
      const statusStr = statusCode.toString();

      httpRequestsTotalCounter.inc({
        method,
        route,
        status_code: statusStr,
      });

      httpRequestDurationHistogram.observe(
        {
          method,
          route,
          status_code: statusStr,
        },
        duracionSegundos,
      );
    };

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode || 200;
        registrarMetricas(statusCode);
      }),
      catchError((error) => {
        const statusCode =
          error.status ||
          error.statusCode ||
          (error.getStatus ? error.getStatus() : 500);
        registrarMetricas(statusCode);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Normaliza la ruta para evitar alta cardinalidad en Prometheus reemplazando UUIDs y parámetros numéricos.
   */
  private normalizarRuta(request: any): string {
    const routePath = request.route?.path || request.path || request.url || 'unknown';
    return routePath
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id')
      .split('?')[0];
  }
}
