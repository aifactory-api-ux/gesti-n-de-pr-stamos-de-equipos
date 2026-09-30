import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';

/**
 * Módulo de auditoría inmutable institucional.
 * Proporciona persistencia y consulta forense de eventos del sistema,
 * con política de retención estricta de 5 años y sin endpoints de modificación o eliminación.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditoriaEntity])],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService, TypeOrmModule],
})
export class AuditoriaModule {}
