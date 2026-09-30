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
import { EquiposService, PaginatedResponse } from './equipos.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { FilterEquipoDto } from './dto/filter-equipo.dto';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { CategoriaEntity } from '../../database/entities/categoria.entity';
import { AzureAuthGuard } from '../../common/guards/azure-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RolUsuario } from '../../database/entities/usuario.entity';

/**
 * Controlador para la gestión de inventario de equipos tecnológicos y categorías.
 * Provee endpoints para:
 * - GET  /api/v1/categorias: Listado completo de categorías disponibles
 * - GET  /api/v1/equipos: Listado paginado con búsqueda y filtros
 * - GET  /api/v1/equipos/:id: Detalle de un equipo específico
 * - POST /api/v1/equipos: Registro de nuevo equipo (restringido a administrador_ti)
 */
@ApiTags('Inventario de Equipos')
@ApiBearerAuth()
@UseGuards(AzureAuthGuard, RolesGuard)
@Controller('api/v1')
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  /**
   * Obtiene la lista completa de categorías de equipos ordenadas alfabéticamente.
   * Accesible públicamente para catálogo y verificación de inventario.
   */
  @Public()
  @Get('categorias')
  @ApiOperation({
    operationId: 'getCategorias',
    summary: 'Listar categorías de equipos tecnológicos',
    description:
      'Retorna el catálogo completo de categorías registradas (Notebook, Monitor, Accesorio, etc.).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Catálogo de categorías obtenido exitosamente',
    type: [CategoriaEntity],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o inválido',
  })
  async getCategorias(): Promise<CategoriaEntity[]> {
    return this.equiposService.findAllCategorias();
  }

  /**
   * Obtiene el listado de equipos con soporte para paginación, filtros por categoría/estado
   * y búsqueda general por código de inventario, marca, modelo o número de serie.
   */
  @Get('equipos')
  @ApiOperation({
    operationId: 'getEquipos',
    summary: 'Listar inventario de equipos con filtros',
    description:
      'Retorna inventario de equipos filtrados por categoría, estado o término de búsqueda libre.',
  })
  @ApiQuery({
    name: 'categoria_id',
    required: false,
    type: String,
    description: 'Identificador único UUID de la categoría de equipo',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: EstadoEquipo,
    description: 'Estado operativo del equipo (disponible, prestado, en_mantencion, de_baja)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Término de búsqueda libre por código de inventario, marca, modelo o número de serie',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página para paginación de resultados',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad máxima de registros por página (máx. 100)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de equipos',
    type: [EquipoEntity],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o inválido',
  })
  async getEquipos(
    @Query() filters: FilterEquipoDto,
  ): Promise<PaginatedResponse<EquipoEntity>> {
    return this.equiposService.findAllEquipos(filters);
  }

  /**
   * Obtiene el detalle completo de un equipo específico mediante su identificador UUID.
   */
  @Get('equipos/:id')
  @ApiOperation({
    operationId: 'getEquipoById',
    summary: 'Obtener detalle de un equipo por su ID',
    description:
      'Retorna los datos del equipo incluyendo la categoría asociada.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador único UUID del equipo',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Equipo encontrado exitosamente',
    type: EquipoEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Equipo no encontrado con el identificador proporcionado',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o inválido',
  })
  async getEquipoById(@Param('id') id: string): Promise<EquipoEntity> {
    return this.equiposService.findEquipoById(id);
  }

  /**
   * Registra un nuevo equipo tecnológico en el inventario.
   * Requiere rol obligatorio de administrador de TI.
   */
  @Post('equipos')
  @Roles(RolUsuario.ADMINISTRADOR_TI)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    operationId: 'createEquipo',
    summary: 'Registrar nuevo equipo tecnológico en inventario',
    description:
      'Registra un nuevo activo tecnológico en el catálogo. Exclusivo para administradores de TI.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Equipo registrado exitosamente en el inventario',
    type: EquipoEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos en el cuerpo de la solicitud',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Acceso denegado: solo usuarios con rol administrador_ti pueden registrar equipos',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Conflicto: ya existe un equipo con el código de inventario o número de serie especificado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoría especificada no existe',
  })
  async createEquipo(@Body() createDto: CreateEquipoDto): Promise<EquipoEntity> {
    return this.equiposService.createEquipo(createDto);
  }
}
