import { ApiProperty } from '@nestjs/swagger';

/**
 * Detalle del estado de conectividad con la base de datos relacional.
 */
export class DatabaseHealthDto {
  @ApiProperty({
    example: 'up',
    description: 'Estado de conectividad con PostgreSQL',
    enum: ['up', 'down'],
  })
  status: string;

  @ApiProperty({
    example: 'Connection refused',
    description: 'Mensaje de error en caso de fallo de conectividad',
    required: false,
  })
  error?: string;
}

/**
 * Información contextual de monitoreo del sistema e infraestructura.
 */
export class HealthInfoDto {
  @ApiProperty({
    type: DatabaseHealthDto,
    description: 'Estado de salud de los componentes de almacenamiento',
  })
  database: DatabaseHealthDto;

  @ApiProperty({
    example: 84210,
    description: 'Tiempo transcurrido en segundos desde el inicio del proceso Node.js',
  })
  uptime_seconds: number;
}

/**
 * DTO para la respuesta de sonda de liveness / readiness (/health).
 * Compatible con Cloud Run healthchecks, GCP Load Balancer y especificación OpenAPI.
 */
export class HealthCheckResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Estado global de disponibilidad del servicio',
    enum: ['ok', 'error'],
  })
  status: string;

  @ApiProperty({
    example: 'prestamo-equipos-backend',
    description: 'Identificador del microservicio/aplicación',
  })
  service: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'Versión semántica desplegada del servicio',
  })
  version: string;

  @ApiProperty({
    example: '2026-09-30T16:00:00.000Z',
    description: 'Marca de tiempo ISO-8601 de la verificación',
  })
  timestamp: string;

  @ApiProperty({
    type: HealthInfoDto,
    description: 'Información detallada de subsistemas e infraestructura',
  })
  info: HealthInfoDto;
}
