# SPEC.md

## 1. TECHNOLOGY STACK

### Backend Architecture
- **Runtime Environment:** Node.js 20 LTS (Iron)
- **Application Framework:** NestJS 10.x with TypeScript 5.x
- **Persistence Layer & ORM:** TypeORM 0.3.x with native `pg` (PostgreSQL client driver 8.x)
- **Database Engine:** PostgreSQL 15 (Google Cloud SQL for PostgreSQL)
- **Authentication & Security:** 
  - Microsoft Entra ID (Azure Active Directory) via OpenID Connect (OIDC) & OAuth 2.0
  - `@azure/msal-node` 2.x for server-side token validation and MSAL verification
  - `passport` and `passport-azure-ad` / `@nestjs/passport` with Bearer JWT Strategy
  - RBAC (Role-Based Access Control) using NestJS Guards and Custom Decorators (`@Roles('colaborador', 'administrador_ti')`)
- **Data Validation & Serialization:** `class-validator` 0.14.x and `class-transformer` 0.5.x
- **Scheduling & Background Tasks:** `@nestjs/schedule` 4.x (Cron jobs for automated 3-day return expiration alerts)
- **Transactional Email Service:** `@nestjs-modules/mailer` 2.x and `nodemailer` 6.x configured for Google Workspace SMTP or SendGrid API integration
- **Observability:** `prom-client` 15.x with NestJS custom interceptor exposing Prometheus-compatible metrics

### Frontend Architecture
- **Application Framework:** React 18.2.x (Single Page Application - SPA)
- **Language:** TypeScript 5.x
- **Build Tool & Dev Server:** Vite 5.x (`@vitejs/plugin-react`)
- **Authentication Client:** `@azure/msal-browser` 3.x and `@azure/msal-react` 2.x
- **HTTP Client:** `axios` 1.6.x with centralized interceptors for Bearer token injection and error handling
- **Routing:** `react-router-dom` 6.22.x
- **Styling:** Tailwind CSS 3.4.x with custom design tokens mapped in `tailwind.config.js` and `frontend/src/styles/tokens.ts`
- **Iconography:** `lucide-react` 0.344.x

### Infrastructure & Deployment
- **Target Cloud Provider:** Google Cloud Platform (GCP)
- **Compute Platform:** GCP Cloud Run (fully managed serverless containers)
- **Managed Database:** GCP Cloud SQL for PostgreSQL 15 with automated daily snapshots and 7-day retention
- **Containerization:** Multi-stage Docker containers based on `node:20-alpine` (backend) and `nginx:1.25-alpine` (frontend)
- **CI/CD:** GitHub Actions / Google Cloud Build pipeline triggering blue-green or zero-downtime rolling deployments on Cloud Run

---

## 2. DATA CONTRACTS

The database schema matches the authoritative Architect Database Schema Contract verbatim. All entities, fields, relationships, and naming conventions correspond exactly to the specification.

### 2.1 Backend Data Contracts (TypeORM Entities & DTOs)

#### Enum Definitions
```typescript
export enum RolUsuario {
  COLABORADOR = 'colaborador',
  ADMINISTRADOR_TI = 'administrador_ti',
}

export enum EstadoUsuario {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

export enum EstadoEquipo {
  DISPONIBLE = 'disponible',
  PRESTADO = 'prestado',
  EN_MANTENCION = 'en_mantencion',
  DE_BAJA = 'de_baja',
}

export enum EstadoSolicitud {
  PENDIENTE = 'pendiente',
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
}

export enum EstadoPrestamo {
  ACTIVO = 'activo',
  DEVUELTO = 'devuelto',
  VENCIDO = 'vencido',
}
```

#### Entity: USUARIO (`usuarios`)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

@Entity('usuarios')
export class UsuarioEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  nombre_completo: string;

  @Column({ type: 'varchar', length: 50, default: 'colaborador' })
  rol: string;

  @Column({ type: 'varchar', length: 50, default: 'activo' })
  estado: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  creado_en: Date;
}
```

#### Entity: CATEGORIA (`categorias`)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity('categorias')
export class CategoriaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string;
}
```

#### Entity: EQUIPO (`equipos`)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CategoriaEntity } from './categoria.entity';

@Entity('equipos')
export class EquipoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  codigo_inventario: string;

  @Column({ type: 'uuid' })
  categoria_id: string;

  @ManyToOne(() => CategoriaEntity, { eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: CategoriaEntity;

  @Column({ type: 'varchar', length: 100 })
  marca: string;

  @Column({ type: 'varchar', length: 100 })
  modelo: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  numero_serie: string;

  @Column({ type: 'varchar', length: 50, default: 'disponible' })
  estado: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  creado_en: Date;
}
```

#### Entity: SOLICITUD_PRESTAMO (`solicitudes_prestamo`)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UsuarioEntity } from './usuario.entity';
import { EquipoEntity } from './equipo.entity';

@Entity('solicitudes_prestamo')
export class SolicitudPrestamoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  usuario_id: string;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @Column({ type: 'uuid' })
  equipo_id: string;

  @ManyToOne(() => EquipoEntity)
  @JoinColumn({ name: 'equipo_id' })
  equipo: EquipoEntity;

  @Column({ type: 'varchar', length: 50, default: 'pendiente' })
  estado: string;

  @Column({ type: 'varchar', length: 500 })
  motivo: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  fecha_solicitud: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_resolucion: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resuelto_por: string | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'resuelto_por' })
  resolutor: UsuarioEntity | null;
}
```

#### Entity: PRESTAMO (`prestamos`)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { SolicitudPrestamoEntity } from './solicitud_prestamo.entity';
import { UsuarioEntity } from './usuario.entity';
import { EquipoEntity } from './equipo.entity';

@Entity('prestamos')
export class PrestamoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  solicitud_id: string;

  @OneToOne(() => SolicitudPrestamoEntity)
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: SolicitudPrestamoEntity;

  @Column({ type: 'uuid' })
  usuario_id: string;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @Column({ type: 'uuid' })
  equipo_id: string;

  @ManyToOne(() => EquipoEntity)
  @JoinColumn({ name: 'equipo_id' })
  equipo: EquipoEntity;

  @Column({ type: 'uuid' })
  encargado_entrega_id: string;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'encargado_entrega_id' })
  encargado_entrega: UsuarioEntity;

  @Column({ type: 'uuid', nullable: true })
  encargado_devolucion_id: string | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'encargado_devolucion_id' })
  encargado_devolucion: UsuarioEntity | null;

  @Column({ type: 'timestamp with time zone' })
  fecha_inicio: Date;

  @Column({ type: 'timestamp with time zone' })
  fecha_vencimiento: Date;

  @Column({ type: 'boolean', default: false })
  renovado: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_devolucion: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'activo' })
  estado: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;
}
```

#### Entity: AUDITORIA (`auditoria`)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UsuarioEntity } from './usuario.entity';

@Entity('auditoria')
export class AuditoriaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  tabla_afectada: string;

  @Column({ type: 'uuid' })
  registro_id: string;

  @Column({ type: 'varchar', length: 50 })
  accion: string;

  @Column({ type: 'jsonb', nullable: true })
  datos_anteriores: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  datos_nuevos: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  usuario_id: string | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  fecha_evento: Date;

  @Column({ type: 'varchar', length: 45 })
  direccion_ip: string;
}
```

