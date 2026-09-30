import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrestamosService, PaginatedPrestamosResponse } from './prestamos.service';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { RenovarPrestamoDto } from './dto/renovar-prestamo.dto';
import { PrestamoEntity } from '../../database/entities/prestamo.entity';
import { UsuarioEntity, RolUsuario } from '../../database/entities/usuario.entity';
import { AzureAuthGuard } from '../../common/guards/azure-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Controlador para la gestión del ciclo de vida de préstamos de activos TI.
 * Endpoints provistos:
 * - GET  /api/v1/prestamos: Listado paginado de préstamos (filtrado personal para colaboradores y global para TI)
 * - POST /api/v1/prestamos/:id/devolucion: Registro de devolución física e inspección de estado (exclusivo Administrador TI)
 * - POST /api/v1/prestamos/:id/renovar: Solicitud de renovación o extensión de plazo (máximo 1 vez, hasta 30 días)
 */
@ApiTags('Préstamos')
@ApiBearerAuth()
@UseGuards(AzureAuthGuard, RolesGuard)
@Controller('api/v1/prestamos')
export class PrestamosController {
  constructor(private readonly prestamosService: PrestamosService) {}

  /**
   * Obtiene la lista de préstamos con filtros y paginación.
   * Reglas de acceso:
   * - Los colaboradores solo tienen visibilidad sobre sus propios préstamos asignados.
   * - Los administradores de TI tienen visibilidad sobre todos los préstamos institucionales
   *   y pueden filtrar por colaborador específico mediante query param `usuario_id`.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar préstamos de equipos',
    description:
      'Retorna préstamos paginados con filtros opcionales. Colaboradores solo visualizan sus propios préstamos; administradores de TI visualizan el inventario global.',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    description: 'Filtrar por estado del préstamo (activo, devuelto, vencido)',
  })
  @ApiQuery({
    name: 'usuario_id',
    required: false,
    description: 'Filtrar por colaborador (disponible para rol administrador_ti)',
  })
  @ApiQuery({
    name: 'por_vencer',
    required: false,
    type: Boolean,
    description: 'Filtrar préstamos activos próximos a vencer en <= 3 días',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página para paginación (inicia en 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad máxima de registros por página',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de préstamos obtenido exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o expirado',
  })
  async getPrestamos(
    @CurrentUser() user: UsuarioEntity,
    @Query('estado') estado?: string,
    @Query('usuario_id') usuarioId?: string,
    @Query('por_vencer') porVencer?: string | boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedPrestamosResponse> {
    // Si el usuario no es Administrador de TI, forzar el filtro a su propio identificador
    const targetUsuarioId =
      user.rol === RolUsuario.ADMINISTRADOR_TI ? usuarioId : user.id;

    const isPorVencer =
      porVencer === true || porVencer === 'true' || porVencer === '1';

    return this.prestamosService.findAll({
      usuario_id: targetUsuarioId,
      estado,
      por_vencer: isPorVencer,
      page,
      limit,
    });
  }

  /**
   * Registra la recepción física y devolución de un equipo tecnológico prestado.
   * Reglas de negocio y auditoría (TC004, TC009):
   * - Restringido exclusivamente al rol de Administrador de TI.
   * - Marca el préstamo como `devuelto`, registra la fecha de devolución y el encargado receptor.
   * - Actualiza el estado físico del equipo en inventario (`disponible`, `en_mantencion` o `de_baja`).
   */
  @Post(':id/devolucion')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.ADMINISTRADOR_TI)
  @ApiOperation({
    summary: 'Registrar devolución de un equipo prestado',
    description:
      'Exclusivo para administradores de TI. Finaliza el préstamo activo, registra observaciones de recepción y restablece el estado operativo del activo en inventario (TC004).',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador único UUID del préstamo a liquidar',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Devolución registrada exitosamente y activo reintegrado',
    type: PrestamoEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'El préstamo ya se encuentra devuelto o los parámetros son inválidos',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Acceso denegado: solo usuarios con rol administrador_ti pueden registrar devoluciones (TC009)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado en el sistema',
  })
  async registrarDevolucion(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioEntity,
    @Body() dto: RegistrarDevolucionDto,
  ): Promise<PrestamoEntity> {
    return this.prestamosService.registrarDevolucion(id, user.id, dto);
  }

  /**
   * Solicita o aprueba la extensión del plazo de vigencia de un préstamo activo.
   * Reglas de negocio:
   * - Permitido como máximo 1 única vez en el ciclo de vida del préstamo (renovado === false).
   * - No aplicable sobre préstamos ya devueltos o con plazo vencido.
   * - Extiende la fecha de vencimiento hasta un máximo de 30 días adicionales.
   * - Puede ser ejecutado por el colaborador titular o por un administrador de TI.
   */
  @Post(':id/renovar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar o aplicar renovación de período de préstamo',
    description:
      'Extiende el plazo de vigencia del préstamo por hasta 30 días adicionales. Solo se permite 1 renovación por préstamo en estado activo y no vencido.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador único UUID del préstamo a renovar',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo renovado exitosamente con nueva fecha de vencimiento',
    type: PrestamoEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'El préstamo ya fue renovado previamente, ya fue devuelto o se encuentra vencido',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Acceso denegado: un colaborador solo puede renovar sus propios préstamos',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado en el sistema',
  })
  async renovarPrestamo(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioEntity,
    @Body() dto: RenovarPrestamoDto,
  ): Promise<PrestamoEntity> {
    const esAdmin = user.rol === RolUsuario.ADMINISTRADOR_TI;
    return this.prestamosService.renovarPrestamo(id, user.id, dto, esAdmin);
  }
}
