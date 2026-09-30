import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrestamosController } from './prestamos.controller';
import { PrestamosService } from './prestamos.service';
import { PrestamoEntity } from '../../database/entities/prestamo.entity';
import { EquipoEntity } from '../../database/entities/equipo.entity';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

/**
 * Módulo para la gestión de préstamos formalizados de activos TI.
 * Controla el ciclo de vida de los préstamos: consulta con filtros RBAC,
 * devoluciones físicas con inspección técnica y reintegro al catálogo,
 * y prórroga única de vigencia por hasta 30 días adicionales.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrestamoEntity,
      EquipoEntity,
    ]),
    NotificacionesModule,
  ],
  controllers: [PrestamosController],
  providers: [PrestamosService],
  exports: [PrestamosService],
})
export class PrestamosModule {}