---

### 2.2 Frontend TypeScript Interfaces (`frontend/src/types/index.ts`)

```typescript
export type RolUsuario = 'colaborador' | 'administrador_ti';
export type EstadoUsuario = 'activo' | 'inactivo';
export type EstadoEquipo = 'disponible' | 'prestado' | 'en_mantencion' | 'de_baja';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';
export type EstadoPrestamo = 'activo' | 'devuelto' | 'vencido';

export interface Usuario {
  id: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  creado_en: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Equipo {
  id: string;
  codigo_inventario: string;
  categoria_id: string;
  categoria?: Categoria;
  marca: string;
  modelo: string;
  numero_serie: string;
  estado: EstadoEquipo;
  creado_en: string;
}

export interface SolicitudPrestamo {
  id: string;
  usuario_id: string;
  usuario?: Usuario;
  equipo_id: string;
  equipo?: Equipo;
  estado: EstadoSolicitud;
  motivo: string;
  fecha_solicitud: string;
  fecha_resolucion: string | null;
  resuelto_por: string | null;
  resolutor?: Usuario | null;
}

export interface Prestamo {
  id: string;
  solicitud_id: string;
  solicitud?: SolicitudPrestamo;
  usuario_id: string;
  usuario?: Usuario;
  equipo_id: string;
  equipo?: Equipo;
  encargado_entrega_id: string;
  encargado_entrega?: Usuario;
  encargado_devolucion_id: string | null;
  encargado_devolucion?: Usuario | null;
  fecha_inicio: string;
  fecha_vencimiento: string;
  renovado: boolean;
  fecha_devolucion: string | null;
  estado: EstadoPrestamo;
  observaciones: string | null;
}

export interface Auditoria {
  id: string;
  tabla_afectada: string;
  registro_id: string;
  accion: string;
  datos_anteriores: Record<string, any> | null;
  datos_nuevos: Record<string, any> | null;
  usuario_id: string | null;
  usuario?: Usuario | null;
  fecha_evento: string;
  direccion_ip: string;
}

export interface InventoryMetrics {
  total_activos: number;
  prestamos_activos: number;
  solicitudes_pendientes: number;
  por_vencer: number;
}

export interface CollaboratorQuota {
  prestamos_activos_count: number;
  cupo_maximo: number;
  cupo_restante: number;
  puede_solicitar: boolean;
}

export interface SolicitarPrestamoDto {
  equipo_id: string;
  motivo: string;
  dias_solicitados: number; // 1 to 30 days
}

export interface ResolverSolicitudDto {
  estado: 'aprobada' | 'rechazada';
  observaciones?: string;
  dias_prestamo?: number; // Defaults to 30 days if approved
}

export interface RegistrarDevolucionDto {
  observaciones: string;
  estado_fisico_equipo: 'disponible' | 'en_mantencion' | 'de_baja';
}

export interface RenovarPrestamoDto {
  dias_extension: number; // Up to 30 days, allowed only once
  motivo_renovacion: string;
}
```

---

## 3. API ENDPOINTS

Base URL: `/api/v1`

### 3.1 Authentication & Profile (`/api/v1/auth`)

#### `POST /api/v1/auth/sso-login`
- **Description:** Receives Azure AD JWT token from MSAL frontend flow, validates claims with Microsoft public keys, syncs or provisions `USUARIO` in the database, and returns application session info and user profile.
- **Request Body:**
  ```json
  {
    "id_token": "string (JWT issued by Azure AD)",
    "access_token": "string"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "string (app bearer token)",
    "usuario": {
      "id": "uuid",
      "email": "colaborador@apiux.com",
      "nombre_completo": "Juan Pérez",
      "rol": "colaborador",
      "estado": "activo",
      "creado_en": "2026-09-30T10:00:00Z"
    }
  }
  ```

#### `GET /api/v1/auth/me`
- **Description:** Returns the authenticated user profile along with current quota and role.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "usuario": {
      "id": "uuid",
      "email": "colaborador@apiux.com",
      "nombre_completo": "Juan Pérez",
      "rol": "colaborador",
      "estado": "activo",
      "creado_en": "2026-09-30T10:00:00Z"
    },
    "quota": {
      "prestamos_activos_count": 1,
      "cupo_maximo": 2,
      "cupo_restante": 1,
      "puede_solicitar": true
    }
  }
  ```

---

### 3.2 Equipment & Categories (`/api/v1/equipos`, `/api/v1/categorias`)

#### `GET /api/v1/categorias`
- **Description:** Returns list of equipment categories (Notebook, Monitor, Accesorio).
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "uuid",
      "nombre": "Notebook",
      "descripcion": "Equipos portátiles para trabajo corporativo"
    },
    {
      "id": "uuid",
      "nombre": "Monitor",
      "descripcion": "Pantallas externas de escritorio"
    },
    {
      "id": "uuid",
      "nombre": "Accesorio",
      "descripcion": "Teclados, mouse, adaptadores y periféricos"
    }
  ]
  ```

#### `GET /api/v1/equipos`
- **Description:** Retrieves paginated and filtered list of equipment for catalog and inventory views.
- **Query Params:**
  - `search`: string (matches `codigo_inventario`, `marca`, `modelo`, or `numero_serie`)
  - `categoria_id`: uuid (filter by category)
  - `estado`: string (`disponible`, `prestado`, `en_mantencion`, `de_baja`)
  - `page`: number (default: 1)
  - `limit`: number (default: 50)
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "codigo_inventario": "NB-042",
        "categoria_id": "uuid",
        "categoria": {
          "id": "uuid",
          "nombre": "Notebook",
          "descripcion": "Equipos portátiles para trabajo corporativo"
        },
        "marca": "Dell",
        "modelo": "Latitude 5430",
        "numero_serie": "SN-DELL-98213",
        "estado": "disponible",
        "creado_en": "2026-09-01T10:00:00Z"
      }
    ],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 50,
      "totalPages": 3
    }
  }
  ```

#### `GET /api/v1/equipos/:id`
- **Description:** Retrieves details of a specific piece of equipment.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** `Equipo` object.

#### `POST /api/v1/equipos` (Role: `administrador_ti`)
- **Description:** Adds a new equipment to the 150-asset inventory pool.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "codigo_inventario": "NB-043",
    "categoria_id": "uuid",
    "marca": "Lenovo",
    "modelo": "ThinkPad T14 Gen 4",
    "numero_serie": "SN-LNV-55412"
  }
  ```
