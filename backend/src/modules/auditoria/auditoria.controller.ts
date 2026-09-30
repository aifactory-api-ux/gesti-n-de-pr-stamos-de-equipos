import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditoriaService, PaginatedAuditoriaResponse } from './auditoria.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';
import { AuditoriaEntity } from '../../database/entities/auditoria.entity';
import { RolUsuario } from '../../database/entities/usuario.entity';
import { AzureAuthGuard } from '../../common/guards/azure-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Controlador REST para la consulta de la bitácora inmutable de auditoría del sistema Apiux.
 *
 * Restricciones de seguridad y normativas:
 * - Acceso exclusivo para usuarios con rol 'administrador_ti' (403 Forbidden para colaboradores u otros roles).
 * - Autenticación requerida mediante Bearer Token JWT validado contra Azure AD MSAL (401 Unauthorized).
 * - INMUTABILIDAD ESTRICTA: No expone endpoints de creación directa (POST), modificación (PUT/PATCH)
 *   ni eliminación (DELETE) para cumplir con el estándar de retención legal y forense de 5 años.
 */
@ApiTags('Auditoría')
@ApiBearerAuth()
@UseGuards(AzureAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRADOR_TI)
@Controller('api/v1/auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  /**
   * Obtiene la bitácora de auditoría con filtrado multidimensional y paginación.
   * Exclusivo para administradores de TI.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar bitácora inmutable de auditoría',
    description:
      'Retorna el historial paginado de mutaciones y eventos del sistema (solicitudes, préstamos, equipos, categorías). ' +
      'Permite filtrar por tabla/entidad, ID de registro, usuario actor, acción y rango de fechas. ' +
      'Acceso estrictamente restringido al rol administrador_ti.',
  })
  @ApiQuery({
    name: 'tabla_afectada',
    required: false,
    description: 'Filtrar por tabla de BD (ej. prestamos, solicitudes_prestamo, equipos, categorias)',
  })
  @ApiQuery({
    name: 'entidad',
    required: false,
    description: 'Alias alternativo para tabla_afectada',
  })
  @ApiQuery({
    name: 'registro_id',
    required: false,
    description: 'Filtrar por UUID del registro específico',
  })
  @ApiQuery({
    name: 'usuario_id',
    required: false,
    description: 'Filtrar por UUID del usuario autor de la acción',
  })
  @ApiQuery({
    name: 'accion',
    required: false,
    description: 'Filtrar por acción ejecutada (ej. APROBAR_PRESTAMO, CREAR_SOLICITUD)',
  })
  @ApiQuery({
    name: 'fecha_desde',
    required: false,
    description: 'Fecha mínima de eventos (formato ISO 8601)',
  })
  @ApiQuery({
    name: 'fecha_hasta',
    required: false,
    description: 'Fecha máxima de eventos (formato ISO 8601)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página (por defecto 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Registros por página (por defecto 10, máximo 100)',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de eventos de auditoría obtenido correctamente.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: Token JWT no provisto o inválido.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Prohibido: Se requiere rol administrador_ti para acceder a la auditoría.',
  })
  async findAll(@Query() query: QueryAuditoriaDto): Promise<PaginatedAuditoriaResponse> {
    return this.auditoriaService.findAll(query);
  }

  /**
   * Consulta los detalles de un registro de auditoría específico por su ID UUID.
   * Exclusivo para administradores de TI (solo lectura).
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar detalle de un registro de auditoría',
    description:
      'Retorna el snapshot completo de un evento de auditoría específico por UUID, incluyendo datos anteriores y posteriores.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del registro de auditoría',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Registro de auditoría encontrado exitosamente.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Registro de auditoría no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Prohibido: Se requiere rol administrador_ti.',
  })
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AuditoriaEntity> {
    return this.auditoriaService.findById(id);
  }
}
