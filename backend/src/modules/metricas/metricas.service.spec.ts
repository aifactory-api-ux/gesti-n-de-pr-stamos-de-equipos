import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  MetricasService,
  equiposStatusGauge,
  prestamosStatusGauge,
} from './metricas.service';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import {
  SolicitudPrestamoEntity,
  EstadoSolicitud,
} from '../../database/entities/solicitud_prestamo.entity';

describe('MetricasService', () => {
  let service: MetricasService;
  let equipoRepositoryMock: any;
  let prestamoRepositoryMock: any;
  let solicitudRepositoryMock: any;
  let dataSourceMock: any;

  beforeEach(async () => {
    equipoRepositoryMock = {
      count: jest.fn(),
    };

    prestamoRepositoryMock = {
      count: jest.fn(),
    };

    solicitudRepositoryMock = {
      count: jest.fn(),
    };

    dataSourceMock = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricasService,
        {
          provide: getRepositoryToken(EquipoEntity),
          useValue: equipoRepositoryMock,
        },
        {
          provide: getRepositoryToken(PrestamoEntity),
          useValue: prestamoRepositoryMock,
        },
        {
          provide: getRepositoryToken(SolicitudPrestamoEntity),
          useValue: solicitudRepositoryMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<MetricasService>(MetricasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido el servicio de métricas', () => {
    expect(service).toBeDefined();
  });

  describe('getMetricasResumen', () => {
    it('debe calcular correctamente los contadores consolidados de inventario, préstamos y solicitudes', async () => {
      // Mock de conteos para equipos
      equipoRepositoryMock.count.mockImplementation((criteria?: any) => {
        if (!criteria) return Promise.resolve(150); // total_equipos
        if (criteria.where?.estado === EstadoEquipo.DISPONIBLE) return Promise.resolve(95);
        if (criteria.where?.estado === EstadoEquipo.PRESTADO) return Promise.resolve(45);
        if (criteria.where?.estado === EstadoEquipo.EN_MANTENCION) return Promise.resolve(10);
        return Promise.resolve(0);
      });

      // Mock de conteos para préstamos
      prestamoRepositoryMock.count.mockImplementation((criteria?: any) => {
        if (criteria?.where?.estado === EstadoPrestamo.ACTIVO && criteria?.where?.fecha_vencimiento) {
          return Promise.resolve(7); // por_vencer en <= 3 días
        }
        if (criteria?.where?.estado === EstadoPrestamo.ACTIVO) return Promise.resolve(45);
        if (criteria?.where?.estado === EstadoPrestamo.VENCIDO) return Promise.resolve(3);
        return Promise.resolve(0);
      });

      // Mock de conteos para solicitudes
      solicitudRepositoryMock.count.mockImplementation((criteria?: any) => {
        if (criteria?.where?.estado === EstadoSolicitud.PENDIENTE) return Promise.resolve(8);
        return Promise.resolve(0);
      });

      const spyEquiposGauge = jest.spyOn(equiposStatusGauge, 'set');
      const spyPrestamosGauge = jest.spyOn(prestamosStatusGauge, 'set');

      const resultado = await service.getMetricasResumen();

      expect(resultado).toBeDefined();
      expect(resultado.total_equipos).toBe(150);
      expect(resultado.equipos_disponibles).toBe(95);
      expect(resultado.equipos_prestados).toBe(45);
      expect(resultado.equipos_en_mantencion).toBe(10);
      expect(resultado.prestamos_activos).toBe(45);
      expect(resultado.prestamos_vencidos).toBe(3);
      expect(resultado.solicitudes_pendientes).toBe(8);
      expect(resultado.total_activos).toBe(150);
      expect(resultado.por_vencer).toBe(7);

      // Verificación de actualización en gauges de Prometheus
      expect(spyEquiposGauge).toHaveBeenCalledWith({ estado: EstadoEquipo.DISPONIBLE }, 95);
      expect(spyEquiposGauge).toHaveBeenCalledWith({ estado: EstadoEquipo.PRESTADO }, 45);
      expect(spyEquiposGauge).toHaveBeenCalledWith({ estado: EstadoEquipo.EN_MANTENCION }, 10);
      expect(spyPrestamosGauge).toHaveBeenCalledWith({ estado: EstadoPrestamo.ACTIVO }, 45);
      expect(spyPrestamosGauge).toHaveBeenCalledWith({ estado: EstadoPrestamo.VENCIDO }, 3);
    });

    it('debe manejar repositorios vacíos retornando ceros sin fallar', async () => {
      equipoRepositoryMock.count.mockResolvedValue(0);
      prestamoRepositoryMock.count.mockResolvedValue(0);
      solicitudRepositoryMock.count.mockResolvedValue(0);

      const resultado = await service.getMetricasResumen();

      expect(resultado.total_equipos).toBe(0);
      expect(resultado.equipos_disponibles).toBe(0);
      expect(resultado.equipos_prestados).toBe(0);
      expect(resultado.equipos_en_mantencion).toBe(0);
      expect(resultado.prestamos_activos).toBe(0);
      expect(resultado.prestamos_vencidos).toBe(0);
      expect(resultado.solicitudes_pendientes).toBe(0);
      expect(resultado.total_activos).toBe(0);
      expect(resultado.por_vencer).toBe(0);
    });
  });

  describe('getHealthCheck', () => {
    it('debe responder status ok y base de datos up cuando PostgreSQL responde', async () => {
      const resultado = await service.getHealthCheck();

      expect(resultado).toBeDefined();
      expect(resultado.status).toBe('ok');
      expect(resultado.service).toBe('prestamo-equipos-backend');
      expect(resultado.version).toBe('1.0.0');
      expect(resultado.timestamp).toBeDefined();
      expect(new Date(resultado.timestamp).toString()).not.toBe('Invalid Date');
      expect(resultado.info).toBeDefined();
      expect(resultado.info.database.status).toBe('up');
      expect(typeof resultado.info.uptime_seconds).toBe('number');
      expect(dataSourceMock.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('debe lanzar ServiceUnavailableException si la consulta SQL SELECT 1 arroja error', async () => {
      dataSourceMock.query.mockRejectedValue(new Error('Connection lost'));

      await expect(service.getHealthCheck()).rejects.toThrow(ServiceUnavailableException);

      try {
        await service.getHealthCheck();
      } catch (exception: any) {
        expect(exception).toBeInstanceOf(ServiceUnavailableException);
        const response = exception.getResponse();
        expect(response.status).toBe('error');
        expect(response.info.database.status).toBe('down');
        expect(response.info.database.error).toContain('Connection lost');
      }
    });

    it('debe lanzar ServiceUnavailableException si DataSource no está inicializado', async () => {
      dataSourceMock.isInitialized = false;

      await expect(service.getHealthCheck()).rejects.toThrow(ServiceUnavailableException);
    });

    it('debe lanzar ServiceUnavailableException si DataSource es nulo o indefinido', async () => {
      const moduleWithoutDb: TestingModule = await Test.createTestingModule({
        providers: [
          MetricasService,
          {
            provide: getRepositoryToken(EquipoEntity),
            useValue: equipoRepositoryMock,
          },
          {
            provide: getRepositoryToken(PrestamoEntity),
            useValue: prestamoRepositoryMock,
          },
          {
            provide: getRepositoryToken(SolicitudPrestamoEntity),
            useValue: solicitudRepositoryMock,
          },
        ],
      }).compile();

      const serviceWithoutDb = moduleWithoutDb.get<MetricasService>(MetricasService);
      await expect(serviceWithoutDb.getHealthCheck()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('getPrometheusMetrics y getPrometheusContentType', () => {
    it('debe retornar las métricas en formato texto plano de Prometheus', async () => {
      equipoRepositoryMock.count.mockResolvedValue(10);
      prestamoRepositoryMock.count.mockResolvedValue(5);
      solicitudRepositoryMock.count.mockResolvedValue(2);

      const metricsString = await service.getPrometheusMetrics();

      expect(typeof metricsString).toBe('string');
      expect(metricsString).toContain('http_requests_total');
      expect(metricsString).toContain('http_request_duration_seconds');
      expect(metricsString).toContain('prestamos_status_total');
      expect(metricsString).toContain('equipos_status_total');
    });

    it('debe tolerar fallos en el refresco de métricas de negocio sin interrumpir la exportación', async () => {
      equipoRepositoryMock.count.mockRejectedValue(new Error('DB Timeout'));

      const metricsString = await service.getPrometheusMetrics();

      expect(typeof metricsString).toBe('string');
      expect(metricsString.length).toBeGreaterThan(0);
    });

    it('debe retornar el Content-Type correcto de Prometheus', () => {
      const contentType = service.getPrometheusContentType();
      expect(contentType).toContain('text/plain');
    });
  });
});
