import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let mailerServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    mailerServiceMock = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-test-123' }),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'smtp.host': 'smtp.test.com',
          'smtp.port': 587,
          'smtp.secure': false,
          'smtp.user': 'test@apiux.com',
          'smtp.password': 'secret',
          'smtp.from': '"Apiux Equipos" <soporte-ti@apiux.com>',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        {
          provide: MailerService,
          useValue: mailerServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<NotificacionesService>(NotificacionesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('enviarConfirmacionAprobacion', () => {
    it('debe enviar correo de confirmación de aprobación exitosamente', async () => {
      const fechaVencimiento = new Date('2026-04-15T18:00:00Z');
      const resultado = await service.enviarConfirmacionAprobacion({
        email: 'colaborador@apiux.com',
        nombreColaborador: 'Carlos Pérez',
        codigoInventario: 'NB-001',
        equipo: 'Dell Latitude 5420',
        fechaVencimiento,
        observaciones: 'Entregado con cargador y mouse',
      });

      expect(resultado.enviado).toBe(true);
      expect(resultado.destinatario).toBe('colaborador@apiux.com');
      expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe('colaborador@apiux.com');
      expect(mailOptions.subject).toContain('Solicitud de Préstamo Aprobada');
      expect(mailOptions.html).toContain('Carlos Pérez');
      expect(mailOptions.html).toContain('NB-001');
      expect(mailOptions.html).toContain('Dell Latitude 5420');
      expect(mailOptions.html).toContain('Entregado con cargador y mouse');
    });

    it('debe admitir parámetros sin observaciones ni código de inventario', async () => {
      const resultado = await service.enviarConfirmacionAprobacion({
        email: 'colaborador@apiux.com',
        nombreColaborador: 'Carlos Pérez',
        equipo: 'Dell Latitude 5420',
        fechaVencimiento: new Date('2026-04-15T18:00:00Z'),
      });

      expect(resultado.enviado).toBe(true);
      expect(mailerServiceMock.sendMail).toHaveBeenCalled();
    });
  });

  describe('enviarConfirmacionDevolucion', () => {
    it('debe enviar correo de confirmación de devolución exitosamente', async () => {
      const fechaDevolucion = new Date('2026-03-30T15:30:00Z');
      const resultado = await service.enviarConfirmacionDevolucion({
        email: 'colaborador@apiux.com',
        nombreColaborador: 'Ana Gómez',
        codigoInventario: 'NB-002',
        equipo: 'MacBook Pro M2',
        fechaDevolucion,
        estadoFisico: 'Bueno',
        observaciones: 'Equipo devuelto en perfectas condiciones',
      });

      expect(resultado.enviado).toBe(true);
      expect(resultado.destinatario).toBe('colaborador@apiux.com');
      expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe('colaborador@apiux.com');
      expect(mailOptions.subject).toContain('Devolución Registrada con Éxito');
      expect(mailOptions.html).toContain('Ana Gómez');
      expect(mailOptions.html).toContain('NB-002');
      expect(mailOptions.html).toContain('MacBook Pro M2');
      expect(mailOptions.html).toContain('Equipo devuelto en perfectas condiciones');
    });
  });

  describe('enviarAlertaVencimiento', () => {
    it('debe enviar correo de alerta preventiva de 3 días', async () => {
      const fechaVencimiento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const resultado = await service.enviarAlertaVencimiento({
        email: 'colaborador@apiux.com',
        nombreColaborador: 'Mario Ruiz',
        codigoInventario: 'NB-003',
        equipo: 'Lenovo ThinkPad',
        fechaVencimiento,
        diasRestantes: 3,
      });

      expect(resultado.enviado).toBe(true);
      expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain('vence en 3 días');
      expect(mailOptions.html).toContain('Mario Ruiz');
      expect(mailOptions.html).toContain('NB-003');
    });

    it('debe personalizar el asunto y contenido para vencimiento hoy (0 días)', async () => {
      const fechaVencimiento = new Date();
      const resultado = await service.enviarAlertaVencimiento({
        email: 'colaborador@apiux.com',
        nombreColaborador: 'Mario Ruiz',
        codigoInventario: 'NB-003',
        equipo: 'Lenovo ThinkPad',
        fechaVencimiento,
        diasRestantes: 0,
      });

      expect(resultado.enviado).toBe(true);
      const mailOptions = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain('¡VENCE HOY!');
      expect(mailOptions.html).toContain('¡VENCE HOY!');
    });

    it('debe personalizar el contenido para vencimiento mañana (1 día)', async () => {
      const fechaVencimiento = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const resultado = await service.enviarAlertaVencimiento({
        email: 'colaborador@apiux.com',
        nombreColaborador: 'Mario Ruiz',
        codigoInventario: 'NB-003',
        equipo: 'Lenovo ThinkPad',
        fechaVencimiento,
        diasRestantes: 1,
      });

      expect(resultado.enviado).toBe(true);
      const mailOptions = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('vence MAÑANA');
    });
  });

  describe('Tolerancia a fallos y resiliencia', () => {
    it('no debe arrojar excepciones cuando el servicio de correo falla', async () => {
      mailerServiceMock.sendMail.mockRejectedValueOnce(
        new Error('SMTP Connection Timeout: 504 Gateway Error'),
      );

      const resultado = await service.enviarConfirmacionAprobacion({
        email: 'fallo@apiux.com',
        nombreColaborador: 'Usuario Prueba',
        codigoInventario: 'NB-999',
        equipo: 'Laptop',
        fechaVencimiento: new Date(),
      });

      expect(resultado.enviado).toBe(false);
      expect(resultado.error).toBe('SMTP Connection Timeout: 504 Gateway Error');
    });

    it('debe rechazar silenciosamente envíos sin correo de destinatario', async () => {
      const resultado = await service.enviarCorreo({
        destinatario: '',
        asunto: 'Sin destinatario',
        html: '<p>Test</p>',
      });

      expect(resultado.enviado).toBe(false);
      expect(resultado.error).toBe('Correo de destinatario no provisto');
      expect(mailerServiceMock.sendMail).not.toHaveBeenCalled();
    });
  });
});