- **Response (201 Created):** Created `Equipo` object.

---

### 3.3 Loan Requests (`/api/v1/solicitudes`)

#### `POST /api/v1/solicitudes`
- **Description:** Colaborador creates a new loan request. Validates that user has `< 2` active loans, the equipment is currently `disponible`, and no other pending request exists for this user on the same asset.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "equipo_id": "uuid",
    "motivo": "Reemplazo temporal por mantenimiento de equipo principal",
    "dias_solicitados": 15
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": "uuid",
    "usuario_id": "uuid",
    "equipo_id": "uuid",
    "estado": "pendiente",
    "motivo": "Reemplazo temporal por mantenimiento de equipo principal",
    "fecha_solicitud": "2026-09-30T15:00:00Z",
    "fecha_resolucion": null,
    "resuelto_por": null
  }
  ```

#### `GET /api/v1/solicitudes`
- **Description:** Retrieves loan requests. Colaboradores see only their own requests; `administrador_ti` sees all requests.
- **Query Params:**
  - `estado`: string (`pendiente`, `aprobada`, `rechazada`)
  - `page`: number
  - `limit`: number
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "usuario_id": "uuid",
        "usuario": {
          "id": "uuid",
          "nombre_completo": "Carlos Mendoza",
          "email": "carlos.mendoza@apiux.com"
        },
        "equipo_id": "uuid",
        "equipo": {
          "id": "uuid",
          "codigo_inventario": "MON-012",
          "marca": "LG",
          "modelo": "UltraFine 27\"",
          "numero_serie": "SN-LG-99214"
        },
        "estado": "pendiente",
        "motivo": "Proyecto cliente requiere segundo monitor de alta resolución",
        "fecha_solicitud": "2026-09-30T14:20:00Z",
        "fecha_resolucion": null,
        "resuelto_por": null
      }
    ],
    "meta": { "total": 1, "page": 1, "limit": 20 }
  }
  ```

#### `PATCH /api/v1/solicitudes/:id/resolver` (Role: `administrador_ti`)
- **Description:** Inventory manager approves or rejects a pending request. If approved, automatically sets `EQUIPO.estado = 'prestado'`, creates the official `PRESTAMO` record, registers `encargado_entrega_id`, dispatches confirmation email to the collaborator, and logs full audit trail.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "estado": "aprobada",
    "observaciones": "Aprobado para proyecto Banco Santander",
    "dias_prestamo": 30
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "solicitud": {
      "id": "uuid",
      "estado": "aprobada",
      "fecha_resolucion": "2026-09-30T15:30:00Z",
      "resuelto_por": "uuid"
    },
    "prestamo": {
      "id": "uuid",
      "solicitud_id": "uuid",
      "usuario_id": "uuid",
      "equipo_id": "uuid",
      "encargado_entrega_id": "uuid",
      "encargado_devolucion_id": null,
      "fecha_inicio": "2026-09-30T15:30:00Z",
      "fecha_vencimiento": "2026-10-30T15:30:00Z",
      "renovado": false,
      "fecha_devolucion": null,
      "estado": "activo",
      "observaciones": "Aprobado para proyecto Banco Santander"
    }
  }
  ```

---

### 3.4 Loans & Returns (`/api/v1/prestamos`)

#### `GET /api/v1/prestamos`
- **Description:** Retrieves loans. Colaborador sees personal loans; `administrador_ti` sees all.
- **Query Params:**
  - `estado`: string (`activo`, `devuelto`, `vencido`)
  - `por_vencer`: boolean (true filters loans expiring in <= 3 days)
  - `page`: number
  - `limit`: number
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "solicitud_id": "uuid",
        "usuario_id": "uuid",
        "usuario": {
          "id": "uuid",
          "nombre_completo": "Ana Valenzuela",
          "email": "ana.valenzuela@apiux.com"
        },
        "equipo_id": "uuid",
        "equipo": {
          "id": "uuid",
          "codigo_inventario": "NB-015",
          "marca": "MacBook",
          "modelo": "Pro 14 M2",
          "numero_serie": "SN-APL-88312",
          "estado": "prestado"
        },
        "encargado_entrega_id": "uuid",
        "fecha_inicio": "2026-09-15T09:00:00Z",
        "fecha_vencimiento": "2026-10-15T09:00:00Z",
        "renovado": false,
        "fecha_devolucion": null,
        "estado": "activo",
        "observaciones": "Entrega física realizada en oficina central"
      }
    ],
    "meta": { "total": 1, "page": 1, "limit": 20 }
  }
  ```

#### `POST /api/v1/prestamos/:id/devolucion` (Role: `administrador_ti`)
- **Description:** Registers physical return of an asset. Updates `PRESTAMO` (`fecha_devolucion = now()`, `estado = 'devuelto'`, `encargado_devolucion_id`), updates `EQUIPO.estado = estado_fisico_equipo` (typically `'disponible'`), logs audit event, and sends confirmation notification email.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "observaciones": "Equipo devuelto en óptimas condiciones, formateado y con cargador original.",
    "estado_fisico_equipo": "disponible"
  }
  ```
- **Response (200 OK):** Updated `Prestamo` object.

#### `POST /api/v1/prestamos/:id/renovar`
- **Description:** Requests loan renewal (max 1 renewal per loan, max 30 additional days). Can be triggered by the borrower or admin if `renovado === false` and loan is active.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "dias_extension": 30,
    "motivo_renovacion": "Extensión de sprint de soporte en cliente"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "id": "uuid",
    "fecha_vencimiento": "2026-11-14T09:00:00Z",
    "renovado": true,
    "estado": "activo",
    "observaciones": "Renovación aplicada por 30 días adicionales. Motivo: Extensión de sprint de soporte en cliente"
  }
  ```

---

### 3.5 Inventory Metrics & Admin Dashboard (`/api/v1/metricas`)

