import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsuarioEntity } from './entities/usuario.entity';

/**
 * Módulo de base de datos que encapsula la configuración asíncrona de TypeORM
 * conectándose a PostgreSQL 15 (Cloud SQL) y registrando las entidades del sistema.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isSsl =
          configService.get<boolean>('database.ssl') ??
          (process.env.DATABASE_SSL === 'true');

        return {
          type: 'postgres',
          host:
            configService.get<string>('database.host') ||
            process.env.DATABASE_HOST ||
            '127.0.0.1',
          port:
            configService.get<number>('database.port') ||
            parseInt(process.env.DATABASE_PORT || '5432', 10),
          username:
            configService.get<string>('database.user') ||
            process.env.DATABASE_USER ||
            'apiux_admin',
          password:
            configService.get<string>('database.password') ||
            process.env.DATABASE_PASSWORD ||
            'SuperSecr3tP@ssw0rd!',
          database:
            configService.get<string>('database.name') ||
            process.env.DATABASE_NAME ||
            'apiux_prestamos',
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          entities: [
            UsuarioEntity,
            __dirname + '/entities/*.entity{.ts,.js}',
          ],
          migrations: [
            __dirname + '/migrations/*{.ts,.js}',
          ],
          migrationsRun: true,
          synchronize: false,
          autoLoadEntities: true,
          logging:
            (configService.get<string>('nodeEnv') || process.env.NODE_ENV) ===
            'development',
        };
      },
    }),
    TypeOrmModule.forFeature([UsuarioEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
