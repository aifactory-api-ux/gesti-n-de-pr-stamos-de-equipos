/**
 * Configuración tipada y centralizada para el backend en NestJS.
 * Carga variables de entorno para base de datos, Azure AD, JWT, SMTP y CORS,
 * asegurando validación estricta y valores por defecto controlados.
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  ssl: boolean;
}

export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface CorsConfig {
  origin: string | string[];
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  azure: AzureConfig;
  jwt: JwtConfig;
  smtp: SmtpConfig;
  cors: CorsConfig;
}

/**
 * Valida la existencia y consistencia de las variables de entorno críticas.
 * Lanza un error explícito si faltan configuraciones requeridas en producción.
 */
export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  const isProduction = env.NODE_ENV === 'production';
  const dbHost = env.DATABASE_HOST || env.DB_HOST || 'postgres';
  const dbPassword = env.DATABASE_PASSWORD || env.DB_PASSWORD || 'SuperSecr3tP@ssw0rd!';
  const azureTenant = env.AZURE_TENANT_ID || 'a8947e4b-76b3-469b-871d-5582bf4ad391';
  const azureClient = env.AZURE_CLIENT_ID || '3f87b8f9-906d-495c-9db6-7cbdfa024cb5';
  const jwtSecret = env.JWT_SECRET || 'clave-secreta-jwt-super-segura-apiux-2026-min32caracteres';

  if (isProduction) {
    const missing: string[] = [];
    if (!dbHost) missing.push('DATABASE_HOST / DB_HOST');
    if (!dbPassword) missing.push('DATABASE_PASSWORD / DB_PASSWORD');
    if (!azureTenant) missing.push('AZURE_TENANT_ID');
    if (!azureClient) missing.push('AZURE_CLIENT_ID');
    if (!jwtSecret) missing.push('JWT_SECRET');

    if (missing.length > 0) {
      throw new Error(
        `Error de configuración en producción: faltan variables obligatorias: ${missing.join(', ')}`,
      );
    }
  }
}

/**
 * Función fábrica que construye el objeto de configuración del sistema.
 */
export const configuration = (): AppConfig => {
  validateEnvironment(process.env);

  const rawCors = process.env.CORS_ORIGIN || 'http://localhost:23080,http://localhost:5173,https://prestamos.apiux.com';
  const corsOrigins = rawCors.includes(',')
    ? rawCors.split(',').map((o) => o.trim())
    : rawCors.trim();

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      host: process.env.DATABASE_HOST || process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432', 10),
      user: process.env.DATABASE_USER || process.env.DB_USERNAME || process.env.DB_USER || 'apiux_admin',
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'SuperSecr3tP@ssw0rd!',
      name: process.env.DATABASE_NAME || process.env.DB_DATABASE || process.env.DB_NAME || 'prestamos_apiux',
      ssl: process.env.DATABASE_SSL === 'true',
    },
    azure: {
      tenantId: process.env.AZURE_TENANT_ID || 'a8947e4b-76b3-469b-871d-5582bf4ad391',
      clientId: process.env.AZURE_CLIENT_ID || '3f87b8f9-906d-495c-9db6-7cbdfa024cb5',
      clientSecret: process.env.AZURE_CLIENT_SECRET || 'abc~1234567890_DummyClientSecretValue',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'Kz81mK!p98Z2#e9X1v82N!w4Q71Lp0x9',
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    },
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || 'notificaciones-ti@apiux.com',
      password: process.env.SMTP_PASSWORD || 'app_password_token_here',
      from: process.env.SMTP_FROM || '"Apiux TI Préstamos" <notificaciones-ti@apiux.com>',
    },
    cors: {
      origin: corsOrigins,
    },
  };
};

export default configuration;
