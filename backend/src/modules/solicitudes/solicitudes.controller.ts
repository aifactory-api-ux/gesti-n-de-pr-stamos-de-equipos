import {
  Controller,
  Get,
  Post,
  Patch,
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
import { SolicitudesService, PaginatedSolicitudesResponse } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import {
  ResolverSolicitudDto,
  EstadoResolucionSolicitud,
} from './dto/resolver-solicitud.dto';
import { SolicitudPrestamoEntity } from '../../database/entities/solicitud_prestamo.entity';
import { UsuarioEntity, RolUsuario } from '../../database/entities/usuario.entity';
import { AzureAuthGuard } from '../../common/guards/azure-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Controlador para la gestión y flujo de solicitudes de préstamos de equipos.
 * Endpoints:
 * - POST  /solicitudes: Crear una nueva solicitud de préstamo (Colaborador / Admin TI)
 * - GET   /solicitudes: Listar solicitudes con paginación y filtros (filtrado por rol)
 * - GET   /solicitudes/:id: Obtener el detalle de una solicitud
 * - PATCH /solicitudes/:id/resolver: Aprobar o rechazar solicitud (Exclusivo Administrador TI)
 */
@ApiTags('Solicitudes de Préstamo')
@ApiBearerAuth()
@UseGuards(AzureAuthGuard, RolesGuard)
@Controller('api/v1/solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  /**
   * Crea una nueva solicitud de préstamo para el colaborador autenticado.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear solicitud de préstamo de equipo',
    description:
      'Registra una nueva petición en estado "pendiente". Valida cupo máximo (< 2 activos) y disponibilidad física del equipo.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Solicitud creada exitosamente en estado pendiente',
    type: SolicitudPrestamoEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Equipo no disponible, colaborador sin cupo o parámetros no válidos',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe una solicitud pendiente del colaborador para el equipo solicitado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Equipo solicitado no existe en el catálogo',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o inválido',
  })
  async createSolicitud(
    @CurrentUser() user: UsuarioEntity,
    @Body() dto: CreateSolicitudDto,
  ): Promise<SolicitudPrestamoEntity> {
    return this.solicitudesService.createSolicitud(user.id, dto);
  }

  /**
   * Obtiene el listado de solicitudes con paginación y filtros.
   */
  @Get()
  @ApiOperation({
    summary: 'Listar solicitudes de préstamo',
    description:
      'Retorna solicitudes paginadas. Los colaboradores solo ven sus propias solicitudes; administradores pueden ver todas.',
  })
  @ApiQuery({ name: 'estado', required: false, description: 'Filtrar por estado (pendiente, aprobada, rechazada)' })
  @ApiQuery({ name: 'usuario_id', required: false, description: 'Filtrar por colaborador (solo Administrador TI)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Registros por página' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de solicitudes obtenido exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado: token JWT no proporcionado o inválido',
  })
  async getSolicitudes(
    @CurrentUser() user: UsuarioEntity,
    @Query('estado') estado?: string,
    @Query('usuario_id') usuarioId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedSolicitudesResponse> {
    return this.solicitudesService.findAll(user, {
      estado,
      usuario_id: usuarioId,
      page,
      limit,
    });
  }

  /**
   * Obtiene el detalle de una solicitud específica por su ID.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de una solicitud por su ID',
    description:
      'Retorna los datos de la solicitud con relaciones de equipo, usuario y resolutor.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador único UUID de la solicitud',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle de la solicitud encontrado exitosamente',
    type: SolicitudPrestamoEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Solicitud no encontrada',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acceso denegado: no tiene permisos para consultar esta solicitud',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  async getSolicitudById(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioEntity,
  ): Promise<SolicitudPrestamoEntity> {
    return this.solicitudesService.findById(id, user);
  }

  /**
   * Resuelve una solicitud de préstamo (Aprobar o Rechazar).
   * Restringido exclusivamente al rol de Administrador de TI (TC003, TC009).
   */
  @Patch(':id/resolver')
  @Roles(RolUsuario.ADMINISTRADOR_TI)
  @ApiOperation({
    summary: 'Resolver solicitud de préstamo (Aprobar o Rechazar)',
    description:
      'Exclusivo para administradores de TI. Si se aprueba, crea el préstamo activo y pasa el equipo a prestado.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador único UUID de la solicitud a resolver',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solicitud resuelta exitosamente',
    type: SolicitudPrestamoEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'La solicitud ya fue resuelta previamente, equipo no disponible o cupo excedido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Acceso denegado: solo usuarios con rol administrador_ti pueden resolver solicitudes (TC009)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Solicitud no encontrada',
  })
  async resolverSolicitud(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioEntity,
    @Body() dto: ResolverSolicitudDto,
  ): Promise<SolicitudPrestamoEntity> {
    return this.solicitudesService.resolverSolicitud(id, user.id, dto);
  }

  /**
   * Endpoint de conveniencia para aprobar directamente una solicitud.
   * Restringido a Administrador de TI.
   */
  @Patch(':id/aprobar')
  @Roles(RolUsuario.ADMINISTRADOR_TI)
  @ApiOperation({
    summary: 'Aprobar solicitud de préstamo',
    description: 'Acción directa para aprobar una solicitud en estado pendiente.',
  })
  async aprobarSolicitud(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioEntity,
    @Body() body?: { dias_prestamo?: number; observaciones?: string },
  ): Promise<SolicitudPrestamoEntity> {
    const dto: ResolverSolicitudDto = {
      estado: EstadoResolucionSolicitud.APROBADA,
      dias_prestamo: body?.dias_prestamo,
      observaciones: body?.observaciones,
    };
    return this.solicitudesService.resolverSolicitud(id, user.id, dto);
  }

  /**
   * Endpoint de conveniencia para rechazar directamente una solicitud.
   * Restringido a Administrador de TI.
   */
  @Patch(':id/rechazar')
  @Roles(RolUsuario.ADMINISTRADOR_TI)
  @ApiOperation({
    summary: 'Rechazar solicitud de préstamo',
    description: 'Acción directa para rechazar una solicitud en estado pendiente.',
  })
  async rechazarSolicitud(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioEntity,
    @Body() body?: { observaciones?: string },
  ): Promise<SolicitudPrestamoEntity> {
    const dto: ResolverSolicitudDto = {
      estado: EstadoResolucionSolicitud.RECHAZADA,
      observaciones: body?.observaciones,
    };
    return this.solicitudesService.resolverSolicitud(id, user.id, dto);
  }
}
