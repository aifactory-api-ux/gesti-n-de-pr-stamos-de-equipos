import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Estructura de respuesta de error conforme al estándar RFC 7807 (Problem Details for HTTP APIs).
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp: string;
  errors?: string[] | Record<string, any>;
}

/**
 * Filtro global de excepciones que formatea todas las respuestas de error bajo el estándar RFC 7807.
 * Oculta de manera estricta las trazas internas del servidor (stack traces, consultas SQL, detalles internos)
 * para evitar fugas de información sensible y registrar los incidentes de forma centralizada.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'Ocurrió un error interno en el servidor. Por favor, intente nuevamente o contacte a TI.';
    let validationErrors: string[] | Record<string, any> | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      title = this.obtenerTituloHttp(status, exception.name);

      if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, any>;

        if (Array.isArray(responseObj.message)) {
          validationErrors = responseObj.message;
          detail = responseObj.message.join('; ');
        } else if (typeof responseObj.message === 'string') {
          detail = responseObj.message;
        } else if (typeof responseObj.error === 'string') {
          detail = responseObj.error;
        } else {
          detail = exception.message;
        }
      } else {
        detail = exception.message;
      }
    } else if (exception instanceof Error) {
      // Registro seguro del error no controlado en los logs del servidor
      this.logger.error(
        `Error inesperado en [${request.method}] ${request.url}: ${exception.message}`,
        exception.stack,
      );
      title = 'Internal Server Error';
      detail = 'Ocurrió un error inesperado al procesar la solicitud.';
    } else {
      this.logger.error(
        `Error no identificado en [${request.method}] ${request.url}`,
        JSON.stringify(exception),
      );
    }

    const problemDetails: ProblemDetails = {
      type: `https://httpstatuses.com/${status}`,
      title,
      status,
      detail,
      instance: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    };

    if (validationErrors) {
      problemDetails.errors = validationErrors;
    }

    response
      .status(status)
      .setHeader('Content-Type', 'application/problem+json')
      .json(problemDetails);
  }

  /**
   * Genera un título descriptivo estándar basado en el código de estado HTTP.
   */
  private obtenerTituloHttp(status: number, defaultName: string): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Solicitud Inválida';
      case HttpStatus.UNAUTHORIZED:
        return 'No Autorizado';
      case HttpStatus.FORBIDDEN:
        return 'Acceso Prohibido';
      case HttpStatus.NOT_FOUND:
        return 'Recurso No Encontrado';
      case HttpStatus.CONFLICT:
        return 'Conflicto de Estado';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Entidad No Procesable';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Error Interno del Servidor';
      default:
        return defaultName.replace(/Exception$/, '');
    }
  }
}
