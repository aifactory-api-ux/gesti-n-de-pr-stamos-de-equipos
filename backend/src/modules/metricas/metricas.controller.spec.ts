import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';
import { MetricasResumenDto } from './dto/metricas-resumen.dto';
import { HealthCheckResponseDto } from './dto/health-check.dto';
import { RolUsuario } from '../../database/entities/usuario.entity';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('MetricasController', () => {
  let controller: MetricasController;
  let serviceMock: any;
  let reflector: Reflector;

  const mockResumen: MetricasResumenDto = {
    total_equipos: 150,
    equipos_disponibles: 98,
    equipos_prestados: 42,
    equipos_en_mantencion: 10,
    prestamos_activos: 42,
    prestamos_vencidos: 3,
    solicitudes_pendientes: 5,
    total_activos: 150,
    por_vencer: 3,
  };

  const mockHealth: HealthCheckResponseDto = {
    status: 'ok',
    service: 'prestamo-equipos-backend',
    version: '1.0.0',
    timestamp: '2026-09-30T18:00:00.000Z',
    info: {
      database: {
        status: 'up',
      },
      uptime_seconds: 12345,
    },
  };

  const mockPrometheusText = '# HELP http_requests_total Total\nhttp_requests_total 42';

  beforeEach(async () => {
    serviceMock = {
      getMetricasResumen: jest.fn().mockResolvedValue(mockResumen),
      getHealthCheck: jest.fn().mockResolvedValue(mockHealth),
      getPrometheusMetrics: jest.fn().mockResolvedValue(mockPrometheusText),
      getPrometheusContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
    };

    reflector = new Reflector();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricasController],
      providers: [
        {
          provide: MetricasService,
          useValue: serviceMock,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    controller = module.get<MetricasController>(MetricasController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido el controlador', () => {
    expect(controller).toBeDefined();
  });

  describe('Metadatos y Decoradores de Seguridad', () => {
    it('debe tener configurado el rol administrador_ti en el método getMetricasResumen', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.getMetricasResumen,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(RolUsuario.ADMINISTRADOR_TI);
    });

    it('no debe requerir roles para el endpoint público getHealth', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.getHealth,
      );
      expect(roles).toBeUndefined();
    });

    it('no debe requerir roles para el endpoint público getMetrics', () => {
      const roles = reflector.get<(RolUsuario | string)[]>(
        ROLES_KEY,
        controller.getMetrics,
      );
      expect(roles).toBeUndefined();
    });
  });

  describe('getMetricasResumen', () => {
    it('debe invocar al servicio y retornar el resumen de métricas operacionales', async () => {
      const resultado = await controller.getMetricasResumen();

      expect(serviceMock.getMetricasResumen).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual(mockResumen);
      expect(resultado.total_activos).toBe(150);
      expect(resultado.prestamos_activos).toBe(42);
      expect(resultado.solicitudes_pendientes).toBe(5);
      expect(resultado.por_vencer).toBe(3);
    });
  });

  describe('getHealth', () => {
    it('debe invocar al servicio y retornar el estado de salud del sistema', async () => {
      const resultado = await controller.getHealth();

      expect(serviceMock.getHealthCheck).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual(mockHealth);
      expect(resultado.status).toBe('ok');
      expect(resultado.info.database.status).toBe('up');
    });
  });

  describe('getMetrics', () => {
    it('debe invocar al servicio y retornar el string de métricas de Prometheus', async () => {
      const resultado = await controller.getMetrics();

      expect(serviceMock.getPrometheusMetrics).toHaveBeenCalledTimes(1);
      expect(resultado).toBe(mockPrometheusText);
      expect(typeof resultado).toBe('string');
    });
  });
});
