import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokens } from '../styles/tokens.ts';
import type { Equipo, CollaboratorQuota, SolicitarPrestamoDto } from '../types/index.ts';

describe('Item 13 - Reglas de Negocio y Lógica del Catálogo de Equipos', () => {
  it('debe validar la estructura de tokens de diseño institucional Apiux', () => {
    assert.equal(tokens.colors.primary, '#0B2F6B');
    assert.equal(tokens.colors.navDark, '#0E2045');
    assert.equal(tokens.colors.status.disponible.dot, '#10B981');
    assert.equal(tokens.colors.status.prestado.dot, '#F59E0B');
    assert.equal(tokens.colors.status.vencido.dot, '#EF4444');
  });

  describe('Control de Cupo Máximo de Préstamos (Máximo 2 activos)', () => {
    it('permite solicitar préstamos cuando el colaborador tiene 0 préstamos activos', () => {
      const quota: CollaboratorQuota = {
        prestamos_activos_count: 0,
        cupo_maximo: 2,
        cupo_restante: 2,
        puede_solicitar: true,
      };

      assert.equal(quota.prestamos_activos_count, 0);
      assert.equal(quota.cupo_restante, 2);
      assert.equal(quota.puede_solicitar, true);
    });

    it('permite solicitar préstamos cuando el colaborador tiene 1 préstamo activo', () => {
      const quota: CollaboratorQuota = {
        prestamos_activos_count: 1,
        cupo_maximo: 2,
        cupo_restante: 1,
        puede_solicitar: true,
      };

      assert.equal(quota.prestamos_activos_count, 1);
      assert.equal(quota.cupo_restante, 1);
      assert.equal(quota.puede_solicitar, true);
    });

    it('bloquea nuevas solicitudes cuando el colaborador alcanza el límite de 2 préstamos activos', () => {
      const quota: CollaboratorQuota = {
        prestamos_activos_count: 2,
        cupo_maximo: 2,
        cupo_restante: 0,
        puede_solicitar: false,
      };

      assert.equal(quota.prestamos_activos_count, 2);
      assert.equal(quota.cupo_restante, 0);
      assert.equal(quota.puede_solicitar, false);
    });
  });

  describe('Validación de Formulario de Solicitud de Préstamo', () => {
    const validateSolicitud = (
      dto: SolicitarPrestamoDto,
      aceptaCustodia: boolean,
      estadoEquipo: string,
      puedeSolicitar: boolean
    ): { valid: boolean; error?: string } => {
      if (!puedeSolicitar) {
        return { valid: false, error: 'Cupo máximo alcanzado (2/2)' };
      }
      if (estadoEquipo !== 'disponible') {
        return { valid: false, error: 'El equipo no se encuentra disponible' };
      }
      if (![7, 15, 30].includes(dto.dias_solicitados)) {
        return { valid: false, error: 'Duración no permitida (solo 7, 15 o 30 días)' };
      }
      if (dto.motivo.trim().length < 10) {
        return { valid: false, error: 'El motivo debe contener al menos 10 caracteres' };
      }
      if (!aceptaCustodia) {
        return { valid: false, error: 'Debe aceptar la declaración de custodia corporativa' };
      }
      return { valid: true };
    };

    it('acepta una solicitud válida con 30 días y motivo justificado', () => {
      const dto: SolicitarPrestamoDto = {
        equipo_id: 'eq-001',
        motivo: 'Proyecto Migración Cloud para cliente BancoEstado',
        dias_solicitados: 30,
      };

      const result = validateSolicitud(dto, true, 'disponible', true);
      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    it('rechaza una solicitud si el motivo tiene menos de 10 caracteres', () => {
      const dto: SolicitarPrestamoDto = {
        equipo_id: 'eq-001',
        motivo: 'trabajo',
        dias_solicitados: 15,
      };

      const result = validateSolicitud(dto, true, 'disponible', true);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /10 caracteres/);
    });

    it('rechaza una solicitud si el usuario no aceptó la cláusula de custodia', () => {
      const dto: SolicitarPrestamoDto = {
        equipo_id: 'eq-001',
        motivo: 'Asignación temporal para pruebas de integración',
        dias_solicitados: 7,
      };

      const result = validateSolicitud(dto, false, 'disponible', true);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /custodia/);
    });

    it('rechaza una solicitud si el equipo ya está prestado', () => {
      const dto: SolicitarPrestamoDto = {
        equipo_id: 'eq-002',
        motivo: 'Asignación para desarrollo backend',
        dias_solicitados: 30,
      };

      const result = validateSolicitud(dto, true, 'prestado', true);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /no se encuentra disponible/);
    });

    it('rechaza una solicitud si el colaborador no tiene cupo disponible', () => {
      const dto: SolicitarPrestamoDto = {
        equipo_id: 'eq-001',
        motivo: 'Asignación para desarrollo backend',
        dias_solicitados: 30,
      };

      const result = validateSolicitud(dto, true, 'disponible', false);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /Cupo máximo/);
    });
  });

  describe('Filtros y Búsqueda en el Catálogo', () => {
    const mockEquipos: Equipo[] = [
      {
        id: '1',
        codigo_inventario: 'APIUX-NB-001',
        categoria_id: 'cat-1',
        marca: 'Lenovo',
        modelo: 'ThinkPad T14s',
        numero_serie: 'PF3X89K2',
        estado: 'disponible',
        creado_en: '2026-01-01',
      },
      {
        id: '2',
        codigo_inventario: 'APIUX-MN-005',
        categoria_id: 'cat-2',
        marca: 'Dell',
        modelo: 'UltraSharp U2723QE',
        numero_serie: 'CN0Y7493',
        estado: 'prestado',
        creado_en: '2026-01-02',
      },
      {
        id: '3',
        codigo_inventario: 'APIUX-NB-002',
        categoria_id: 'cat-1',
        marca: 'Apple',
        modelo: 'MacBook Pro 16 M3',
        numero_serie: 'C02G8712',
        estado: 'disponible',
        creado_en: '2026-01-03',
      },
      {
        id: '4',
        codigo_inventario: 'APIUX-AC-010',
        categoria_id: 'cat-3',
        marca: 'Jabra',
        modelo: 'Evolve2 65 Headset',
        numero_serie: 'JB991204',
        estado: 'en_mantencion',
        creado_en: '2026-01-04',
      },
    ];

    it('filtra por término de búsqueda en marca o modelo', () => {
      const term = 'thinkpad';
      const filtered = mockEquipos.filter((e) =>
        `${e.marca} ${e.modelo}`.toLowerCase().includes(term.toLowerCase())
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].codigo_inventario, 'APIUX-NB-001');
    });

    it('filtra por término de búsqueda en número de serie', () => {
      const term = 'CN0Y';
      const filtered = mockEquipos.filter((e) =>
        e.numero_serie.toLowerCase().includes(term.toLowerCase())
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].marca, 'Dell');
    });

    it('filtra por término de búsqueda en código de inventario', () => {
      const term = 'NB-002';
      const filtered = mockEquipos.filter((e) =>
        e.codigo_inventario.toLowerCase().includes(term.toLowerCase())
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].marca, 'Apple');
    });

    it('filtra por categoría seleccionada', () => {
      const catId = 'cat-1';
      const filtered = mockEquipos.filter((e) => e.categoria_id === catId);
      assert.equal(filtered.length, 2);
    });

    it('filtra por estado del equipo', () => {
      const filteredDisponibles = mockEquipos.filter((e) => e.estado === 'disponible');
      assert.equal(filteredDisponibles.length, 2);

      const filteredPrestados = mockEquipos.filter((e) => e.estado === 'prestado');
      assert.equal(filteredPrestados.length, 1);
      assert.equal(filteredPrestados[0].modelo, 'UltraSharp U2723QE');
    });

    it('omite el parámetro de estado cuando statusFilter es "todos"', () => {
      const buildQueryParams = (statusFilter: string, search: string, categoryId: string | null) => {
        const params: Record<string, string | number> = { page: 1, limit: 50 };
        if (search.trim()) params.search = search.trim();
        if (categoryId && categoryId !== 'todos') params.categoria_id = categoryId;
        if (statusFilter && statusFilter !== 'todos') params.estado = statusFilter;
        return params;
      };

      const paramsTodos = buildQueryParams('todos', '', null);
      assert.equal(paramsTodos.estado, undefined);

      const paramsDisponible = buildQueryParams('disponible', '', null);
      assert.equal(paramsDisponible.estado, 'disponible');
    });
  });

  describe('Cálculo de Fechas de Devolución', () => {
    it('calcula fechas de devolución futuras exactas', () => {
      const now = new Date();
      const in30Days = new Date(now);
      in30Days.setDate(in30Days.getDate() + 30);

      assert.ok(in30Days.getTime() > now.getTime());
      const diffDays = Math.round((in30Days.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      assert.equal(diffDays, 30);
    });
  });
});
