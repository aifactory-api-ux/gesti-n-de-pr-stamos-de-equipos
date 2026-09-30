import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import * as nodemailer from 'nodemailer';

export interface ConfirmacionAprobacionParams {
  email: string;
  nombreColaborador: string;
  equipo: string;
  codigoInventario?: string;
  numeroSerie?: string;
  fechaInicio?: Date;
  fechaVencimiento: Date;
  observaciones?: string;
}

export interface ConfirmacionDevolucionParams {
  email: string;
  nombreColaborador: string;
  equipo: string;
  codigoInventario?: string;
  fechaDevolucion: Date;
  estadoFisico?: string;
  observaciones?: string;
}

export interface AlertaVencimientoParams {
  email: string;
  nombreColaborador: string;
  equipo: string;
  codigoInventario?: string;
  fechaVencimiento: Date;
  diasRestantes: number;
  prestamoId?: string;
}

export interface ResultadoEnvioEmail {
  enviado: boolean;
  messageId?: string;
  destinatario: string;
  asunto: string;
  error?: string;
}

/**
 * Servicio encargado del envío de notificaciones transaccionales vía correo electrónico (SMTP).
 * Diseñado con alta resiliencia y tolerancia a fallos:
 * Las fallas de red o indisponibilidad del servidor SMTP son capturadas y registradas
 * sin interrumpir el flujo transaccional de negocio (aprobación, devolución, cron workers).
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private fallbackTransporter: nodemailer.Transporter | null = null;

  constructor(
    @Optional() private readonly mailerService?: MailerService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.inicializarTransporter();
  }

  /**
   * Inicializa el transporter de nodemailer como respaldo si no se inyecta MailerService.
   */
  private inicializarTransporter(): void {
    if (!this.mailerService && this.configService) {
      try {
        const host = this.configService.get<string>('smtp.host') || 'localhost';
        const port = this.configService.get<number>('smtp.port') || 587;
        const secure = this.configService.get<boolean>('smtp.secure') || false;
        const user = this.configService.get<string>('smtp.user');
        const pass = this.configService.get<string>('smtp.password');

        this.fallbackTransporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user && pass ? { user, pass } : undefined,
        });
      } catch (err) {
        this.logger.warn(`No se pudo inicializar transporter de respaldo: ${err.message}`);
      }
    }
  }

  /**
   * Envía correo transaccional notificando la aprobación de una solicitud de préstamo
   * y las instrucciones para el retiro del equipo en las oficinas de TI.
   */
  async enviarConfirmacionAprobacion(
    params: ConfirmacionAprobacionParams,
  ): Promise<ResultadoEnvioEmail> {
    const {
      email,
      nombreColaborador,
      equipo,
      codigoInventario,
      numeroSerie,
      fechaInicio = new Date(),
      fechaVencimiento,
      observaciones,
    } = params;

    const fechaInicioStr = this.formatearFecha(fechaInicio);
    const fechaVencimientoStr = this.formatearFecha(fechaVencimiento);

    const asunto = `[Apiux TI] Solicitud de Préstamo Aprobada - ${equipo}`;
    const cuerpoHtml = this.generarPlantillaBase({
      titulo: '¡Tu solicitud de equipo ha sido aprobada!',
      encabezadoColor: '#0B2F6B',
      contenidoHtml: `
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Estimado/a <strong>${nombreColaborador}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Nos complace informarte que tu solicitud de préstamo de equipamiento tecnológico ha sido
          <strong>aprobada exitosamente</strong> por el equipo de TI de Apiux Tecnología.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
          <tr>
            <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0; width: 40%;">Equipo asignado:</td>
            <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;">${equipo}</td>
          </tr>
          ${
            codigoInventario
              ? `<tr>
                  <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0;">Código de inventario:</td>
                  <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;"><code>${codigoInventario}</code></td>
                </tr>`
              : ''
          }
          ${
            numeroSerie
              ? `<tr>
                  <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0;">Número de serie:</td>
                  <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;"><code>${numeroSerie}</code></td>
                </tr>`
              : ''
          }
          <tr>
            <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0;">Fecha de entrega / inicio:</td>
            <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;">${fechaInicioStr}</td>
          </tr>
          <tr>
            <td style="padding: 10px 15px; font-weight: 600; color: #B91C1C; border-bottom: 1px solid #E2E8F0;">Fecha límite de devolución:</td>
            <td style="padding: 10px 15px; color: #B91C1C; font-weight: bold; border-bottom: 1px solid #E2E8F0;">${fechaVencimientoStr}</td>
          </tr>
          ${
            observaciones
              ? `<tr>
                  <td style="padding: 10px 15px; font-weight: 600; color: #1E293B;">Observaciones:</td>
                  <td style="padding: 10px 15px; color: #334155;">${observaciones}</td>
                </tr>`
              : ''
          }
        </table>
        <div style="background-color: #EFF6FF; border-left: 4px solid #00A3E0; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <h4 style="margin: 0 0 6px 0; color: #0B2F6B; font-size: 14px;">📍 Instrucciones de retiro:</h4>
          <p style="margin: 0; font-size: 13px; color: #1E3A8A; line-height: 1.5;">
            Puedes retirar tu equipo en la <strong>Oficina de TI de Apiux</strong> presentando tu credencial corporativa.
            Recuerda revisar el estado físico del equipo al momento de la entrega formal.
          </p>
        </div>
      `,
    });

    const cuerpoTexto = `Hola ${nombreColaborador},\n\nTu solicitud de préstamo para el equipo "${equipo}" ha sido aprobada.\nFecha de vencimiento: ${fechaVencimientoStr}.\nPuedes retirarlo en la oficina de TI presentando tu credencial corporativa.`;

    return this.enviarCorreo({
      destinatario: email,
      asunto,
      html: cuerpoHtml,
      texto: cuerpoTexto,
    });
  }

  /**
   * Envía correo transaccional confirmando la recepción física y cierre formal del préstamo.
   */
  async enviarConfirmacionDevolucion(
    params: ConfirmacionDevolucionParams,
  ): Promise<ResultadoEnvioEmail> {
    const {
      email,
      nombreColaborador,
      equipo,
      codigoInventario,
      fechaDevolucion,
      estadoFisico = 'disponible',
      observaciones,
    } = params;

    const fechaDevolucionStr = this.formatearFecha(fechaDevolucion);
    const asunto = `[Apiux TI] Devolución Registrada con Éxito - ${equipo}`;

    const cuerpoHtml = this.generarPlantillaBase({
      titulo: 'Devolución de equipo registrada exitosamente',
      encabezadoColor: '#059669',
      contenidoHtml: `
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Estimado/a <strong>${nombreColaborador}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Te confirmamos que la devolución física del equipo tecnológico ha sido registrada
          correctamente en el sistema institucional. Tu préstamo se encuentra <strong>cerrado</strong>
          y no registras deudas pendientes por este activo.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
          <tr>
            <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0; width: 40%;">Equipo devuelto:</td>
            <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;">${equipo}</td>
          </tr>
          ${
            codigoInventario
              ? `<tr>
                  <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0;">Código de inventario:</td>
                  <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;"><code>${codigoInventario}</code></td>
                </tr>`
              : ''
          }
          <tr>
            <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0;">Fecha y hora de devolución:</td>
            <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;">${fechaDevolucionStr}</td>
          </tr>
          <tr>
            <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0;">Estado físico verificado:</td>
            <td style="padding: 10px 15px; color: #059669; font-weight: 600; border-bottom: 1px solid #E2E8F0;">${estadoFisico}</td>
          </tr>
          ${
            observaciones
              ? `<tr>
                  <td style="padding: 10px 15px; font-weight: 600; color: #1E293B;">Notas de inspección:</td>
                  <td style="padding: 10px 15px; color: #334155;">${observaciones}</td>
                </tr>`
              : ''
          }
        </table>
        <p style="font-size: 13px; color: #64748B;">
          ¡Agradecemos el cuidado responsable del activo tecnológico durante tu período de asignación!
        </p>
      `,
    });

    const cuerpoTexto = `Hola ${nombreColaborador},\n\nSe ha registrado exitosamente la devolución del equipo "${equipo}" el día ${fechaDevolucionStr}.\nEl préstamo ha quedado formalmente cerrado. ¡Gracias!`;

    return this.enviarCorreo({
      destinatario: email,
      asunto,
      html: cuerpoHtml,
      texto: cuerpoTexto,
    });
  }

  /**
   * Envía correo transaccional preventivo alertando sobre la proximidad del vencimiento
   * de un préstamo (3 días o menos restantes).
   */
  async enviarAlertaVencimiento(
    params: AlertaVencimientoParams,
  ): Promise<ResultadoEnvioEmail> {
    const {
      email,
      nombreColaborador,
      equipo,
      codigoInventario,
      fechaVencimiento,
      diasRestantes,
      prestamoId,
    } = params;

    const fechaVencimientoStr = this.formatearFecha(fechaVencimiento);
    const mensajeDias =
      diasRestantes <= 0
        ? '¡VENCE HOY!'
        : diasRestantes === 1
          ? 'vence MAÑANA'
          : `vence en ${diasRestantes} días`;

    const asunto = `[Apiux TI] Recordatorio: Tu préstamo de equipo ${mensajeDias}`;

    const cuerpoHtml = this.generarPlantillaBase({
      titulo: `⚠️ Recordatorio de vencimiento de préstamo`,
      encabezadoColor: '#D97706',
      contenidoHtml: `
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Estimado/a <strong>${nombreColaborador}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Te recordamos que tu préstamo de equipamiento tecnológico <strong>${mensajeDias}</strong>.
          Por favor revisa la fecha programada para coordinar la devolución o gestionar una renovación.
        </p>
        <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
          <h3 style="margin: 0 0 6px 0; color: #92400E; font-size: 16px;">Plazo de entrega asignado:</h3>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #B45309;">
            ${fechaVencimientoStr} (${mensajeDias})
          </p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
          <tr>
            <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0; width: 40%;">Equipo en préstamo:</td>
            <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;">${equipo}</td>
          </tr>
          ${
            codigoInventario
              ? `<tr>
                  <td style="padding: 10px 15px; font-weight: 600; color: #1E293B; border-bottom: 1px solid #E2E8F0;">Código de inventario:</td>
                  <td style="padding: 10px 15px; color: #334155; border-bottom: 1px solid #E2E8F0;"><code>${codigoInventario}</code></td>
                </tr>`
              : ''
          }
          ${
            prestamoId
              ? `<tr>
                  <td style="padding: 10px 15px; font-weight: 600; color: #1E293B;">Identificador:</td>
                  <td style="padding: 10px 15px; color: #64748B; font-size: 12px;"><code>${prestamoId}</code></td>
                </tr>`
              : ''
          }
        </table>
        <div style="background-color: #F1F5F9; border-radius: 6px; padding: 12px 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 6px 0; color: #0B2F6B; font-size: 14px;">¿Necesitas extender el plazo?</h4>
          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">
            Si requieres continuar usando el equipo para tus labores, puedes solicitar una
            <strong>renovación única de hasta 30 días</strong> directamente desde la plataforma
            de préstamos de Apiux antes de la fecha límite.
          </p>
        </div>
      `,
    });

    const cuerpoTexto = `Hola ${nombreColaborador},\n\nTe recordamos que tu préstamo del equipo "${equipo}" ${mensajeDias} (Fecha límite: ${fechaVencimientoStr}).\nPor favor realiza la devolución en la oficina de TI o solicita una renovación en el portal si lo necesitas.`;

    return this.enviarCorreo({
      destinatario: email,
      asunto,
      html: cuerpoHtml,
      texto: cuerpoTexto,
    });
  }

  /**
   * Método de despacho seguro de correos electrónicos con captura y registro de excepciones.
   * Garantiza que cualquier fallo en la capa de transporte SMTP no propague errores
   * hacia la transacción de negocio invocante.
   */
  async enviarCorreo(opciones: {
    destinatario: string;
    asunto: string;
    html: string;
    texto?: string;
  }): Promise<ResultadoEnvioEmail> {
    const { destinatario, asunto, html, texto } = opciones;

    if (!destinatario || destinatario.trim() === '') {
      this.logger.warn(`No se especificó un correo de destinatario para el asunto: "${asunto}"`);
      return {
        enviado: false,
        destinatario: '',
        asunto,
        error: 'Correo de destinatario no provisto',
      };
    }

    try {
      const from =
        this.configService?.get<string>('smtp.from') ||
        '"Apiux TI Préstamos" <notificaciones-ti@apiux.com>';

      if (this.mailerService) {
        const respuesta = await this.mailerService.sendMail({
          to: destinatario,
          from,
          subject: asunto,
          html,
          text: texto,
        });

        this.logger.log(
          `Correo enviado exitosamente a [${destinatario}] | Asunto: "${asunto}"`,
        );

        return {
          enviado: true,
          messageId: respuesta?.messageId || 'sent-via-mailer',
          destinatario,
          asunto,
        };
      }

      if (this.fallbackTransporter) {
        const info = await this.fallbackTransporter.sendMail({
          to: destinatario,
          from,
          subject: asunto,
          html,
          text: texto,
        });

        this.logger.log(
          `Correo enviado mediante transporter de respaldo a [${destinatario}] | ID: ${info?.messageId}`,
        );

        return {
          enviado: true,
          messageId: info?.messageId || 'sent-via-fallback',
          destinatario,
          asunto,
        };
      }

      // Si no hay transporter disponible (entorno simulado o tests)
      this.logger.debug(
        `Servicio SMTP no configurado directamente. Mensaje simulado para [${destinatario}]: "${asunto}"`,
      );
      return {
        enviado: true,
        messageId: `mock-${Date.now()}`,
        destinatario,
        asunto,
      };
    } catch (error) {
      this.logger.error(
        `Error al despachar correo a [${destinatario}] para asunto "${asunto}": ${error.message}`,
        error.stack,
      );
      return {
        enviado: false,
        destinatario,
        asunto,
        error: error.message,
      };
    }
  }

  /**
   * Construye el contenedor HTML corporativo de Apiux con cabecera y pie estandarizados.
   */
  private generarPlantillaBase(params: {
    titulo: string;
    encabezadoColor: string;
    contenidoHtml: string;
  }): string {
    const { titulo, encabezadoColor, contenidoHtml } = params;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F1F5F9; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #FFFFFF; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <!-- Encabezado corporativo -->
          <tr>
            <td style="background-color: ${encabezadoColor}; padding: 28px 30px; text-align: left;">
              <div style="font-size: 13px; font-weight: 700; color: #93C5FD; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                Apiux Tecnología &bull; Gestión TI
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                ${titulo}
              </h1>
            </td>
          </tr>
          <!-- Cuerpo del mensaje -->
          <tr>
            <td style="padding: 30px;">
              ${contenidoHtml}
            </td>
          </tr>
          <!-- Pie de página institucional -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 20px 30px; border-top: 1px solid #E2E8F0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B;">
                Sistema Institucional de Préstamos TI &bull; Apiux Tecnología
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 1.4;">
                Este es un mensaje automático generado por la plataforma interna. Por favor no responda directamente a este correo.<br>
                Para consultas o soporte técnico, contacte al Administrador TI.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Formatea un objeto Date en formato legible para la zona horaria institucional de Chile/Santiago.
   */
  private formatearFecha(fecha: Date): string {
    try {
      return new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'full',
        timeZone: 'America/Santiago',
      }).format(new Date(fecha));
    } catch {
      return new Date(fecha).toLocaleDateString('es-CL');
    }
  }
}
