import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';
import { ScheduleModule } from '@nestjs/schedule';
import { PrestamoEntity } from '../../database/entities/prestamo.entity';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NotificacionesService } from './notificaciones.service';
import { CronAlertasService } from './cron-alertas.service';

/**
 * Módulo de notificaciones transaccionales y tareas programadas (Cron).
 * Configura la capa de transporte SMTP mediante MailerModule y orquesta
 * el cron worker diario para alertas preventivas de vencimiento de préstamos.
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([PrestamoEntity, AuditoriaEntity]),
    AuditoriaModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('smtp.host') || 'localhost';
        const port = configService.get<number>('smtp.port') || 587;
        const secure = configService.get<boolean>('smtp.secure') || false;
        const user = configService.get<string>('smtp.user');
        const pass = configService.get<string>('smtp.password');
        const from =
          configService.get<string>('smtp.from') ||
          '"Apiux TI Préstamos" <notificaciones-ti@apiux.com>';

        return {
          transport: {
            host,
            port,
            secure,
            auth: user && pass ? { user, pass } : undefined,
          },
          defaults: {
            from,
          },
        };
      },
    }),
  ],
  providers: [NotificacionesService, CronAlertasService],
  exports: [NotificacionesService, CronAlertasService],
})
export class NotificacionesModule {}
