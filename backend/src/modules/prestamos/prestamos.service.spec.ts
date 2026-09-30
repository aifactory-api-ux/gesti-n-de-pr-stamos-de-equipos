import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrestamosService } from './prestamos.service';
import { PrestamoEntity, EstadoPrestamo } from '../../database/entities/prestamo.entity';
import { EquipoEntity, EstadoEquipo } from '../../database/entities/equipo.entity';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { RenovarPrestamoDto } from './dto/renovar-prestamo.dto';

describe('PrestamosService', () => {
  let service: PrestamosService;
  let prestamoRepositoryMock: any;
  let equipoRepositoryMock: any;
  let queryBuilderMock: any;

  const mockEquipo: EquipoEntity = {
    id: 'eq-uuid-1',
    codigo_inventario: 'NB-001',
    categoria_id: 'cat-uuid-1',
    categoria: { id: 'cat-uuid-1', nombre: 'Notebook', descripcion: 'Laptops' },
    marca: 'Dell',
    modelo: 'Latitude 5420',
    numero_serie: 'SN-12345678',
    estado: EstadoEquipo.PRESTADO,
    creado_en: new Date('2026-01-01T10:00:00Z'),
  };

  const mockPrestamo: PrestamoEntity = {
    id: 'prest-uuid-1',
    solicitud_id: 'sol-uuid-1',
    solicitud: null as any,
    usuario_id: 'usr-colab-1',
    usuario: null as any,
    equipo_id: 'eq-uuid-1',
    equipo: mockEquipo,
    encargado_entrega_id: 'usr-admin-1',
    encargado_entrega: null as any,
    encargado_devolucion_id: null,
    encargado_devolucion: null,
    fecha_inicio: new Date('2026-02-01T10:00:00Z'),
    fecha_vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Vigente por 15 días más
    renovado: false,
    fecha_devolucion: null,
    estado: EstadoPrestamo.ACTIVO,
    observaciones: 'Préstamo inicial',
  };

  beforeEach(async () => {
    queryBuilderMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockPrestamo], 1]),
    };

    prestamoRepositoryMock = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    equipoRepositoryMock = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrestamosService,
        {
          provide: getRepositoryToken(PrestamoEntity),
          useValue: prestamoRepositoryMock,
        },
        {
          provide: getRepositoryToken(EquipoEntity),
          useValue: equipoRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<PrestamosService>(PrestamosService);
  });

  it('debe estar definido el servicio de préstamos', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('debe retornar lista paginada de préstamos', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });

      expect(prestamoRepositoryMock.createQueryBuilder).toHaveBeenCalledWith('prestamo');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('debe aplicar filtros por usuario_id y estado cuando se proporcionan', async () => {
      await service.findAll({
        usuario_id: 'usr-colab-1',
        estado: EstadoPrestamo.ACTIVO,
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'prestamo.usuario_id = :usuario_id',
        { usuario_id: 'usr-colab-1' },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'prestamo.estado = :estado',
        { estado: EstadoPrestamo.ACTIVO },
      );
    });

    it('debe aplicar filtro por_vencer cuando se solicita préstamos por vencer en 3 días', async () => {
      await service.findAll({
        por_vencer: true,
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'prestamo.estado = :estadoActivo',
        { estadoActivo: EstadoPrestamo.ACTIVO },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'prestamo.fecha_vencimiento >= :ahora',
        expect.any(Object),
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'prestamo.fecha_vencimiento <= :limite',
        expect.any(Object),
      );
    });
  });

  describe('findPrestamoById', () => {
    it('debe retornar el préstamo si existe con relaciones cargadas', async () => {
      prestamoRepositoryMock.findOne.mockResolvedValue(mockPrestamo);

      const result = await service.findPrestamoById('prest-uuid-1');

      expect(result).toEqual(mockPrestamo);
    });

    it('debe lanzar NotFoundException si el préstamo no existe', async () => {
      prestamoRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.findPrestamoById('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('registrarDevolucion (TC004)', () => {
    const dtoDevolucion: RegistrarDevolucionDto = {
      estado_fisico_equipo: EstadoEquipo.DISPONIBLE,
      observaciones: 'Equipo devuelto en perfecto estado',
    };

    it('debe registrar la devolución, actualizar préstamo a devuelto y equipo a disponible (TC004)', async () => {
      prestamoRepositoryMock.findOne
        .mockResolvedValueOnce({ ...mockPrestamo, equipo: { ...mockEquipo } }) // Carga inicial
        .mockResolvedValueOnce({
          ...mockPrestamo,
          estado: EstadoPrestamo.DEVUELTO,
          encargado_devolucion_id: 'usr-admin-1',
          equipo: { ...mockEquipo, estado: EstadoEquipo.DISPONIBLE },
        }); // findPrestamoById final

      prestamoRepositoryMock.save.mockResolvedValue({});
      equipoRepositoryMock.save.mockResolvedValue({});

      const result = await service.registrarDevolucion(
        'prest-uuid-1',
        'usr-admin-1',
        dtoDevolucion,
      );

      expect(prestamoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoPrestamo.DEVUELTO,
          encargado_devolucion_id: 'usr-admin-1',
        }),
      );
      expect(equipoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoEquipo.DISPONIBLE,
        }),
      );
      expect(result.estado).toBe(EstadoPrestamo.DEVUELTO);
    });

    it('debe permitir reintegrar equipo en estado en_mantencion si fue devuelto con fallas', async () => {
      const dtoDañado: RegistrarDevolucionDto = {
        estado_fisico_equipo: EstadoEquipo.EN_MANTENCION,
        observaciones: 'Teclado con teclas sueltas',
      };

      prestamoRepositoryMock.findOne
        .mockResolvedValueOnce({ ...mockPrestamo, equipo: { ...mockEquipo } })
        .mockResolvedValueOnce({
          ...mockPrestamo,
          estado: EstadoPrestamo.DEVUELTO,
        });

      await service.registrarDevolucion('prest-uuid-1', 'usr-admin-1', dtoDañado);

      expect(equipoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoEquipo.EN_MANTENCION,
        }),
      );
    });

    it('debe lanzar NotFoundException si el préstamo no existe', async () => {
      prestamoRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.registrarDevolucion('inexistente', 'usr-admin-1', dtoDevolucion),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el préstamo ya fue devuelto previamente', async () => {
      prestamoRepositoryMock.findOne.mockResolvedValue({
        ...mockPrestamo,
        estado: EstadoPrestamo.DEVUELTO,
        fecha_devolucion: new Date(),
      });

      await expect(
        service.registrarDevolucion('prest-uuid-1', 'usr-admin-1', dtoDevolucion),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('renovarPrestamo', () => {
    const dtoRenovacion: RenovarPrestamoDto = {
      dias_extension: 30,
      observaciones: 'Extensión para cierre de sprint institucional',
    };

    it('debe extender la fecha de vencimiento y marcar renovado en true', async () => {
      const fechaVencimientoOriginal = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const prestamoOriginal = {
        ...mockPrestamo,
        fecha_vencimiento: fechaVencimientoOriginal,
        renovado: false,
      };

      prestamoRepositoryMock.findOne
        .mockResolvedValueOnce(prestamoOriginal)
        .mockResolvedValueOnce({
          ...prestamoOriginal,
          renovado: true,
        });
      prestamoRepositoryMock.save.mockResolvedValue({});

      const result = await service.renovarPrestamo(
        'prest-uuid-1',
        'usr-colab-1',
        dtoRenovacion,
        false,
      );

      expect(prestamoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          renovado: true,
        }),
      );
      expect(result.renovado).toBe(true);
    });

    it('debe admitir motivo_renovacion como campo alternativo en el DTO de renovación', async () => {
      const fechaVencimientoOriginal = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const prestamoOriginal = {
        ...mockPrestamo,
        fecha_vencimiento: fechaVencimientoOriginal,
        renovado: false,
      };

      prestamoRepositoryMock.findOne
        .mockResolvedValueOnce(prestamoOriginal)
        .mockResolvedValueOnce({
          ...prestamoOriginal,
          renovado: true,
        });
      prestamoRepositoryMock.save.mockResolvedValue({});

      const result = await service.renovarPrestamo(
        'prest-uuid-1',
        'usr-colab-1',
        { dias_extension: 15, motivo_renovacion: 'Extensión de proyecto' },
        false,
      );

      expect(prestamoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          renovado: true,
          observaciones: expect.stringContaining('Extensión de proyecto'),
        }),
      );
      expect(result.renovado).toBe(true);
    });

    it('debe permitir a un administrador renovar el préstamo de cualquier usuario', async () => {
      const prestamoOtroUsuario = {
        ...mockPrestamo,
        usuario_id: 'otro-colaborador-uuid',
        renovado: false,
      };

      prestamoRepositoryMock.findOne
        .mockResolvedValueOnce(prestamoOtroUsuario)
        .mockResolvedValueOnce({
          ...prestamoOtroUsuario,
          renovado: true,
        });
      prestamoRepositoryMock.save.mockResolvedValue({});

      const result = await service.renovarPrestamo(
        'prest-uuid-1',
        'usr-admin-1',
        dtoRenovacion,
        true, // esAdmin = true
      );

      expect(result).toBeDefined();
    });

    it('debe lanzar ForbiddenException si un colaborador intenta renovar el préstamo de otro usuario', async () => {
      const prestamoOtroUsuario = {
        ...mockPrestamo,
        usuario_id: 'otro-colaborador-uuid',
      };

      prestamoRepositoryMock.findOne.mockResolvedValue(prestamoOtroUsuario);

      await expect(
        service.renovarPrestamo('prest-uuid-1', 'usr-colab-1', dtoRenovacion, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar BadRequestException si el préstamo ya fue renovado previamente (máximo 1 renovación)', async () => {
      prestamoRepositoryMock.findOne.mockResolvedValue({
        ...mockPrestamo,
        renovado: true,
      });

      await expect(
        service.renovarPrestamo('prest-uuid-1', 'usr-colab-1', dtoRenovacion, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si el préstamo ya fue devuelto', async () => {
      prestamoRepositoryMock.findOne.mockResolvedValue({
        ...mockPrestamo,
        estado: EstadoPrestamo.DEVUELTO,
        fecha_devolucion: new Date(),
      });

      await expect(
        service.renovarPrestamo('prest-uuid-1', 'usr-colab-1', dtoRenovacion, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si el préstamo ya está vencido', async () => {
      prestamoRepositoryMock.findOne.mockResolvedValue({
        ...mockPrestamo,
        estado: EstadoPrestamo.VENCIDO,
        fecha_vencimiento: new Date(Date.now() - 24 * 60 * 60 * 1000), // Venció ayer
      });

      await expect(
        service.renovarPrestamo('prest-uuid-1', 'usr-colab-1', dtoRenovacion, false),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('crearPrestamo', () => {
    it('debe crear un préstamo activo con fecha de inicio y vencimiento calculada', async () => {
      const datos = {
        solicitud_id: 'sol-uuid-1',
        usuario_id: 'usr-colab-1',
        equipo_id: 'eq-uuid-1',
        encargado_entrega_id: 'usr-admin-1',
        dias_prestamo: 30,
        observaciones: 'Entrega inicial',
      };

      prestamoRepositoryMock.create.mockReturnValue({
        ...datos,
        id: 'new-prest-uuid',
        estado: EstadoPrestamo.ACTIVO,
        renovado: false,
      });
      prestamoRepositoryMock.save.mockResolvedValue({
        ...datos,
        id: 'new-prest-uuid',
        estado: EstadoPrestamo.ACTIVO,
        renovado: false,
      });

      const result = await service.crearPrestamo(datos);

      expect(prestamoRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitud_id: datos.solicitud_id,
          usuario_id: datos.usuario_id,
          equipo_id: datos.equipo_id,
          encargado_entrega_id: datos.encargado_entrega_id,
          estado: EstadoPrestamo.ACTIVO,
          renovado: false,
        }),
      );
      expect(result.estado).toBe(EstadoPrestamo.ACTIVO);
    });
  });
});
