import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO que encapsula el resumen consolidado de métricas operacionales del inventario,
 * préstamos y solicitudes de equipos tecnológicos para el panel de administración TI.
 * Cumple con el esquema OpenAPI 'MetricasResumen' y los requerimientos del dashboard.
 */
export class MetricasResumenDto {
  @ApiProperty({
    example: 150,
    description: 'Total de activos tecnológicos registrados en el inventario institucional',
  })
  total_equipos: number;

  @ApiProperty({
    example: 98,
    description: 'Cantidad de equipos disponibles para asignación inmediata',
  })
  equipos_disponibles: number;

  @ApiProperty({
    example: 42,
    description: 'Cantidad de equipos actualmente prestados a colaboradores',
  })
  equipos_prestados: number;

  @ApiProperty({
    example: 10,
    description: 'Cantidad de equipos en servicio técnico o mantenimiento preventivo',
  })
  equipos_en_mantencion: number;

  @ApiProperty({
    example: 42,
    description: 'Total de préstamos formalizados con vigencia activa en el sistema',
  })
  prestamos_activos: number;

  @ApiProperty({
    example: 3,
    description: 'Total de préstamos cuyo plazo de devolución se encuentra vencido',
  })
  prestamos_vencidos: number;

  @ApiProperty({
    example: 5,
    description: 'Solicitudes de préstamo pendientes de revisión y aprobación por TI',
  })
  solicitudes_pendientes: number;

  @ApiProperty({
    example: 150,
    description: 'Total general de activos (alias para compatibilidad con panel administrativo)',
  })
  total_activos: number;

  @ApiProperty({
    example: 3,
    description: 'Préstamos activos cuya fecha de vencimiento expira dentro de los próximos 3 días',
  })
  por_vencer: number;
}
