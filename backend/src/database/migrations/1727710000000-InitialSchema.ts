import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración inicial que crea el esquema relacional completo de la base de datos
 * según el contrato ERD y la especificación técnica de arquitectura.
 *
 * Incluye tablas, claves foráneas, restricciones, índices y datos iniciales (seeders)
 * para categorías, usuarios de prueba, 150 activos tecnológicos (notebooks, monitores,
 * accesorios), préstamos activos y solicitudes pendientes.
 */
export class InitialSchema1727710000000 implements MigrationInterface {
  name = 'InitialSchema1727710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extensiones necesarias para UUIDs y funciones criptográficas
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 2. Creación de la tabla USUARIOS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "usuarios" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "nombre_completo" VARCHAR(255) NOT NULL,
        "rol" VARCHAR(50) NOT NULL DEFAULT 'colaborador',
        "estado" VARCHAR(50) NOT NULL DEFAULT 'activo',
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_usuarios_email" ON "usuarios"("email");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_usuarios_rol" ON "usuarios"("rol");`,
    );

    // 3. Creación de la tabla CATEGORIAS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categorias" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" VARCHAR(100) NOT NULL UNIQUE,
        "descripcion" VARCHAR(255)
      );
    `);

    // 4. Creación de la tabla EQUIPOS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "equipos" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo_inventario" VARCHAR(100) NOT NULL UNIQUE,
        "categoria_id" UUID NOT NULL REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "marca" VARCHAR(100) NOT NULL,
        "modelo" VARCHAR(100) NOT NULL,
        "numero_serie" VARCHAR(100) NOT NULL UNIQUE,
        "estado" VARCHAR(50) NOT NULL DEFAULT 'disponible',
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_equipos_categoria_id" ON "equipos"("categoria_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_equipos_estado" ON "equipos"("estado");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_equipos_codigo_inventario" ON "equipos"("codigo_inventario");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_equipos_numero_serie" ON "equipos"("numero_serie");`,
    );

    // 5. Creación de la tabla SOLICITUDES_PRESTAMO
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solicitudes_prestamo" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "usuario_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "equipo_id" UUID NOT NULL REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "estado" VARCHAR(50) NOT NULL DEFAULT 'pendiente',
        "motivo" VARCHAR(500) NOT NULL,
        "fecha_solicitud" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "fecha_resolucion" TIMESTAMP WITH TIME ZONE,
        "resuelto_por" UUID REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_solicitudes_usuario_id" ON "solicitudes_prestamo"("usuario_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_solicitudes_equipo_id" ON "solicitudes_prestamo"("equipo_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_solicitudes_resuelto_por" ON "solicitudes_prestamo"("resuelto_por");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_solicitudes_estado" ON "solicitudes_prestamo"("estado");`,
    );

    // 6. Creación de la tabla PRESTAMOS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prestamos" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "solicitud_id" UUID NOT NULL UNIQUE REFERENCES "solicitudes_prestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "usuario_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "equipo_id" UUID NOT NULL REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "encargado_entrega_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "encargado_devolucion_id" UUID REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        "fecha_inicio" TIMESTAMP WITH TIME ZONE NOT NULL,
        "fecha_vencimiento" TIMESTAMP WITH TIME ZONE NOT NULL,
        "renovado" BOOLEAN NOT NULL DEFAULT false,
        "fecha_devolucion" TIMESTAMP WITH TIME ZONE,
        "estado" VARCHAR(50) NOT NULL DEFAULT 'activo',
        "observaciones" TEXT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prestamos_solicitud_id" ON "prestamos"("solicitud_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prestamos_usuario_id" ON "prestamos"("usuario_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prestamos_equipo_id" ON "prestamos"("equipo_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prestamos_encargado_entrega_id" ON "prestamos"("encargado_entrega_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prestamos_encargado_devolucion_id" ON "prestamos"("encargado_devolucion_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prestamos_estado" ON "prestamos"("estado");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prestamos_fecha_vencimiento" ON "prestamos"("fecha_vencimiento");`,
    );

    // 7. Creación de la tabla AUDITORIA (inmutable)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auditoria" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tabla_afectada" VARCHAR(100) NOT NULL,
        "registro_id" UUID NOT NULL,
        "accion" VARCHAR(50) NOT NULL,
        "datos_anteriores" JSONB,
        "datos_nuevos" JSONB,
        "usuario_id" UUID REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        "fecha_evento" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "direccion_ip" VARCHAR(45) NOT NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_auditoria_tabla_registro" ON "auditoria"("tabla_afectada", "registro_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_auditoria_usuario_id" ON "auditoria"("usuario_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_auditoria_fecha_evento" ON "auditoria"("fecha_evento");`,
    );

    // =========================================================================
    // SEED DATA: DATOS INICIALES DEL SISTEMA
    // =========================================================================

    // A. Categorías
    const categoriaNotebookId = 'a0000000-0000-0000-0000-000000000001';
    const categoriaMonitorId = 'a0000000-0000-0000-0000-000000000002';
    const categoriaAccesorioId = 'a0000000-0000-0000-0000-000000000003';

    await queryRunner.query(`
      INSERT INTO "categorias" ("id", "nombre", "descripcion") VALUES
        ('${categoriaNotebookId}', 'Notebook', 'Equipos portátiles para trabajo corporativo'),
        ('${categoriaMonitorId}', 'Monitor', 'Pantallas externas de escritorio'),
        ('${categoriaAccesorioId}', 'Accesorio', 'Teclados, mouse, adaptadores y periféricos')
      ON CONFLICT ("nombre") DO NOTHING;
    `);

    // B. Usuarios de Prueba
    const adminId = 'b0000000-0000-0000-0000-000000000001';
    const soporteId = 'b0000000-0000-0000-0000-000000000002';
    const colaboradorJuanId = 'b0000000-0000-0000-0000-000000000010';
    const colaboradorCarlosId = 'b0000000-0000-0000-0000-000000000011';
    const colaboradorAnaId = 'b0000000-0000-0000-0000-000000000012';

    const usuariosValues: string[] = [
      `('${adminId}', 'admin@api-ux.com', 'Administrador TI', 'administrador_ti', 'activo')`,
      `('${soporteId}', 'soporte@api-ux.com', 'Soporte TI', 'administrador_ti', 'activo')`,
      `('${colaboradorJuanId}', 'colaborador@api-ux.com', 'Juan Pérez', 'colaborador', 'activo')`,
      `('${colaboradorCarlosId}', 'carlos.mendoza@api-ux.com', 'Carlos Mendoza', 'colaborador', 'activo')`,
      `('${colaboradorAnaId}', 'ana.valenzuela@api-ux.com', 'Ana Valenzuela', 'colaborador', 'activo')`,
    ];

    // Colaboradores adicionales para poblar los 42 préstamos activos
    const nombresDemo = [
      'Rodrigo Silva', 'Camila Morales', 'Felipe Castro', 'Daniela Rojas',
      'Matías Herrera', 'Valentina Díaz', 'Sebastián Muñoz', 'Paula Contreras',
      'Gabriel Sepúlveda', 'Francisca Araya', 'Nicolás Fuentes', 'Javiera Espinoza',
      'Gonzalo Parra', 'Carolina Vera', 'Diego Carrasco', 'Constanza Gómez',
      'Ignacio Soto', 'Fernanda Reyes', 'Cristóbal Guzmán', 'Loreto Vidal',
      'Tomás Saavedra', 'Catalina Peña', 'Álvaro Cárdenas', 'Bárbara Miranda',
      'Claudio Orellana', 'Andrea Navarro', 'Vicente Figueroa', 'Patricia Lagos',
      'Manuel Cortés', 'Claudia Bravo', 'Esteban Campos', 'Macarena Vega',
      'Eduardo Molina', 'Paulina Delgado', 'Mauricio Romero', 'Tamara Sandoval',
      'Alejandro Núñez', 'Soledad Guerrero', 'Pablo Medina', 'Victoria Salazar',
      'Joaquín Valdés', 'Beatriz Campos'
    ];

    for (let i = 0; i < nombresDemo.length; i++) {
      const idxStr = String(13 + i).padStart(12, '0');
      const userId = `b0000000-0000-0000-0000-${idxStr}`;
      const nombre = nombresDemo[i];
      const email = `${nombre.toLowerCase().replace(/ /g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@api-ux.com`;
      usuariosValues.push(`('${userId}', '${email}', '${nombre}', 'colaborador', 'activo')`);
    }

    await queryRunner.query(`
      INSERT INTO "usuarios" ("id", "email", "nombre_completo", "rol", "estado")
      VALUES ${usuariosValues.join(',\n')}
      ON CONFLICT ("email") DO NOTHING;
    `);

    // C. 150 Equipos Tecnológicos
    // 75 Notebooks, 45 Monitores, 30 Accesorios = 150 activos exactos
    const equiposValues: string[] = [];

    const notebookModels = [
      { marca: 'Dell', modelo: 'Latitude 5430' },
      { marca: 'Lenovo', modelo: 'ThinkPad T14 Gen 4' },
      { marca: 'Apple', modelo: 'MacBook Pro 14 M2' },
      { marca: 'HP', modelo: 'EliteBook 840 G9' },
      { marca: 'Lenovo', modelo: 'ThinkPad X1 Carbon' },
      { marca: 'Apple', modelo: 'MacBook Air M2' },
      { marca: 'Dell', modelo: 'XPS 15 9520' },
    ];

    const monitorModels = [
      { marca: 'Dell', modelo: 'UltraSharp 27" U2722D' },
      { marca: 'LG', modelo: 'UltraFine 27" 27UN850-W' },
      { marca: 'Samsung', modelo: 'ViewFinity 32" S80PB' },
      { marca: 'HP', modelo: 'E24 G4 FHD' },
      { marca: 'Dell', modelo: 'P2419H 24"' },
    ];

    const accesorioModels = [
      { marca: 'Dell', modelo: 'Thunderbolt Dock WD19TBS' },
      { marca: 'Logitech', modelo: 'Mouse MX Master 3S' },
      { marca: 'Logitech', modelo: 'Teclado MX Keys Advanced' },
      { marca: 'Apple', modelo: 'Magic Keyboard con Touch ID' },
      { marca: 'Anker', modelo: 'Hub USB-C PowerExpand 8-en-1' },
      { marca: 'CalDigit', modelo: 'Thunderbolt 4 Dock TS4' },
    ];

    // Estados para cumplir métricas:
    // Total Activos = 150
    // Préstamos Activos = 42 (25 notebooks, 12 monitores, 5 accesorios)
    // En Mantención = 5 (2 notebooks, 1 monitor, 2 accesorios)
    // Disponibles = 103 (48 notebooks, 32 monitores, 23 accesorios)

    // 1. Notebooks (75 unidades: NB-001 a NB-075)
    for (let i = 1; i <= 75; i++) {
      const idxStr = String(i).padStart(12, '0');
      const id = `c0000000-0000-0000-0000-${idxStr}`;
      const code = `NB-${String(i).padStart(3, '0')}`;
      const model = notebookModels[(i - 1) % notebookModels.length];
      const serie = `SN-NB-${10000 + i}`;
      let estado = 'disponible';
      if (i <= 25) {
        estado = 'prestado';
      } else if (i <= 27) {
        estado = 'en_mantencion';
      }
      equiposValues.push(
        `('${id}', '${code}', '${categoriaNotebookId}', '${model.marca}', '${model.modelo}', '${serie}', '${estado}')`,
      );
    }

    // 2. Monitores (45 unidades: MON-001 a MON-045)
    for (let i = 1; i <= 45; i++) {
      const idxStr = String(i).padStart(12, '0');
      const id = `d0000000-0000-0000-0000-${idxStr}`;
      const code = `MON-${String(i).padStart(3, '0')}`;
      const model = monitorModels[(i - 1) % monitorModels.length];
      const serie = `SN-MON-${20000 + i}`;
      let estado = 'disponible';
      if (i <= 12) {
        estado = 'prestado';
      } else if (i === 13) {
        estado = 'en_mantencion';
      }
      equiposValues.push(
        `('${id}', '${code}', '${categoriaMonitorId}', '${model.marca}', '${model.modelo}', '${serie}', '${estado}')`,
      );
    }

    // 3. Accesorios (30 unidades: ACC-001 a ACC-030)
    for (let i = 1; i <= 30; i++) {
      const idxStr = String(i).padStart(12, '0');
      const id = `e0000000-0000-0000-0000-${idxStr}`;
      const code = `ACC-${String(i).padStart(3, '0')}`;
      const model = accesorioModels[(i - 1) % accesorioModels.length];
      const serie = `SN-ACC-${30000 + i}`;
      let estado = 'disponible';
      if (i <= 5) {
        estado = 'prestado';
      } else if (i <= 7) {
        estado = 'en_mantencion';
      }
      equiposValues.push(
        `('${id}', '${code}', '${categoriaAccesorioId}', '${model.marca}', '${model.modelo}', '${serie}', '${estado}')`,
      );
    }

    await queryRunner.query(`
      INSERT INTO "equipos" ("id", "codigo_inventario", "categoria_id", "marca", "modelo", "numero_serie", "estado")
      VALUES ${equiposValues.join(',\n')}
      ON CONFLICT ("codigo_inventario") DO NOTHING;
    `);

    // D. Solicitudes Aprobadas y Préstamos Activos (42 unidades)
    // 3 de ellos con fecha_vencimiento <= 3 días para cumplir la métrica "Por Vencer (<= 3 días) = 3"
    // Los 42 préstamos corresponden a:
    // - Notebooks 1 a 25 (`c0000000-0000-0000-0000-000000000001` a `0025`)
    // - Monitores 1 a 12 (`d0000000-0000-0000-0000-000000000001` a `0012`)
    // - Accesorios 1 a 5 (`e0000000-0000-0000-0000-000000000001` a `0005`)
    const activeEquipmentIds: string[] = [];
    for (let i = 1; i <= 25; i++) activeEquipmentIds.push(`c0000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
    for (let i = 1; i <= 12; i++) activeEquipmentIds.push(`d0000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
    for (let i = 1; i <= 5; i++) activeEquipmentIds.push(`e0000000-0000-0000-0000-${String(i).padStart(12, '0')}`);

    const solicitudesAprobadasValues: string[] = [];
    const prestamosValues: string[] = [];
    const auditoriaValues: string[] = [];

    // Lista de usuarios colaboradores asignados (comenzando con Juan Pérez en el préstamo 1)
    const assignedUserIds: string[] = [
      colaboradorJuanId,
      colaboradorCarlosId,
      colaboradorAnaId,
    ];
    for (let i = 0; i < nombresDemo.length; i++) {
      assignedUserIds.push(`b0000000-0000-0000-0000-${String(13 + i).padStart(12, '0')}`);
    }

    for (let i = 0; i < 42; i++) {
      const idxStr = String(i + 1).padStart(12, '0');
      const solId = `f0000000-0000-0000-0000-${idxStr}`;
      const prestamoId = `10000000-0000-0000-0000-${idxStr}`;
      const auditId = `20000000-0000-0000-0000-${idxStr}`;
      const eqId = activeEquipmentIds[i];
      const userId = assignedUserIds[i % assignedUserIds.length];

      // Días de vencimiento:
      // Préstamo 1: vence en 2 días (próximo a vencer)
      // Préstamo 2: vence en 1 día (próximo a vencer)
      // Préstamo 3: vence en 3 días (próximo a vencer)
      // Préstamos 4 a 42: vencen en 15 a 30 días
      let diasVencimiento = 20;
      if (i === 0) diasVencimiento = 2;
      else if (i === 1) diasVencimiento = 1;
      else if (i === 2) diasVencimiento = 3;
      else diasVencimiento = 10 + (i % 20);

      solicitudesAprobadasValues.push(`(
        '${solId}',
        '${userId}',
        '${eqId}',
        'aprobada',
        'Asignación para proyecto institucional y desarrollo de software',
        CURRENT_TIMESTAMP - INTERVAL '15 days',
        CURRENT_TIMESTAMP - INTERVAL '14 days',
        '${adminId}'
      )`);

      prestamosValues.push(`(
        '${prestamoId}',
        '${solId}',
        '${userId}',
        '${eqId}',
        '${adminId}',
        NULL,
        CURRENT_TIMESTAMP - INTERVAL '14 days',
        CURRENT_TIMESTAMP + INTERVAL '${diasVencimiento} days',
        false,
        NULL,
        'activo',
        'Entrega física y acta firmada en oficina central Apiux'
      )`);

      auditoriaValues.push(`(
        '${auditId}',
        'prestamos',
        '${prestamoId}',
        'APROBAR_PRESTAMO',
        '{"estado_anterior": "pendiente"}',
        '{"estado_nuevo": "activo", "vencimiento_dias": ${diasVencimiento}}',
        '${adminId}',
        CURRENT_TIMESTAMP - INTERVAL '14 days',
        '192.168.1.100'
      )`);
    }

    await queryRunner.query(`
      INSERT INTO "solicitudes_prestamo" (
        "id", "usuario_id", "equipo_id", "estado", "motivo", "fecha_solicitud", "fecha_resolucion", "resuelto_por"
      ) VALUES ${solicitudesAprobadasValues.join(',\n')}
      ON CONFLICT ("id") DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "prestamos" (
        "id", "solicitud_id", "usuario_id", "equipo_id", "encargado_entrega_id", "encargado_devolucion_id",
        "fecha_inicio", "fecha_vencimiento", "renovado", "fecha_devolucion", "estado", "observaciones"
      ) VALUES ${prestamosValues.join(',\n')}
      ON CONFLICT ("id") DO NOTHING;
    `);

    // E. Solicitudes Pendientes (5 unidades para la métrica "Solicitudes Pendientes = 5")
    // Se solicitan equipos actualmente disponibles
    const pendingEquipments = [
      `c0000000-0000-0000-0000-${String(28).padStart(12, '0')}`, // NB-028
      `d0000000-0000-0000-0000-${String(14).padStart(12, '0')}`, // MON-014
      `e0000000-0000-0000-0000-${String(8).padStart(12, '0')}`,  // ACC-008
      `c0000000-0000-0000-0000-${String(29).padStart(12, '0')}`, // NB-029
      `d0000000-0000-0000-0000-${String(15).padStart(12, '0')}`, // MON-015
    ];

    const motivosPendientes = [
      'Reemplazo temporal por mantenimiento de equipo principal',
      'Proyecto cliente requiere segundo monitor de alta resolución',
      'Dock station para estación de teletrabajo en casa',
      'Notebook para nuevo colaborador en período de inducción técnica',
      'Monitor adicional para análisis de datos y dashboards corporativos',
    ];

    const solicitudesPendientesValues: string[] = [];
    for (let i = 0; i < 5; i++) {
      const idxStr = String(50 + i).padStart(12, '0');
      const solId = `f0000000-0000-0000-0000-${idxStr}`;
      const eqId = pendingEquipments[i];
      const userId = assignedUserIds[10 + i];
      const auditId = `20000000-0000-0000-0000-${idxStr}`;

      solicitudesPendientesValues.push(`(
        '${solId}',
        '${userId}',
        '${eqId}',
        'pendiente',
        '${motivosPendientes[i]}',
        CURRENT_TIMESTAMP - INTERVAL '${i + 1} hours',
        NULL,
        NULL
      )`);

      auditoriaValues.push(`(
        '${auditId}',
        'solicitudes_prestamo',
        '${solId}',
        'CREAR_SOLICITUD',
        NULL,
        '{"estado": "pendiente", "motivo": "${motivosPendientes[i]}"}',
        '${userId}',
        CURRENT_TIMESTAMP - INTERVAL '${i + 1} hours',
        '192.168.1.150'
      )`);
    }

    await queryRunner.query(`
      INSERT INTO "solicitudes_prestamo" (
        "id", "usuario_id", "equipo_id", "estado", "motivo", "fecha_solicitud", "fecha_resolucion", "resuelto_por"
      ) VALUES ${solicitudesPendientesValues.join(',\n')}
      ON CONFLICT ("id") DO NOTHING;
    `);

    // F. Inserción de Registros de Auditoría Inicial
    await queryRunner.query(`
      INSERT INTO "auditoria" (
        "id", "tabla_afectada", "registro_id", "accion", "datos_anteriores", "datos_nuevos", "usuario_id", "fecha_evento", "direccion_ip"
      ) VALUES ${auditoriaValues.join(',\n')}
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auditoria" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prestamos" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "solicitudes_prestamo" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipos" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categorias" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "usuarios" CASCADE;`);
  }
}
