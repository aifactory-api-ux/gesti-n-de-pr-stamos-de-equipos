import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { UsuarioEntity } from './entities/usuario.entity';

dotenv.config();

/**
 * Opciones de configuración para TypeORM DataSource.
 * Utilizado por TypeORM CLI para ejecución de migraciones relacionales en PostgreSQL 15.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432', 10),
  username: process.env.DATABASE_USER || process.env.DB_USERNAME || process.env.DB_USER || 'apiux_admin',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'SuperSecr3tP@ssw0rd!',
  database: process.env.DATABASE_NAME || process.env.DB_DATABASE || process.env.DB_NAME || 'apiux_prestamos',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [
    UsuarioEntity,
    __dirname + '/entities/*.entity{.ts,.js}',
  ],
  migrations: [
    __dirname + '/migrations/*{.ts,.js}',
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