#### `GET /api/v1/metricas/resumen` (Role: `administrador_ti`)
- **Description:** Real-time counters for the admin dashboard: total inventory count, active loans, pending approvals, and assets expiring within 3 days.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "total_activos": 150,
    "prestamos_activos": 42,
    "solicitudes_pendientes": 5,
    "por_vencer": 3
  }
  ```

---

### 3.6 Audit Trail (`/api/v1/auditoria`)

#### `GET /api/v1/auditoria` (Role: `administrador_ti`)
- **Description:** Queries the immutable 5-year audit trail.
- **Query Params:**
  - `tabla_afectada`: string (`equipos`, `solicitudes_prestamo`, `prestamos`, `usuarios`)
  - `registro_id`: uuid
  - `fecha_desde`: ISO date
  - `fecha_hasta`: ISO date
  - `page`: number
  - `limit`: number
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "tabla_afectada": "prestamos",
        "registro_id": "uuid",
        "accion": "REGISTRAR_DEVOLUCION",
        "datos_anteriores": { "estado": "activo", "fecha_devolucion": null },
        "datos_nuevos": { "estado": "devuelto", "fecha_devolucion": "2026-09-30T16:00:00Z" },
        "usuario_id": "uuid",
        "usuario": {
          "id": "uuid",
          "nombre_completo": "Encargado TI",
          "email": "soporte@apiux.com"
        },
        "fecha_evento": "2026-09-30T16:00:00Z",
        "direccion_ip": "190.160.10.22"
      }
    ],
    "meta": { "total": 1, "page": 1, "limit": 20 }
  }
  ```

---

### 3.7 Observability & System Health

#### `GET /health`
- **Description:** Liveness and readiness probe for Cloud Run healthchecks and GCP load balancers. Checks PostgreSQL connection.
- **Response (200 OK):**
  ```json
  {
    "status": "ok",
    "info": {
      "database": { "status": "up" },
      "uptime_seconds": 84210
    }
  }
  ```

#### `GET /metrics`
- **Description:** Exposes standard Prometheus metrics (HTTP request duration, memory usage, loan status counters).
- **Response (200 OK):** Plaintext metrics representation.

---

## 4. FILE STRUCTURE

```
apiux-prestamos/
├── .env.example                                      # Environment variables template
├── .gitignore                                         # Git ignore patterns
├── README.md                                          # System setup and operational documentation
├── docker-compose.yml                                 # Local multi-container development environment
├── backend/
│   ├── Dockerfile                                     # Production multi-stage Docker build for NestJS
│   ├── package.json                                   # Backend dependencies and scripts
│   ├── tsconfig.json                                  # Backend TypeScript configuration
│   ├── nest-cli.json                                  # NestJS CLI configuration
│   └── src/
│       ├── main.ts                                    # Application bootstrap, Swagger, global validation & interceptors
│       ├── app.module.ts                              # Root module aggregating domain modules
│       ├── database/
│       │   ├── database.module.ts                     # TypeORM database configuration module
│       │   ├── data-source.ts                         # TypeORM DataSource for migrations
│       │   ├── entities/
│       │   │   ├── index.ts                           # Entity barrel exports
│       │   │   ├── usuario.entity.ts                  # USUARIO table entity
│       │   │   ├── categoria.entity.ts                # CATEGORIA table entity
│       │   │   ├── equipo.entity.ts                   # EQUIPO table entity
│       │   │   ├── solicitud_prestamo.entity.ts       # SOLICITUD_PRESTAMO table entity
│       │   │   ├── prestamo.entity.ts                 # PRESTAMO table entity
│       │   │   └── auditoria.entity.ts                # AUDITORIA table entity
│       │   └── migrations/
│       │       └── 1727710000000-InitialSchema.ts     # Initial migration script matching ERD contract
│       ├── common/
│       │   ├── decorators/
│       │   │   ├── roles.decorator.ts                 # @Roles('colaborador', 'administrador_ti') decorator
│       │   │   └── current-user.decorator.ts          # @CurrentUser() parameter decorator
│       │   ├── guards/
│       │   │   ├── azure-auth.guard.ts                # Bearer JWT auth guard
│       │   │   └── roles.guard.ts                     # Role-based access control guard
│       │   ├── interceptors/
│       │   │   ├── audit.interceptor.ts               # Automatic mutation audit logging interceptor
│       │   │   └── metrics.interceptor.ts             # Prometheus execution metrics collector
│       │   └── filters/
│       │       └── http-exception.filter.ts           # Centralized exception logging and RFC 7807 response formatting
│       ├── modules/
│       │   ├── auth/
│       │   │   ├── auth.module.ts                     # MSAL / Azure AD authentication module
│       │   │   ├── auth.controller.ts                 # SSO login and /me endpoints
│       │   │   ├── auth.service.ts                    # Azure AD JWT validation and user sync service
│       │   │   ├── jwt.strategy.ts                    # Passport JWT passport validation strategy
│       │   │   └── dto/
│       │   │       └── sso-login.dto.ts               # SSO token payload validation DTO
│       │   ├── equipos/
│       │   │   ├── equipos.module.ts                  # Inventory module
│       │   │   ├── equipos.controller.ts              # Equipment and Category endpoints
│       │   │   ├── equipos.service.ts                 # Inventory filtering, availability checks and state transitions
│       │   │   └── dto/
│       │   │       ├── create-equipo.dto.ts           # New equipment payload DTO
│       │   │       └── filter-equipo.dto.ts           # Equipment filter query parameters DTO
│       │   ├── solicitudes/
│       │   │   ├── solicitudes.module.ts              # Loan request module
│       │   │   ├── solicitudes.controller.ts          # Request submission and resolution endpoints
│       │   │   ├── solicitudes.service.ts             # Request business rules (max 2 loans, stock checks)
│       │   │   └── dto/
│       │   │       ├── create-solicitud.dto.ts        # Colaborador loan request DTO
│       │   │       └── resolver-solicitud.dto.ts      # Admin approval/rejection DTO
│       │   ├── prestamos/
│       │   │   ├── prestamos.module.ts                # Active loans and return workflow module
│       │   │   ├── prestamos.controller.ts            # Loans, returns, and renewal endpoints
│       │   │   ├── prestamos.service.ts               # Return processing, renewal limit rules (1 renewal, 30 days)
│       │   │   └── dto/
│       │   │       ├── registrar-devolucion.dto.ts    # Physical return registration DTO
│       │   │       └── renovar-prestamo.dto.ts        # Loan renewal payload DTO
│       │   ├── auditoria/
│       │   │   ├── auditoria.module.ts                # Immutable audit log module
│       │   │   ├── auditoria.controller.ts            # Audit query endpoints
│       │   │   └── auditoria.service.ts               # Immutable log recording and querying service
│       │   ├── notificaciones/
│       │   │   ├── notificaciones.module.ts           # Email dispatch module
│       │   │   ├── notificaciones.service.ts          # Mailer service for approvals and returns
│       │   │   └── cron-alertas.service.ts            # Cron worker running daily for 3-day expiration alerts
│       │   └── metricas/
│       │       ├── metricas.module.ts                 # Admin summary metrics and Prometheus collector
│       │       ├── metricas.controller.ts             # Dashboard counters and /metrics endpoints
│       │       └── metricas.service.ts                # Aggregate SQL queries for dashboard counters
│       └── config/
│           └── configuration.ts                       # Typed environment configuration loader
└── frontend/
    ├── Dockerfile                                     # Multi-stage production Nginx container build
    ├── nginx.conf                                     # Nginx SPA reverse proxy routing to index.html
    ├── package.json                                   # Frontend dependencies and build scripts
    ├── tsconfig.json                                  # Frontend TypeScript configuration
    ├── vite.config.ts                                 # Vite bundling, aliases, and dev-server configuration
    ├── tailwind.config.js                             # Tailwind CSS configuration embedding design tokens
    ├── postcss.config.js                              # PostCSS plugins
    ├── index.html                                     # HTML entry point with Inter font declaration
    └── src/
        ├── main.tsx                                   # React DOM root entry point mounting App
        ├── App.tsx                                    # App provider wrappers (MSAL, Auth, Router)
        ├── styles/
        │   ├── index.css                              # Tailwind base, components, and utilities
        │   └── tokens.ts                              # Design system tokens (colors, typography, spacing)
        ├── types/
        │   └── index.ts                               # TypeScript domain contracts mirroring backend schema
        ├── config/
        │   ├── authConfig.ts                          # MSAL configuration (client ID, tenant ID, scopes)
        │   └── api.ts                                 # Axios instance configured with interceptors
        ├── context/
        │   └── AuthContext.tsx                        # Global authentication and user role context provider
        ├── hooks/
        │   ├── useAuth.ts                             # Hook consuming AuthContext
        │   ├── useCatalog.ts                          # Hook managing equipment search, filters, and selection
        │   ├── useLoans.ts                            # Hook managing requests, returns, and approvals
        │   └── useMetrics.ts                          # Hook fetching dashboard inventory counters
        ├── components/
        │   ├── ui/
        │   │   ├── AppNavbar.tsx                      # Persistent top corporate navigation bar
        │   │   ├── Button.tsx                         # Reusable button component
        │   │   ├── Modal.tsx                          # Reusable accessible dialog modal
        │   │   ├── Badge.tsx                          # Status badges for equipment and loan states
        │   │   └── Table.tsx                          # Accessible corporate data table component
        │   └── common/
        │       └── ProtectedRoute.tsx                 # Role-based route authorization wrapper
        └── pages/
            ├── 01_Login_SSO.tsx                       # Azure AD SSO login view
            ├── 02_Catalogo_Equipos.tsx                # Colaborador catalog, quota metrics, and request modal
            └── 03_Panel_Encargado.tsx                 # Inventory manager console, tabs, approvals, returns
```

