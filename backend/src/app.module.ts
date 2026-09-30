import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import configuration, { AppConfig } from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { EquiposModule } from './modules/equipos/equipos.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { PrestamosModule } from './modules/prestamos/prestamos.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { MetricasModule } from './modules/metricas/metricas.module';

/**
 * Módulo raíz de la aplicación backend de Gestión de Préstamos TI Apiux.
 * Orquesta los módulos de configuración, base de datos relacional PostgreSQL 15,
 * autenticación Azure AD MSAL, inventario, solicitudes, préstamos, auditoría y notificaciones.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get<AppConfig['database']>('database');
        return {
          type: 'postgres',
          host: db?.host || '127.0.0.1',
          port: db?.port || 5432,
          username: db?.user || 'apiux_admin',
          password: db?.password || 'SuperSecr3tP@ssw0rd!',
          database: db?.name || 'apiux_prestamos',
          ssl: db?.ssl ? { rejectUnauthorized: false } : false,
          entities: [__dirname + '/database/entities/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          migrationsRun: true,
          synchronize: false,
          autoLoadEntities: true,
          logging: configService.get<string>('nodeEnv') === 'development',
        };
      },
    }),
    AuthModule,
    EquiposModule,
    SolicitudesModule,
    PrestamosModule,
    AuditoriaModule,
    NotificacionesModule,
    MetricasModule,
  ],
})
export class AppModule {}
