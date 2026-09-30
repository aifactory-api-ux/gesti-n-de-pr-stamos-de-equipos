import {
  Controller,
  Get,
  Header,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MetricasService } from './metricas.service';
import { MetricasResumenDto } from './dto/metricas-resumen.dto';
import { HealthCheckResponseDto } from './dto/health-check.dto';
import { AzureAuthGuard } from '../../common/guards/azure-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolUsuario } from '../../database/entities/usuario.entity';

/**
 * Controlador de Métricas y Observabilidad del Sistema.
 * Expone:
 * - GET /api/v1/metricas/resumen: Indicadores consolidados del dashboard TI (protegido administrador_ti).
 * - GET /health: Sonda de liveness y readiness para Cloud Run / GCP LB (público).
 * - GET /metrics: Métricas estándar de Prometheus para scraping (público).
 */
@ApiTags('Métricas y Observabilidad')
@Controller()
export class MetricasController {
  constructor(private readonly metricasService: MetricasService) {}

  /**
   * Resumen operacional consolidado para el administrador TI.
   * Total de inventario, equipos por estado, préstamos activos/vencidos/por vencer y solicitudes pendientes.
   */
  @Get('api/v1/metricas/resumen')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AzureAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR_TI)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener resumen numérico de métricas operacionales',
    description:
      'Retorna contadores agregados en tiempo real para el panel de administración TI. Requiere rol de administrador_ti.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen de indicadores consolidado exitosamente',
    type: MetricasResumenDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado - Token JWT ausente o inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permisos insuficientes - Requiere rol de administrador_ti',
  })
  async getMetricasResumen(): Promise<MetricasResumenDto> {
    return this.metricasService.getMetricasResumen();
  }

  /**
   * Sonda de verificación de salud del servicio (Liveness / Readiness probe).
   * Monitorea el estado del proceso Node.js y la conectividad activa con PostgreSQL.
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Endpoint de verificación de estado y salud del servicio',
    description:
      'Comprueba la conectividad de la base de datos relacional y el tiempo de actividad del proceso. No requiere autenticación.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Servicio y dependencias operando correctamente',
    type: HealthCheckResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Fallo de conectividad con la base de datos o servicio no listo',
  })
  async getHealth(): Promise<HealthCheckResponseDto> {
    return this.metricasService.getHealthCheck();
  }

  /**
   * Sondas alternativas de salud para compatibilidad con balanceadores GCP / K8s / curl checks.
   * Responde en /healthz, /api/health y /api/healthz con HTTP 200 y estado de PostgreSQL.
   */
  @Get(['healthz', 'api/health', 'api/healthz'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Endpoints alternativos de verificación de salud (healthz, api/health, api/healthz)',
  })
  async getHealthAliases(): Promise<HealthCheckResponseDto> {
    return this.metricasService.getHealthCheck();
  }

  /**
   * Sonda ligera ping / pong para validación inmediata de conectividad.
   * Responde en /ping, /api/ping y /api/v1/ping con HTTP 200.
   */
  @Get(['ping', 'api/ping', 'api/v1/ping'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sonda básica de disponibilidad ping/pong',
  })
  async getPing(): Promise<{ status: string; message: string; timestamp: string }> {
    return {
      status: 'ok',
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Endpoint de exportación de métricas para Prometheus.
   * Retorna contadores HTTP, latencias de peticiones, métricas del runtime Node.js
   * e indicadores de negocio en formato estándar de texto plano Prometheus.
   */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Métricas de Prometheus de la aplicación',
    description:
      'Retorna las métricas acumuladas por prom-client en formato estándar Prometheus (OpenMetrics). No requiere autenticación.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Métricas exportadas en formato de texto plano estándar Prometheus',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.metricasService.getPrometheusMetrics();
  }
}