### Port Table
| Service | Listening Port (Host) | Internal Port (Container) | Path |
|---|---|---|---|
| PostgreSQL (Cloud SQL local proxy/dev) | 25432 | 5432 | `postgres` |
| backend (NestJS API) | 23000 | 3000 | `backend/` |
| frontend (React SPA / Nginx) | 23080 | 80 (prod) / 5173 (dev) | `frontend/` |

---

## 5. ENVIRONMENT VARIABLES

### 5.1 Backend Environment Variables (`backend/.env`)

| Variable Name | Type | Description | Example Value |
|---|---|---|---|
| `PORT` | number | Internal listening port for NestJS HTTP server | `3000` |
| `NODE_ENV` | string | Application runtime mode (`development`, `production`) | `production` |
| `DATABASE_HOST` | string | PostgreSQL host (Cloud SQL IP or proxy socket) | `127.0.0.1` |
| `DATABASE_PORT` | number | PostgreSQL listening port | `5432` |
| `DATABASE_USER` | string | PostgreSQL database user | `apiux_admin` |
| `DATABASE_PASSWORD` | string | PostgreSQL password | `SuperSecr3tP@ssw0rd!` |
| `DATABASE_NAME` | string | Database catalog name | `apiux_prestamos` |
| `DATABASE_SSL` | boolean | Enforce SSL for Cloud SQL connection | `true` |
| `AZURE_TENANT_ID` | string | Microsoft Entra ID Directory (Tenant) ID | `a8947e4b-76b3-469b-871d-5582bf4ad391` |
| `AZURE_CLIENT_ID` | string | Microsoft Entra ID Application (Client) ID | `3f87b8f9-906d-495c-9db6-7cbdfa024cb5` |
| `AZURE_CLIENT_SECRET` | string | Client secret for confidential backend validation | `abc~1234567890_DummyClientSecretValue` |
| `JWT_SECRET` | string | Secret key for signing internal API access tokens | `Kz81mK!p98Z2#e9X1v82N!w4Q71Lp0x9` |
| `JWT_EXPIRES_IN` | string | Internal token validity period | `8h` |
| `SMTP_HOST` | string | Hostname for outgoing mail server | `smtp.gmail.com` |
| `SMTP_PORT` | number | Port for outgoing mail server | `587` |
| `SMTP_SECURE` | boolean | Use TLS for mail transmission | `false` |
| `SMTP_USER` | string | Corporate service account email for notifications | `notificaciones-ti@apiux.com` |
| `SMTP_PASSWORD` | string | App password or SMTP credential | `app_password_token_here` |
| `SMTP_FROM` | string | Sender address displayed in outgoing emails | `"Apiux TI Préstamos" <notificaciones-ti@apiux.com>` |
| `CORS_ORIGIN` | string | Allowed frontend origin for CORS headers | `http://localhost:23080,https://prestamos.apiux.com` |

### 5.2 Frontend Environment Variables (`frontend/.env`)

| Variable Name | Type | Description | Example Value |
|---|---|---|---|
| `VITE_API_BASE_URL` | string | Base URL of backend REST API | `http://localhost:23000/api/v1` |
| `VITE_AZURE_TENANT_ID` | string | Microsoft Entra ID Directory (Tenant) ID | `a8947e4b-76b3-469b-871d-5582bf4ad391` |
| `VITE_AZURE_CLIENT_ID` | string | Microsoft Entra ID Application (Client) ID | `3f87b8f9-906d-495c-9db6-7cbdfa024cb5` |
| `VITE_AZURE_REDIRECT_URI` | string | Redirect URI registered in Azure AD app registration | `http://localhost:23080` |

---

## 6. IMPORT CONTRACTS

### 6.1 Backend Core Modules & Entities

