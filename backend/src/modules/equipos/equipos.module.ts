import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { EquipoEntity } from '../../database/entities/equipo.entity';
import { CategoriaEntity } from '../../database/entities/categoria.entity';

/**
 * Módulo de inventario de equipos tecnológicos y catálogo de categorías.
 */
@Module({
  imports: [TypeOrmModule.forFeature([EquipoEntity, CategoriaEntity])],
  controllers: [EquiposController],
  providers: [EquiposService],
  exports: [EquiposService],
})
export class EquiposModule {}
