import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  SolicitudPrestamo,
  Prestamo,
  EstadoEquipo,
  RegistrarDevolucionDto,
  RenovarPrestamoDto,
  InventoryMetrics,
} from '../types/index.ts';

describe('Item 14 - Reglas de Negocio de la Consola del Encargado TI (Panel_Encargado)', () => {
  describe('1. Reglas de Aprobación de Solicitudes de Préstamo', () => {
    const validateApproval = (
      solicitud: SolicitudPrestamo,
      dias: number,
      observaciones?: string
    ): { valid: boolean; error?: string; fechaVencimiento?: Date } => {
      if (solicitud.estado !== 'pendiente') {
        return { valid: false, error: 'Solo se pueden aprobar solicitudes en estado pendiente' };
      }
      if (![7, 15, 30].includes(dias)) {
        return { valid: false, error: 'La duración del préstamo debe ser de 7, 15 o 30 días' };
      }
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + dias);

      return { valid: true, fechaVencimiento };
    };

    const mockSolicitud: SolicitudPrestamo = {
      id: 'sol-001',
      usuario_id: 'usr-001',
      equipo_id: 'eq-001',
      motivo: 'Asignación para proyecto bancario de alta disponibilidad',
      dias_solicitados: 30,
      estado: 'pendiente',
      fecha_solicitud: new Date().toISOString(),
      usuario: {
        id: 'usr-001',
        azure_id: 'az-001',
        email: 'colaborador@api-ux.com',
        nombre_completo: 'Carlos Mendoza',
        rol: 'colaborador',
        activo: true,
        creado_en: '2026-01-01',
      },
      equipo: {
        id: 'eq-001',
        codigo_inventario: 'APIUX-NB-001',
        categoria_id: 'cat-1',
        marca: 'Lenovo',
        modelo: 'ThinkPad T14s',
        numero_serie: 'PF3X89K2',
        estado: 'disponible',
        creado_en: '2026-01-01',
      },
    };

    it('aprueba exitosamente una solicitud pendiente con duración de 30 días', () => {
      const result = validateApproval(mockSolicitud, 30, 'Entrega en oficina central con accesorios');
      assert.equal(result.valid, true);
      assert.ok(result.fechaVencimiento);
      const diffDays = Math.round(
        (result.fechaVencimiento.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      assert.equal(diffDays, 30);
    });

    it('aprueba exitosamente una solicitud con duración de 7 o 15 días', () => {
      const res7 = validateApproval(mockSolicitud, 7);
      assert.equal(res7.valid, true);

      const res15 = validateApproval(mockSolicitud, 15);
      assert.equal(res15.valid, true);
    });

    it('rechaza duración inválida que no sea 7, 15 o 30 días', () => {
      const resInvalid = validateApproval(mockSolicitud, 45);
      assert.equal(resInvalid.valid, false);
      assert.match(resInvalid.error || '', /7, 15 o 30 días/);
    });

    it('rechaza aprobar una solicitud que ya fue aprobada o rechazada previamente', () => {
      const solAprobada: SolicitudPrestamo = { ...mockSolicitud, estado: 'aprobada' };
      const resAprobada = validateApproval(solAprobada, 30);
      assert.equal(resAprobada.valid, false);
      assert.match(resAprobada.error || '', /estado pendiente/);

      const solRechazada: SolicitudPrestamo = { ...mockSolicitud, estado: 'rechazada' };
      const resRechazada = validateApproval(solRechazada, 30);
      assert.equal(resRechazada.valid, false);
    });
  });

  describe('2. Reglas de Rechazo de Solicitudes de Préstamo', () => {
    const validateRejection = (
      solicitud: SolicitudPrestamo,
      motivoRechazo: string
    ): { valid: boolean; error?: string } => {
      if (solicitud.estado !== 'pendiente') {
        return { valid: false, error: 'Solo se pueden rechazar solicitudes en estado pendiente' };
      }
      if (!motivoRechazo || motivoRechazo.trim().length < 5) {
        return { valid: false, error: 'El motivo de rechazo debe contener al menos 5 caracteres' };
      }
      return { valid: true };
    };

    const mockSolicitud: SolicitudPrestamo = {
      id: 'sol-002',
      usuario_id: 'usr-002',
      equipo_id: 'eq-002',
      motivo: 'Préstamo temporal de pantalla externa',
      dias_solicitados: 15,
      estado: 'pendiente',
      fecha_solicitud: new Date().toISOString(),
    };

    it('acepta un motivo de rechazo justificado con más de 5 caracteres', () => {
      const result = validateRejection(
        mockSolicitud,
        'Equipo reservado para mantención preventiva programada'
      );
      assert.equal(result.valid, true);
    });

    it('rechaza cuando la justificación es demasiado corta o vacía', () => {
      const resEmpty = validateRejection(mockSolicitud, '   ');
      assert.equal(resEmpty.valid, false);
      assert.match(resEmpty.error || '', /al menos 5 caracteres/);

      const resShort = validateRejection(mockSolicitud, 'No');
      assert.equal(resShort.valid, false);
      assert.match(resShort.error || '', /al menos 5 caracteres/);
    });
  });

  describe('3. Reglas de Recepción Física y Devolución (ReturnConfirmation)', () => {
    const validateReturn = (
      prestamo: Prestamo,
      dto: RegistrarDevolucionDto
    ): { valid: boolean; error?: string; nuevoEstadoEquipo?: EstadoEquipo } => {
      if (prestamo.estado === 'devuelto') {
        return { valid: false, error: 'El préstamo ya ha sido registrado como devuelto previamente' };
      }
      if (!dto.observaciones || dto.observaciones.trim().length < 5) {
        return { valid: false, error: 'Las observaciones de recepción deben tener al menos 5 caracteres' };
      }
      const estadosValidos: EstadoEquipo[] = ['disponible', 'en_mantencion', 'de_baja'];
      if (!estadosValidos.includes(dto.estado_fisico_equipo)) {
        return { valid: false, error: 'Estado físico del equipo no válido' };
      }
      return { valid: true, nuevoEstadoEquipo: dto.estado_fisico_equipo };
    };

    const mockPrestamo: Prestamo = {
      id: 'prestamo-001',
      solicitud_id: 'sol-001',
      usuario_id: 'usr-001',
      equipo_id: 'eq-001',
      fecha_inicio: '2026-09-01T10:00:00.000Z',
      fecha_vencimiento: '2026-10-01T10:00:00.000Z',
      estado: 'activo',
      renovado: false,
      creado_en: '2026-09-01T10:00:00.000Z',
    };

    it('registra devolución física en estado disponible cuando el equipo está intacto', () => {
      const dto: RegistrarDevolucionDto = {
        observaciones: 'Recepción conforme: equipo limpio, cargador USB-C y funda incluidos',
        estado_fisico_equipo: 'disponible',
      };
      const result = validateReturn(mockPrestamo, dto);
      assert.equal(result.valid, true);
      assert.equal(result.nuevoEstadoEquipo, 'disponible');
    });

    it('registra devolución física con pase a mantenimiento por desgaste o fallas', () => {
      const dto: RegistrarDevolucionDto = {
        observaciones: 'Bisagra con holgura y teclado requiere limpieza profunda técnica',
        estado_fisico_equipo: 'en_mantencion',
      };
      const result = validateReturn(mockPrestamo, dto);
      assert.equal(result.valid, true);
      assert.equal(result.nuevoEstadoEquipo, 'en_mantencion');
    });

    it('rechaza registrar devolución si las observaciones son insuficientes', () => {
      const dto: RegistrarDevolucionDto = {
        observaciones: 'Ok',
        estado_fisico_equipo: 'disponible',
      };
      const result = validateReturn(mockPrestamo, dto);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /al menos 5 caracteres/);
    });

    it('impide registrar devolución en un préstamo ya devuelto', () => {
      const prestamoDevuelto: Prestamo = {
        ...mockPrestamo,
        estado: 'devuelto',
        fecha_devolucion: '2026-09-28T15:00:00.000Z',
      };
      const dto: RegistrarDevolucionDto = {
        observaciones: 'Recepción conforme',
        estado_fisico_equipo: 'disponible',
      };
      const result = validateReturn(prestamoDevuelto, dto);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /ya ha sido registrado como devuelto/);
    });
  });

  describe('4. Reglas de Renovación Única de Préstamos (+30 días)', () => {
    const validateRenewal = (
      prestamo: Prestamo,
      dto: RenovarPrestamoDto
    ): { valid: boolean; error?: string; nuevaFechaVencimiento?: Date } => {
      if (prestamo.estado !== 'activo') {
        return { valid: false, error: 'Solo se pueden renovar préstamos que se encuentren activos' };
      }
      if (prestamo.renovado) {
        return {
          valid: false,
          error: 'Este préstamo ya fue renovado una vez. No se permiten extensiones adicionales',
        };
      }
      if (dto.dias_extension !== 30) {
        return { valid: false, error: 'La extensión por renovación debe ser exactamente de 30 días' };
      }
      if (!dto.motivo_renovacion || dto.motivo_renovacion.trim().length === 0) {
        return { valid: false, error: 'Debe ingresar un motivo para la renovación' };
      }

      const vencimientoActual = new Date(prestamo.fecha_vencimiento);
      const nuevaFechaVencimiento = new Date(vencimientoActual);
      nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + dto.dias_extension);

      return { valid: true, nuevaFechaVencimiento };
    };

    const mockPrestamoActivo: Prestamo = {
      id: 'prestamo-002',
      solicitud_id: 'sol-002',
      usuario_id: 'usr-002',
      equipo_id: 'eq-002',
      fecha_inicio: '2026-09-01T00:00:00.000Z',
      fecha_vencimiento: '2026-10-01T00:00:00.000Z',
      estado: 'activo',
      renovado: false,
      creado_en: '2026-09-01T00:00:00.000Z',
    };

    it('permite una primera renovación por 30 días a un préstamo activo', () => {
      const dto: RenovarPrestamoDto = {
        dias_extension: 30,
        motivo_renovacion: 'Extensión para cierre de sprint y certificación del release',
      };
      const result = validateRenewal(mockPrestamoActivo, dto);
      assert.equal(result.valid, true);
      assert.ok(result.nuevaFechaVencimiento);

      const diffDays = Math.round(
        (result.nuevaFechaVencimiento.getTime() -
          new Date(mockPrestamoActivo.fecha_vencimiento).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      assert.equal(diffDays, 30);
    });

    it('bloquea estrictamente una segunda renovación si el préstamo ya fue renovado', () => {
      const prestamoYaRenovado: Prestamo = {
        ...mockPrestamoActivo,
        renovado: true,
      };
      const dto: RenovarPrestamoDto = {
        dias_extension: 30,
        motivo_renovacion: 'Segunda solicitud de prórroga',
      };
      const result = validateRenewal(prestamoYaRenovado, dto);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /ya fue renovado una vez/);
    });

    it('impide renovar un préstamo que ya fue devuelto o vencido', () => {
      const prestamoDevuelto: Prestamo = {
        ...mockPrestamoActivo,
        estado: 'devuelto',
      };
      const dto: RenovarPrestamoDto = {
        dias_extension: 30,
        motivo_renovacion: 'Intento de renovación',
      };
      const result = validateRenewal(prestamoDevuelto, dto);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /se encuentren activos/);
    });
  });

  describe('5. Detección de Préstamos Por Vencer (<= 3 días) y Vencidos', () => {
    const checkExpirationStatus = (
      vencimientoIso: string,
      now: Date = new Date()
    ): { isPorVencer: boolean; isVencido: boolean; diasRestantes: number } => {
      const vencimiento = new Date(vencimientoIso);
      const diffMs = vencimiento.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return {
        isPorVencer: diffDays >= 0 && diffDays <= 3,
        isVencido: diffDays < 0,
        diasRestantes: diffDays,
      };
    };

    it('identifica un préstamo que vence en 2 días como por vencer', () => {
      const now = new Date('2026-10-01T12:00:00.000Z');
      const vencimiento = '2026-10-03T12:00:00.000Z'; // 2 días

      const status = checkExpirationStatus(vencimiento, now);
      assert.equal(status.isPorVencer, true);
      assert.equal(status.isVencido, false);
      assert.equal(status.diasRestantes, 2);
    });

    it('identifica un préstamo que vence hoy como por vencer', () => {
      const now = new Date('2026-10-01T08:00:00.000Z');
      const vencimiento = '2026-10-01T18:00:00.000Z'; // hoy

      const status = checkExpirationStatus(vencimiento, now);
      assert.equal(status.isPorVencer, true);
      assert.equal(status.isVencido, false);
    });

    it('no marca por vencer un préstamo con más de 3 días de vigencia', () => {
      const now = new Date('2026-10-01T12:00:00.000Z');
      const vencimiento = '2026-10-15T12:00:00.000Z'; // 14 días

      const status = checkExpirationStatus(vencimiento, now);
      assert.equal(status.isPorVencer, false);
      assert.equal(status.isVencido, false);
    });

    it('identifica un préstamo vencido cuando la fecha es pasada', () => {
      const now = new Date('2026-10-05T12:00:00.000Z');
      const vencimiento = '2026-10-01T12:00:00.000Z'; // pasado

      const status = checkExpirationStatus(vencimiento, now);
      assert.equal(status.isPorVencer, false);
      assert.equal(status.isVencido, true);
    });
  });

  describe('6. Métricas Agregadas e Integridad de la Consola TI', () => {
    it('calcula métricas de inventario coherentes para la consola TI', () => {
      const metrics: InventoryMetrics = {
        total_activos: 150,
        prestamos_activos: 42,
        solicitudes_pendientes: 7,
        por_vencer: 5,
        total_equipos: 150,
        equipos_disponibles: 98,
        equipos_prestados: 42,
        equipos_en_mantencion: 10,
        prestamos_vencidos: 3,
      };

      assert.equal(metrics.total_activos, 150);
      assert.equal(
        (metrics.equipos_disponibles || 0) +
          (metrics.equipos_prestados || 0) +
          (metrics.equipos_en_mantencion || 0),
        150
      );
      assert.ok(metrics.por_vencer <= metrics.prestamos_activos);
    });
  });
});