```typescript
// Entities
import { UsuarioEntity } from '../database/entities/usuario.entity';
import { CategoriaEntity } from '../database/entities/categoria.entity';
import { EquipoEntity } from '../database/entities/equipo.entity';
import { SolicitudPrestamoEntity } from '../database/entities/solicitud_prestamo.entity';
import { PrestamoEntity } from '../database/entities/prestamo.entity';
import { AuditoriaEntity } from '../database/entities/auditoria.entity';

// Decorators & Guards
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AzureAuthGuard } from '../common/guards/azure-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// Services
import { AuditoriaService } from '../modules/auditoria/auditoria.service';
import { NotificacionesService } from '../modules/notificaciones/notificaciones.service';
import { MetricasService } from '../modules/metricas/metricas.service';
```

### 6.2 Frontend Foundations

```typescript
// Design Tokens
import { tokens } from '../styles/tokens';

// Types
import { 
  Usuario, 
  Equipo, 
  Categoria, 
  SolicitudPrestamo, 
  Prestamo, 
  Auditoria, 
  InventoryMetrics, 
  CollaboratorQuota,
  SolicitarPrestamoDto,
  RegistrarDevolucionDto 
} from '../types';

// API Client
import { apiClient } from '../config/api';

// UI Components
import { AppNavbar } from '../components/ui/AppNavbar';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';

// Context & Hooks
import { AuthContext, useAuth } from '../context/AuthContext';
import { useCatalog } from '../hooks/useCatalog';
import { useLoans } from '../hooks/useLoans';
import { useMetrics } from '../hooks/useMetrics';
```

---

## 7. FRONTEND STATE & COMPONENT CONTRACTS

### 7.1 Shared State Hooks

#### `useAuth()`
Exports user authentication status, current profile, role helpers, and SSO sign-in/out methods:
```typescript
interface UseAuthReturn {
  usuario: Usuario | null;
  quota: CollaboratorQuota | null;
  loading: boolean;
  error: string | null;
  loginWithAzureSSO: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}
export function useAuth(): UseAuthReturn;
```

#### `useCatalog()`
Manages equipment browsing, search query debounce, category tab selection, and quota validation:
```typescript
interface UseCatalogReturn {
  equipos: Equipo[];
  categorias: Categoria[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null; // category id or null for all
  searchTerm: string;
  statusFilter: string;
  setSelectedCategory: (catId: string | null) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  fetchCatalog: () => Promise<void>;
  submitSolicitud: (dto: SolicitarPrestamoDto) => Promise<void>;
  requesting: boolean;
}
export function useCatalog(): UseCatalogReturn;
```

#### `useLoans()`
Manages active loans, pending approvals, and return workflows:
```typescript
interface UseLoansReturn {
  solicitudesPendientes: SolicitudPrestamo[];
  prestamosActivos: Prestamo[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  fetchDashboardData: () => Promise<void>;
  aprobarSolicitud: (solicitudId: string, diasPrestamo: number, observaciones?: string) => Promise<void>;
  rechazarSolicitud: (solicitudId: string, motivo: string) => Promise<void>;
  registrarDevolucion: (prestamoId: string, dto: RegistrarDevolucionDto) => Promise<void>;
  renovarPrestamo: (prestamoId: string, diasExtension: number, motivo: string) => Promise<void>;
}
export function useLoans(): UseLoansReturn;
```

#### `useMetrics()`
Fetches dashboard metrics for the inventory manager:
```typescript
interface UseMetricsReturn {
  metrics: InventoryMetrics | null;
  loading: boolean;
  error: string | null;
  refetchMetrics: () => Promise<void>;
}
export function useMetrics(): UseMetricsReturn;
```

---

### 7.2 UI Base Component Props Interfaces

#### `AppNavbar` Props Contract (`frontend/src/components/ui/AppNavbar.tsx`)
```typescript
export interface AppNavbarProps {
  usuario: Usuario | null;
  activePath: string;
  onLogout: () => void;
}
```

#### `Button` Props Contract (`frontend/src/components/ui/Button.tsx`)
```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}
```

#### `Modal` Props Contract (`frontend/src/components/ui/Modal.tsx`)
```typescript
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}
```

#### `Badge` Props Contract (`frontend/src/components/ui/Badge.tsx`)
```typescript
export interface BadgeProps {
  variant: 'disponible' | 'prestado' | 'en_mantencion' | 'de_baja' | 'pendiente' | 'aprobada' | 'rechazada' | 'vencido';
  label?: string;
  size?: 'sm' | 'md';
}
```

#### `Table` Props Contract (`frontend/src/components/ui/Table.tsx`)
```typescript
export interface ColumnDefinition<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  width?: string;
}

export interface TableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
}
```

---

## 8. FILE EXTENSION CONVENTION

- **Frontend Code:** Pure TypeScript and React TypeScript. All React components and pages use `.tsx`. All non-component utility, context, token, and contract files use `.ts`. JavaScript (`.js` or `.jsx`) is forbidden in `frontend/src/`.
- **Backend Code:** Pure TypeScript (`.ts`) throughout all modules, services, controllers, and entities.
- **Entry Point:**
  - Frontend SPA Entry Point in HTML: `/src/main.tsx` (`<script type="module" src="/src/main.tsx"></script>`)
  - Backend NestJS Entry Point: `backend/src/main.ts`

---

## 9. DESIGN TOKENS

The design tokens are extracted verbatim from the UI/UX Design Implementation Contract. They must be placed in `frontend/src/styles/tokens.ts` and referenced directly by components and the Tailwind configuration.

```typescript
export const tokens = {
  colors: {
    primary: '#0B2F6B',       // Hero Visual corporativo & buttons
    primaryHover: '#082352',
    navDark: '#0E2045',       // Colaborador navbar fill
    navAdmin: '#0E295C',      // Panel Encargado navbar fill
    cardHeader: '#102A56',    // Brand title text
    textPrimary: '#102A56',   // High-contrast primary corporate navy
    textSecondary: '#58708F', // Subtitle text
    textMuted: '#6A7F99',     // Eyebrow and metadata text
    background: '#F4F7FB',   // Login background
    bgCatalog: '#F6F9FC',     // Catalog background
    bgAdmin: '#F5F7FC',       // Admin panel background
    surfaceWhite: '#FFFFFF',  // Cards, tables, modals
    accentLight: '#E8F2FF',   // Loan confirmation banner
    accentLightAdmin: '#EDF5FF', // Admin return confirmation modal
    borderLight: '#E2E8F0',
    borderFocus: '#2563EB',
    status: {
      disponible: {
        bg: '#ECFDF5',
        text: '#065F46',
        border: '#A7F3D0',
        dot: '#10B981',
      },
      prestado: {
        bg: '#FEF3C7',
        text: '#92400E',
        border: '#FDE68A',
        dot: '#F59E0B',
      },
      pendiente: {
        bg: '#EFF6FF',
        text: '#1E40AF',
        border: '#BFDBFE',
        dot: '#3B82F6',
      },
      vencido: {
        bg: '#FEE2E2',
        text: '#991B1B',
        border: '#FECACA',
        dot: '#EF4444',
      },
      mantenimiento: {
        bg: '#F3F4F6',
        text: '#374151',
        border: '#E5E7EB',
        dot: '#6B7280',
      },
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.625,
    },
  },
  spacing: {
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
  },
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    card: '0 1px 3px 0 rgba(16, 42, 86, 0.08), 0 1px 2px 0 rgba(16, 42, 86, 0.04)',
    dropdown: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    modal: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
} as const;
```

