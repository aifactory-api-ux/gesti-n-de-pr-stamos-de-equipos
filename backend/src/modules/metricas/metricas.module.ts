import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';
import { EquipoEntity } from '../../database/entities/equipo.entity';
import { PrestamoEntity } from '../../database/entities/prestamo.entity';
import { SolicitudPrestamoEntity } from '../../database/entities/solicitud_prestamo.entity';

/**
 * Módulo de Métricas y Observabilidad.
 * Gestiona los contadores del panel de administración TI, sondas de salud y métricas Prometheus.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EquipoEntity,
      PrestamoEntity,
      SolicitudPrestamoEntity,
    ]),
  ],
  controllers: [MetricasController],
  providers: [MetricasService],
  exports: [MetricasService],
})
export class MetricasModule {}
