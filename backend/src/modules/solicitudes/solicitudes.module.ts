import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudPrestamoEntity } from '../../database/entities/solicitud_prestamo.entity';
import { EquipoEntity } from '../../database/entities/equipo.entity';
import { PrestamoEntity } from '../../database/entities/prestamo.entity';
import { UsuarioEntity } from '../../database/entities/usuario.entity';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

/**
 * Módulo de solicitudes de préstamo de equipos tecnológicos.
 * Gestiona el ciclo de vida de peticiones de colaboradores y su resolución por TI.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudPrestamoEntity,
      EquipoEntity,
      PrestamoEntity,
      UsuarioEntity,
    ]),
    NotificacionesModule,
  ],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