---

## 10. FUNCTIONAL REQUIREMENTS COVERAGE

| Functional Requirement | Implementation Architecture & Business Rules | Files Satisfying Requirement |
|---|---|---|
| **Microsoft Azure AD SSO Login** | `@azure/msal-browser` handles OAuth2/OIDC popup or redirect on client; backend validates claims via `@azure/msal-node`, extracts UPN/email, synchronizes `USUARIO` entity, assigns role based on Azure AD groups or email list. | `frontend/src/pages/01_Login_SSO.tsx`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/jwt.strategy.ts` |
| **Catalog Exploration (150 assets)** | Paginated and indexed queries on `EQUIPO` joining `CATEGORIA`. Filters by Category (Notebook, Monitor, Accesorio), Search (serial, code, brand, model), and Status. | `frontend/src/pages/02_Catalogo_Equipos.tsx`, `backend/src/modules/equipos/equipos.controller.ts`, `backend/src/modules/equipos/equipos.service.ts` |
| **Quota Control (Max 2 items)** | Pre-request validation checking active loans count (`COUNT(prestamos.id) WHERE usuario_id = :uid AND estado = 'activo'`). If count >= 2, blocks request button and raises HTTP 400 Conflict. | `backend/src/modules/solicitudes/solicitudes.service.ts`, `frontend/src/pages/02_Catalogo_Equipos.tsx`, `frontend/src/hooks/useCatalog.ts` |
| **Loan Period (Max 30 Days)** | Term selector in modal allows between 1 and 30 days. Backend sets `fecha_vencimiento = NOW() + INTERVAL '30 days'` by default or validated input. | `frontend/src/pages/02_Catalogo_Equipos.tsx`, `backend/src/modules/solicitudes/solicitudes.service.ts` |
| **Loan Renewal (Max 1 time)** | Endpoint `/api/v1/prestamos/:id/renovar` checks `renovado === false`. If false, updates `renovado = true`, sets new `fecha_vencimiento = fecha_vencimiento + 30 days`, logs audit entry. | `backend/src/modules/prestamos/prestamos.service.ts`, `frontend/src/pages/03_Panel_Encargado.tsx` |
| **Mandatory Manager Approval** | Colaborador creates request with `estado = 'pendiente'`. Physical loan is NOT active until Encargado TI hits "Aprobar", creating `PRESTAMO` and changing `EQUIPO.estado` to `'prestado'`. | `frontend/src/pages/03_Panel_Encargado.tsx`, `backend/src/modules/solicitudes/solicitudes.controller.ts`, `backend/src/modules/solicitudes/solicitudes.service.ts` |
| **Physical Return Registration** | Manager console tab "Préstamos Activos" features action "Registrar Devolución". Opens confirmation modal to select returned condition (`disponible`, `en_mantencion`), updates loan `estado = 'devuelto'`. | `frontend/src/pages/03_Panel_Encargado.tsx`, `backend/src/modules/prestamos/prestamos.controller.ts`, `backend/src/modules/prestamos/prestamos.service.ts` |
| **5-Year Immutable Audit Trail** | Interceptor captures every mutation on `solicitudes_prestamo`, `prestamos`, and `equipos`. Stores `tabla_afectada`, `registro_id`, `accion`, before/after JSONB snapshots, acting user ID, and client IP. Database grants insert/select only to prevent tampering. | `backend/src/common/interceptors/audit.interceptor.ts`, `backend/src/database/entities/auditoria.entity.ts`, `backend/src/modules/auditoria/auditoria.service.ts` |
| **Email Notifications & 3-Day Alerts** | Task scheduler (`@nestjs/schedule`) executes daily cron job scanning active loans where `fecha_vencimiento BETWEEN NOW() AND NOW() + INTERVAL '3 days'`. Dispatches reminder email via `Nodemailer`. | `backend/src/modules/notificaciones/cron-alertas.service.ts`, `backend/src/modules/notificaciones/notificaciones.service.ts` |
| **Role-Based Access Control (RBAC)** | Role guard verifies `USUARIO.rol` (`colaborador` vs `administrador_ti`). Colaboradores cannot access approval or audit endpoints; UI hides Admin tab and redirects non-authorized routes. | `backend/src/common/guards/roles.guard.ts`, `backend/src/common/decorators/roles.decorator.ts`, `frontend/src/components/common/ProtectedRoute.tsx` |
| **System Observability & Health** | Exposes `/health` for Cloud Run readiness and liveness container probes. Exposes `/metrics` with request counts and latencies for Prometheus / Cloud Monitoring. | `backend/src/modules/metricas/metricas.controller.ts`, `backend/src/common/interceptors/metrics.interceptor.ts` |
| **GCP Cloud Run Ready Docker Container** | Multi-stage Dockerfiles compiling TypeScript to optimized JS, using non-root execution users, lightweight Alpine base, and environment variable configuration for Cloud SQL and secret keys. | `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml` |

---

## 11. DETAILED SCREEN BEHAVIOR & USER FLOWS

### 11.1 Screen 01: `01_Login_SSO` (`frontend/src/pages/01_Login_SSO.tsx`)
- **Visual Design Compliance:**
  - Background fill: `#F4F7FB`
  - Top Hero corporate banner: fill `#0B2F6B`, height 108px, containing Apiux brand mark, subtitle, and an ISO 27001/SSO security compliance badge.
  - Central Card: 480px width, surface `#FFFFFF`, rounded `lg`, subtle shadow. Contains:
    - Apiux icon badge and header "Gestión de Préstamos de Equipos".
    - Informational copy: "Accede con tu cuenta institucional de Microsoft (@apiux.com) para solicitar notebooks, monitores y accesorios."
    - Microsoft SSO Button: Styled according to Microsoft Brand Guidelines with Microsoft 4-square logo, executing `msalInstance.loginPopup()` or `loginRedirect()`.
    - Loading spinner with "Autenticando con Microsoft Entra ID..." during active SSO token handshake.
  - Policy Footer: 75px height, surface `#FFFFFF`, text `#6A7F99`, stating Apiux internal equipment use policies and 5-year audit compliance notice.
