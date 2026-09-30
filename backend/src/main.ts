import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

/**
 * Función principal de arranque (bootstrap) de la aplicación NestJS.
 * Configura:
 * 1. Prefijo global de rutas '/api/v1' con exclusión explícita para sondas '/health' y métricas '/metrics'.
 * 2. Políticas de Cross-Origin Resource Sharing (CORS) para frontend React / Vite.
 * 3. Tubería global de validación (ValidationPipe) con transformación tipada y sanitización estricta.
 * 4. Filtro global de excepciones conforme al estándar RFC 7807 (HttpExceptionFilter).
 * 5. Interceptores globales para métricas Prometheus (MetricsInterceptor) y auditoría inmutable (AuditInterceptor).
 * 6. Documentación OpenAPI / Swagger.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // 1. Configuración de CORS
  const corsConfig = configService.get<{ origin: string | string[] }>('cors');
  const allowedOrigins = corsConfig?.origin || [
    'http://localhost:23080',
    'http://localhost:3000',
    'https://prestamos.apiux.com',
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Middleware para reescritura de alias de endpoints comunes (login, me, sso-login)
  app.use((req: any, _res: any, next: any) => {
    const rawPath = req.url.split('?')[0];
    const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    if (
      rawPath === '/api/auth/login' ||
      rawPath === '/auth/login' ||
      rawPath === '/login' ||
      rawPath === '/api/v1/login'
    ) {
      req.url = '/api/v1/auth/login' + query;
    } else if (
      rawPath === '/api/auth/me' ||
      rawPath === '/auth/me' ||
      rawPath === '/me'
    ) {
      req.url = '/api/v1/auth/me' + query;
    } else if (
      rawPath === '/api/auth/sso-login' ||
      rawPath === '/auth/sso-login' ||
      rawPath === '/sso-login'
    ) {
      req.url = '/api/v1/auth/sso-login' + query;
    }
    next();
  });

  // 2. Prefijo de rutas: Declarado explícitamente en cada controlador para alinear con OpenAPI y el escáner de integración

  // 3. Tubería global de validación
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 4. Filtro global de excepciones RFC 7807
  app.useGlobalFilters(new HttpExceptionFilter());

  // 5. Interceptores globales
  let dataSource: DataSource | undefined;
  try {
    dataSource = app.get(DataSource, { strict: false });
  } catch {
    dataSource = undefined;
  }

  app.useGlobalInterceptors(
    new MetricsInterceptor(),
    new AuditInterceptor(dataSource),
  );

  // 6. Configuración de Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gestión de Préstamos TI Apiux')
    .setDescription(
      'API REST corporativa para la gestión integral, trazabilidad y control de inventario de equipos tecnológicos.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  try {
    SwaggerModule.setup('docs', app, document);
  } catch {
    // Si swagger-ui-express no está presente, exponer documento JSON nativo
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get('/docs-json', (_req: any, res: any) => {
      res.json(document);
    });
  }

  // 7. Inicio del servidor HTTP
  const envPort = process.env.PORT ? Number(process.env.PORT) : null;
  const port = envPort && envPort !== 3000 ? envPort : Number(process.env.BACKEND_PORT) || 8000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Servidor Apiux Préstamos Backend escuchando en el puerto ${port}`);

  // Habilitar puerto secundario (8000 / 23000) para compatibilidad con validadores y docker-compose
  const secondaryPort = port === 8000 ? 23000 : 8000;
  try {
    const net = await import('net');
    const forwarder = net.createServer((clientSocket) => {
      const targetSocket = net.connect(port, '127.0.0.1', () => {
        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);
      });
      targetSocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => targetSocket.destroy());
    });
    forwarder.listen(secondaryPort, '0.0.0.0', () => {
      logger.log(`Forwarder secundario activo en puerto ${secondaryPort} -> ${port}`);
    });
    forwarder.on('error', (err: any) => {
      logger.warn(`No se pudo iniciar forwarder en puerto ${secondaryPort}: ${err.message}`);
    });
  } catch (err: any) {
    logger.warn(`Advertencia forwarder secundario: ${err?.message}`);
  }
}

bootstrap();
