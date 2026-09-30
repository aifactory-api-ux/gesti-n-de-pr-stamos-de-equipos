import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CronAlertasService } from './cron-alertas.service';
import { NotificacionesService } from './notificaciones.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { RolUsuario } from '../../database/entities/usuario.entity';

describe('CronAlertasService', () => {
  let service: CronAlertasService;
  let prestamoRepositoryMock: any;
  let auditoriaRepositoryMock: any;
  let notificacionesServiceMock: any;
  let auditoriaServiceMock: any;

  const mockUsuario = {
    id: 'usr-colab-1',
    nombre_completo: 'Carlos Perez',
    email: 'carlos.perez@apiux.com',
    rol: RolUsuario.COLABORADOR,
  };

  const mockEquipo = {
    id: 'eq-1',
    codigo_inventario: 'NB-001',
    marca: 'Dell',
    modelo: 'Latitude 5420',
  };

  const fechaVencimiento2Dias = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  const mockPrestamoPorVencer: PrestamoEntity = {
    id: 'prest-vencer-1',
    solicitud_id: 'sol-1',
    solicitud: null as any,
    usuario_id: 'usr-colab-1',
    usuario: mockUsuario as any,
    equipo_id: 'eq-1',
    equipo: mockEquipo as any,
    encargado_entrega_id: 'admin-1',
    encargado_entrega: null as any,
    encargado_devolucion_id: null,
    encargado_devolucion: null,
    fecha_inicio: new Date('2026-03-01T10:00:00Z'),
    fecha_vencimiento: fechaVencimiento2Dias,
    renovado: false,
    fecha_devolucion: null,
    estado: EstadoPrestamo.ACTIVO,
    observaciones: 'Préstamo activo por vencer',
  };

  beforeEach(async () => {
    prestamoRepositoryMock = {
      find: jest.fn().mockResolvedValue([mockPrestamoPorVencer]),
    };

    auditoriaRepositoryMock = {
      count: jest.fn().mockResolvedValue(0), // Ninguna alerta previa en DB
      findOne: jest.fn().mockResolvedValue(null),
    };

    notificacionesServiceMock = {
      enviarAlertaVencimiento: jest.fn().mockResolvedValue({
        enviado: true,
        destinatario: 'carlos.perez@apiux.com',
      }),
    };

    auditoriaServiceMock = {
      registrarEvento: jest.fn().mockResolvedValue({
        id: 'aud-cron-1',
        tabla_afectada: 'prestamos',
        accion: 'NOTIFICACION_VENCIMIENTO',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronAlertasService,
        {
          provide: getRepositoryToken(PrestamoEntity),
          useValue: prestamoRepositoryMock,
        },
        {
          provide: getRepositoryToken(AuditoriaEntity),
          useValue: auditoriaRepositoryMock,
        },
        {
          provide: NotificacionesService,
          useValue: notificacionesServiceMock,
        },
        {
          provide: AuditoriaService,
          useValue: auditoriaServiceMock,
        },
      ],
    }).compile();

    service = module.get<CronAlertasService>(CronAlertasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('ejecutarRevisionVencimientos', () => {
    it('debe encontrar préstamos por vencer en <= 3 días y enviar correos de alerta preventiva', async () => {
      const resumen = await service.ejecutarRevisionVencimientos();

      expect(prestamoRepositoryMock.find).toHaveBeenCalledTimes(1);

      expect(notificacionesServiceMock.enviarAlertaVencimiento).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'carlos.perez@apiux.com',
          nombreColaborador: 'Carlos Perez',
          codigoInventario: 'NB-001',
          equipo: 'Dell Latitude 5420',
          diasRestantes: expect.any(Number),
        }),
      );

      expect(auditoriaServiceMock.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          tabla_afectada: 'prestamos',
          registro_id: 'prest-vencer-1',
          accion: 'NOTIFICACION_VENCIMIENTO',
        }),
      );

      expect(resumen.totalCandidatos).toBe(1);
      expect(resumen.alertasEnviadas).toBe(1);
      expect(resumen.omitidosPorDuplicado).toBe(0);
      expect(resumen.errores).toBe(0);
    });

    it('debe omitir préstamos duplicados si ya fueron alertados el mismo día (caché en memoria)', async () => {
      // Primera ejecución
      await service.ejecutarRevisionVencimientos();
      expect(notificacionesServiceMock.enviarAlertaVencimiento).toHaveBeenCalledTimes(1);

      // Segunda ejecución en el mismo día
      const segundoResumen = await service.ejecutarRevisionVencimientos();
      expect(notificacionesServiceMock.enviarAlertaVencimiento).toHaveBeenCalledTimes(1);
      expect(segundoResumen.omitidosPorDuplicado).toBe(1);
      expect(segundoResumen.alertasEnviadas).toBe(0);
    });

    it('debe omitir préstamos si existe registro previo en la tabla de auditoría (persistencia DB)', async () => {
      // Simular que el repositorio de auditoría ya contiene un registro de conteo > 0 para hoy
      auditoriaRepositoryMock.count.mockResolvedValueOnce(1);

      const resumen = await service.ejecutarRevisionVencimientos();

      expect(notificacionesServiceMock.enviarAlertaVencimiento).not.toHaveBeenCalled();
      expect(resumen.omitidosPorDuplicado).toBe(1);
      expect(resumen.alertasEnviadas).toBe(0);
    });

    it('debe tolerar fallos individuales sin interrumpir el procesamiento del lote', async () => {
      notificacionesServiceMock.enviarAlertaVencimiento.mockRejectedValueOnce(
        new Error('Fallo crítico de conexión SMTP'),
      );

      const resumen = await service.ejecutarRevisionVencimientos();

      expect(resumen.totalCandidatos).toBe(1);
      expect(resumen.alertasEnviadas).toBe(0);
      expect(resumen.errores).toBe(1);
    });

    it('debe tolerar préstamos sin correo de colaborador sin lanzar excepción no controlada', async () => {
      const prestamoSinCorreo = {
        ...mockPrestamoPorVencer,
        id: 'prest-sin-correo',
        usuario: {
          ...mockUsuario,
          email: null as any,
        },
      };
      prestamoRepositoryMock.find.mockResolvedValueOnce([prestamoSinCorreo]);

      const resumen = await service.ejecutarRevisionVencimientos();

      expect(notificacionesServiceMock.enviarAlertaVencimiento).not.toHaveBeenCalled();
      expect(resumen.totalCandidatos).toBe(1);
      expect(resumen.alertasEnviadas).toBe(0);
      expect(resumen.errores).toBe(1);
    });

    it('debe retornar resumen en ceros si no hay préstamos por vencer', async () => {
      prestamoRepositoryMock.find.mockResolvedValueOnce([]);

      const resumen = await service.ejecutarRevisionVencimientos();

      expect(resumen.totalCandidatos).toBe(0);
      expect(resumen.alertasEnviadas).toBe(0);
      expect(resumen.omitidosPorDuplicado).toBe(0);
      expect(resumen.errores).toBe(0);
      expect(notificacionesServiceMock.enviarAlertaVencimiento).not.toHaveBeenCalled();
    });
  });

  describe('manejarCronVencimientos', () => {
    it('debe ser invocado por el cron de NestJS ejecutando la revisión', async () => {
      const spy = jest.spyOn(service, 'ejecutarRevisionVencimientos').mockResolvedValue({
        totalCandidatos: 0,
        alertasEnviadas: 0,
        omitidosPorDuplicado: 0,
        errores: 0,
        detalles: [],
      });

      await service.manejarCronVencimientos();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