- **Workflow:**
  1. User arrives at root `/`. If authenticated, automatically redirects to `/catalogo` (if `colaborador`) or `/panel-encargado` (if `administrador_ti`).
  2. Clicking "Iniciar Sesión con Microsoft" opens Azure AD popup.
  3. On token reception, sends JWT to `POST /api/v1/auth/sso-login`.
  4. Backend verifies signature, ensures user exists in PostgreSQL `usuarios` table, returns session token and role.
  5. User is redirected to their designated landing page.

### 11.2 Screen 02: `02_Catalogo_Equipos` (`frontend/src/pages/02_Catalogo_Equipos.tsx`)
- **Visual Design Compliance:**
  - Background fill: `#F6F9FC`.
  - Top Global Navigation (`AppNavbar`): fill `#0E2045`, height 76px, display Apiux brand, "Catálogo", "Mis Préstamos", user full name, active role badge ("Colaborador"), and "Cerrar Sesión".
  - Header & Quick Metrics: height 241px:
    - Title: "Catálogo de Equipos TI", text `#102A56`.
    - Subtitle: "Consulta disponibilidad y solicita equipos para tus proyectos en Apiux", text `#58708F`.
    - Metric Cards: 
      - Card 1: "Mis Préstamos Activos" (e.g. "1 de 2 equipos").
      - Card 2: "Cupo Restante" (e.g. "1 equipo disponible para solicitar").
      - Card 3: "Días Máximos por Préstamo" ("30 días corridos").
  - Search & Category Filter Bar: height 88px, surface `#FFFFFF`, border `#E2E8F0`:
    - Search input field: Debounced text input searching by brand, model, or serial number.
    - Category pill buttons: "Todos", "Notebooks", "Monitores", "Accesorios".
    - Status dropdown: "Todos", "Solo disponibles".
  - Equipment Grid / Rows:
    - Cards displaying: Category badge, brand and model in bold `#102A56`, inventory code (e.g. `NB-042`), serial number, and a live status indicator (green badge "Disponible" or yellow badge "Prestado").
    - Action CTA button: "Solicitar Préstamo" (active if `estado === 'disponible'` and collaborator quota has not been exceeded; disabled with explanatory tooltip if user has 2 active loans).
  - Loan Request Modal ("Loan Confirmation Panel"):
    - Background overlay `#00000080`, modal surface `#FFFFFF` with confirmation header in `#E8F2FF`.
    - Equipment summary (Code, Brand, Model, Serial).
    - Motive text area (required, e.g. "Motivo de la solicitud o proyecto").
    - Term selector dropdown (Options: 7 días, 15 días, 30 días).
    - Acceptance checkbox of equipment custody responsibility.
    - Actions: "Cancelar" and "Confirmar Solicitud". On confirmation, calls `POST /api/v1/solicitudes`, displays success notification, decrements local quota, and switches status to "Pendiente de Aprobación".

### 11.3 Screen 03: `03_Panel_Encargado` (`frontend/src/pages/03_Panel_Encargado.tsx`)
- **Visual Design Compliance:**
  - Background fill: `#F5F7FC`.
  - Persistent Top Global Navigation (`AppNavbar`): fill `#0E295C`, height 76px, showing Apiux mark, "Panel Encargado TI", "Inventario", "Auditoría", user pill with badge "Administrador TI".
  - Header: height 132px, eyebrow "Consola de Administración de Inventario TI", Title "Control de Préstamos y Devoluciones", Subtitle "Gestión de aprobaciones, entrega física y recepción de activos tecnológicos".
  - Key Inventory Metrics Row (4 cards):
    - "Total Activos TI": `150` (notebooks, monitores, periféricos registrados).
    - "Préstamos Activos": `42` (equipos actualmente en poder de colaboradores).
    - "Solicitudes Pendientes": `5` (requieren aprobación del encargado).
    - "Por Vencer (<= 3 días)": `3` (préstamos próximos a caducar con alerta enviada).
  - Work Tabs: Surface `#FFFFFF`, height 66px:
    - Tab 1: "Solicitudes Pendientes" (with unread badge counter).
    - Tab 2: "Préstamos Activos y Devoluciones".
  - Tab 1 Content (Pending Approvals Table):
    - Columns: Fecha Solicitud, Colaborador (Nombre + Email), Equipo Solicitado (Código + Modelo), Motivo, Acciones.
    - Actions: 
      - Button "Aprobar" (opens confirmation modal, sets loan duration, records `encargado_entrega_id`, changes device to `prestado`, creates active loan).
      - Button "Rechazar" (prompts for rejection reason, updates request status to `rechazada`, frees up equipment).
  - Tab 2 Content (Active Loans Table):
    - Columns: Código Equipo, Tipo/Modelo, Colaborador, Fecha Entrega, Fecha Vencimiento, Estado (Verde: Al día, Rojo: Vencido), Renovado (Sí/No), Acciones.
    - Actions:
      - Button "Registrar Devolución" (opens Return Modal).
      - Button "Renovar Préstamo" (enabled only if `renovado === false`, extends loan by 30 days).
  - Return Confirmation Modal (`ReturnConfirmation`):
    - Surface `#EDF5FF` header with `#FFFFFF` body.
    - Prompts manager to record physical equipment check:
      - Radio selector for returned condition: "Disponible para préstamo inmediato" (`disponible`) or "Requiere Mantenimiento / Reparación" (`en_mantencion`).
      - Observaciones text area: "Detalle de recepción física, cargador, accesorios y estado del chasis".
      - CTA: "Confirmar Devolución y Liberar Activo". Calls `POST /api/v1/prestamos/:id/devolucion`, records `encargado_devolucion_id`, updates equipment inventory state, and triggers immutable audit entry.

---

## 12. IMMUTABLE AUDIT TRAIL & COMPLIANCE SPECIFICATION

To guarantee compliance with internal security standards and the 5-year retention requirement:
1. **Trigger / Interceptor:** A NestJS global interceptor (`AuditInterceptor`) intercepts all successful `POST`, `PUT`, `PATCH`, and `DELETE` requests in the `solicitudes`, `prestamos`, and `equipos` modules.
2. **Recorded Snapshot:** Captures pre-mutation entity state from the database and post-mutation state.
3. **Database Constraints:** 
   - Table `auditoria` does not contain `UPDATE` or `DELETE` grants for standard application connections; only `INSERT` and `SELECT` are granted to the application user `apiux_admin`.
   - Records store acting `usuario_id`, client IP address (`x-forwarded-for` or socket address), action descriptor (e.g. `CREAR_SOLICITUD`, `APROBAR_PRESTAMO`, `REGISTRAR_DEVOLUCION`, `RENOVAR_PRESTAMO`), and timestamp.
4. **Historical Immutability:** Any attempt to alter historical records will fail database constraint checks, assuring verifiable audit history for corporate governance.