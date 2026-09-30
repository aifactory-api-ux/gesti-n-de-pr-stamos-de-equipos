# DEVELOPMENT PLAN: Sistema de Gestión de Préstamos de Equipos TI

## 1. ARCHITECTURE OVERVIEW

El sistema de gestión de préstamos de equipos para Apiux es una solución full-stack empresarial diseñada para administrar el ciclo de vida de 150 activos tecnológicos (notebooks, monitores y accesorios) entre 300 colaboradores, garantizando control de cupos (máximo 2 equipos simultáneos), plazos (hasta 30 días corridos con renovación única), flujo de aprobación formal por parte del Encargado de TI y trazabilidad inmutable de auditoría durante 5 años.

### 1.1 Arquitectura y Componentes
- **Backend (NestJS 10.x / Node.js 20 LTS):**
  - **Modular REST API:** Base URL `/api/v1` con módulos delimitados: `AuthModule`, `EquiposModule`, `SolicitudesModule`, `PrestamosModule`, `AuditoriaModule`, `NotificacionesModule` y `MetricasModule`.
  - **Persistencia (TypeORM 0.3.x & PostgreSQL 15):** Entidades fuertemente tipadas (`UsuarioEntity`, `CategoriaEntity`, `EquipoEntity`, `SolicitudPrestamoEntity`, `PrestamoEntity`, `AuditoriaEntity`) con migraciones idempotentes y seeders automáticos.
  - **Seguridad & RBAC:** Autenticación corporativa Microsoft Entra ID (Azure AD) mediante MSAL / Passport JWT Strategy, filtrado restrictivo exclusivo para cuentas con dominio corporativo (`@api-ux.com`), guards de autorización basados en roles (`@Roles('colaborador', 'administrador_ti')`).
  - **Auditoría Inmutable:** `AuditInterceptor` intercepta todas las mutaciones en solicitudes, préstamos y equipos, persistiendo snapshots JSONB (estado previo y posterior), IP del cliente y usuario sin permitir operaciones de actualización o borrado sobre la tabla `auditoria`.
  - **Observabilidad & Tareas Programadas:** Endpoints estándar `/health` y `/metrics` (Prometheus con `prom-client`), cron job diario (`CronAlertasService`) para recordatorios transaccionales 3 días antes del vencimiento.

- **Frontend (React 18.2.x / TypeScript 5.x / Vite 5.x):**
  - **Dirección Visual & Design System:** Implementación 1:1 de los tokens de diseño de Apiux en `tokens.ts` y `tailwind.config.js` (colores corporativos `#0B2F6B`, `#0E2045`, `#0E295C`, tipografía Inter, estados visuales semánticos).
  - **Flujo de Pantallas Corporativas:**
    1. `01_Login_SSO.tsx`: Autenticación corporativa mediante Microsoft Azure AD SSO con validación de dominio.
    2. `02_Catalogo_Equipos.tsx`: Vista de autoservicio para colaboradores con métricas de cupo (activos / restante), buscador en tiempo real, filtros por categoría y modal de solicitud con aceptación de responsabilidad.
    3. `03_Panel_Encargado.tsx`: Consola de administración para el Encargado de TI con indicadores de inventario (activos totales, préstamos en curso, solicitudes pendientes, por vencer en <= 3 días), gestión de aprobaciones/rechazos y modal de recepción física de devoluciones con verificación de estado.
  - **Cliente HTTP Centralizado:** Instancia de `axios` con inyección automática de Bearer tokens e interceptor de expiración con redirección a login.

- **Infraestructura & Contenedores (GCP Cloud Run / Docker):**
  - Contenedores multi-stage optimizados para backend (`node:20-alpine`) y frontend SPA (`nginx:1.25-alpine`), orquestados localmente mediante `docker-compose.yml` conectado a PostgreSQL 15, listos para despliegue serverless con auto-escalado en Google Cloud Run y Cloud SQL.

---

## 2. ACCEPTANCE CRITERIA
1. TC001: Inicio de sesión de colaborador mediante Azure AD SSO → Acceso concedido al portal de autoservicio con rol de colaborador y token JWT válido
2. TC002: Crear solicitud de préstamo para equipo disponible → Solicitud creada con estado Pendiente de Aprobación y equipo reservado temporalmente
3. TC003: Aprobar y registrar entrega de equipo por el administrador → Estado cambia a Prestado, se envía correo de confirmación y queda registro de auditoría
4. TC004: Registrar devolución física de equipo y cambio de estado → Equipo vuelve a estado Disponible, préstamo marcado Devuelto con timestamp y auditoría
5. TC005: Verificar trazabilidad inmutable del historial de un equipo → Historial completo muestra id de usuario, timestamps y acciones sin opción de edición
6. TC006: Envío de alerta por correo 3 días antes del vencimiento → Correo transaccional de recordatorio generado y enviado al colaborador asignado
7. TC007: Bloquear solicitud de préstamo sobre equipo no disponible → El sistema rechaza la acción indicando que el equipo no está disponible
8. TC008: Restringir acceso a cuentas fuera del dominio @api-ux.com → Acceso denegado con mensaje de error indicando restricción exclusiva a dominio @api-ux.com
9. TC009: Bloquear funciones de aprobación y administración a rol Colaborador → Respuesta HTTP 403 Prohibido y elementos administrativos ocultos en UI de React
10. TC001: Validar autenticación SSO con Azure AD y caducidad de tokens OAuth 2.0 → El acceso a la API es rechazado con error 401 Unauthorized y la app redirige a MSAL para re-autenticar.
11. TC002: Verificar control de acceso basado en roles (RBAC) en endpoints críticos → El backend en NestJS bloquea la solicitud respondiendo con código 403 Forbidden por falta de permisos de Administrador.
12. TC003: Validar inmutabilidad y persistencia de registros de auditoría de préstamos → Los registros almacenan usuario, timestamp y equipo intactos; la API no provee operaciones de borrado/modificación para logs de auditoría.
13. TC004: Evaluar tiempo de respuesta de la API bajo carga concurrente de colaboradores → El tiempo de respuesta se mantiene por debajo de 500 ms y la tasa de error HTTP es 0%.
14. TC005: Comprobar auto-escalado y cero downtime durante despliegue en GCP Cloud Run → Cloud Run realiza la transición sin cortes de servicio ni solicitudes fallidas (0 downtime), manteniendo SLA >= 99.5%.
15. TC006: Verificar ejecución y resiliencia de tareas programadas de alertas preventivas → El sistema reintenta el envío según la política configurada sin duplicar alertas ni perder el estado de la notificación.
16. NFR001: Validar restricción de acceso en Azure AD exclusivamente al dominio @api-ux.com → El acceso con cuentas de dominio no corporativo es bloqueado denegando la generación de sesión; la cuenta @api-ux.com accede con éxito.

---

## TEAM SCOPE (MANDATORY — PARSED BY THE PIPELINE)
- **Role:** role-tl (technical_lead) — Definición de arquitectura base, configuración tipada y entidades de datos.
- **Role:** role-be (backend_developer) — Servicios REST, lógica de negocio de préstamos, auditoría, alertas y métricas.
- **Role:** role-fe (frontend_developer) — Páginas React, tokens de diseño UI/UX, componentes y consumo de APIs.
- **Role:** role-devops (devops_support) — Orquestación Docker, scripts de inicialización y despliegue para Cloud Run.

---

## 3. EXECUTABLE ITEMS

### ITEM 1: Backend Foundation — Database Schema, TypeORM Entities, Configuration & Bootstrap
**Goal:** Establecer la base del backend en NestJS configurando TypeScript, TypeORM con PostgreSQL 15, esquema de base de datos relacional conforme a la especificación, entidades completas (`UsuarioEntity`, `CategoriaEntity`, `EquipoEntity`, `SolicitudPrestamoEntity`, `PrestamoEntity`, `AuditoriaEntity`), migración inicial con datos de semilla (seeders para 150 equipos, categorías y usuarios de prueba) y contenedor Docker multi-stage.
**Files to create:**
- backend/Dockerfile (create) - Multi-stage build (node:20-alpine) compilando TypeScript con usuario no-root, EXPOSE 3000, CMD: ["node", "dist/main.js"]
- backend/package.json (create) - Dependencias NestJS 10, TypeORM, pg, MSAL, class-validator, nodemailer, prom-client y scripts de build y ejecución
- backend/tsconfig.json (create) - Configuración TypeScript estricta con experimentalDecorators y emitDecoratorMetadata habilitados
- backend/nest-cli.json (create) - Configuración NestJS CLI con sourceRoot 'src' y deleteOutDir
- backend/src/config/configuration.ts (create) - Carga y validación estricta de variables de entorno para base de datos, Azure AD, JWT, SMTP y CORS
- backend/src/database/data-source.ts (create) - Configuración de TypeORM DataSource para ejecución de migraciones
- backend/src/database/database.module.ts (create) - Módulo TypeORM con conexión dinámica y registro de entidades
- backend/src/database/entities/usuario.entity.ts (create) - Entidad usuarios con email único, rol, estado y fecha de creación
- backend/src/database/entities/categoria.entity.ts (create) - Entidad categorias (Notebook, Monitor, Accesorio)
- backend/src/database/entities/equipo.entity.ts (create) - Entidad equipos con código de inventario, número de serie, marca, modelo y estado
- backend/src/database/entities/solicitud_prestamo.entity.ts (create) - Entidad solicitudes_prestamo con relación a usuario y equipo
- backend/src/database/entities/prestamo.entity.ts (create) - Entidad prestamos con fechas de inicio, vencimiento, devolución y flags de renovación
- backend/src/database/entities/auditoria.entity.ts (create) - Entidad auditoria con tabla_afectada, registro_id, accion, snapshots JSONB e IP
- backend/src/database/entities/index.ts (create) - Barrel export centralizado de todas las entidades TypeORM
- backend/src/database/migrations/1727710000000-InitialSchema.ts (create) - Script DDL inicial con índices en llaves foráneas y seeders de 150 activos y categorías
**Dependencies:** None
**Validation:** Compilación exitosa con `npm --prefix backend run build` y ejecución de migraciones contra PostgreSQL verificando la creación de las tablas e índices.
**Role:** role-tl (technical_lead)

### ITEM 2: Backend Security & Common Infrastructure — Guards, Decorators, Interceptors & Filters
**Goal:** Implementar la infraestructura transversal de seguridad y observabilidad de la API: decoradores de roles y usuario autenticado, guard de autenticación Bearer Azure AD, guard RBAC (`@Roles('colaborador', 'administrador_ti')`), interceptor de auditoría automática para mutaciones con snapshots JSONB, interceptor de métricas Prometheus y filtro global de excepciones RFC 7807 sin exposición de trazas internas.
**Files to create:**
- backend/src/common/decorators/roles.decorator.ts (create) - Decorador @Roles('colaborador', 'administrador_ti') usando SetMetadata
- backend/src/common/decorators/current-user.decorator.ts (create) - Decorador de parámetro @CurrentUser() extrayendo el perfil del request HTTP
- backend/src/common/guards/azure-auth.guard.ts (create) - Guard de autenticación validando token Bearer JWT
- backend/src/common/guards/roles.guard.ts (create) - Guard RBAC verificando pertenencia de rol y denegando con HTTP 403 Forbidden
- backend/src/common/interceptors/audit.interceptor.ts (create) - Interceptor que captura POST/PUT/PATCH/DELETE y delega a AuditoriaService el registro del snapshot
- backend/src/common/interceptors/metrics.interceptor.ts (create) - Interceptor registrando duración y código de respuesta HTTP en prom-client
- backend/src/common/filters/http-exception.filter.ts (create) - Filtro global de excepciones formateando errores RFC 7807 estructurados y seguros
**Dependencies:** Item 1
**Validation:** Pruebas unitarias de Guards verificando que solicitudes sin token devuelvan 401 Unauthorized y colaboradores intentando invocar rutas administrativas reciban 403 Forbidden.
**Role:** role-be (backend_developer)

### ITEM 3: Backend Auth Module — Azure AD SSO Login, JWT Strategy & Profile Sync
**Goal:** Implementar el módulo de autenticación corporativa con soporte SSO: validación de tokens id_token/access_token emitidos por Microsoft Entra ID (Azure AD), restricción obligatoria exclusiva para correos con sufijo `@api-ux.com` (rechazando dominios externos), sincronización y auto-provisión de registros en la tabla `usuarios`, emisión de tokens JWT internos de sesión y endpoints `POST /api/v1/auth/sso-login` y `GET /api/v1/auth/me` con cálculo en tiempo real de cupo de préstamos activos (máximo 2).
**Files to create:**
- backend/src/modules/auth/dto/sso-login.dto.ts (create) - DTO de validación para id_token y access_token usando class-validator
- backend/src/modules/auth/jwt.strategy.ts (create) - Estrategia Passport JWT validando expiración y resolviendo el usuario desde PostgreSQL
- backend/src/modules/auth/auth.service.ts (create) - Lógica de verificación de claims Azure AD, chequeo de dominio @api-ux.com, provisión de usuario y cálculo de cupo
- backend/src/modules/auth/auth.controller.ts (create) - Endpoints POST /api/v1/auth/sso-login y GET /api/v1/auth/me protegidos
- backend/src/modules/auth/auth.module.ts (create) - Módulo NestJS configurando JwtModule, PassportModule y exportando AuthService
**Dependencies:** Item 1, Item 2
**Validation:** Invocar `POST /api/v1/auth/sso-login` con credenciales de prueba del dominio `@api-ux.com` confirmando emisión de JWT, y con dominio `@gmail.com` confirmando rechazo con error 400/403.
**Role:** role-be (backend_developer)

### ITEM 4: Backend Equipos & Categorias Module — Catalog Querying, Inventory Management & Filters
**Goal:** Construir el módulo de inventario de equipos tecnológicos y categorías con endpoints `GET /api/v1/categorias`, `GET /api/v1/equipos`, `GET /api/v1/equipos/:id` y `POST /api/v1/equipos` (restringido a `administrador_ti`). Debe soportar paginación, búsqueda por código de inventario, marca, modelo y número de serie, y filtros por categoría y estado de disponibilidad (`disponible`, `prestado`, `en_mantencion`, `de_baja`).
**Files to create:**
- backend/src/modules/equipos/dto/create-equipo.dto.ts (create) - DTO de creación de activo con validación de código único y número de serie
- backend/src/modules/equipos/dto/filter-equipo.dto.ts (create) - DTO para query params: search, categoria_id, estado, page y limit
- backend/src/modules/equipos/equipos.service.ts (create) - Lógica de consulta paginada, filtros con TypeORM QueryBuilder y verificación de unicidad
- backend/src/modules/equipos/equipos.controller.ts (create) - Endpoints GET /api/v1/categorias, GET /api/v1/equipos, GET /api/v1/equipos/:id y POST /api/v1/equipos
- backend/src/modules/equipos/equipos.module.ts (create) - Módulo EquiposModule registrando TypeOrmModule para EquipoEntity y CategoriaEntity
**Dependencies:** Item 1, Item 2
**Validation:** Petición GET a `/api/v1/equipos?search=ThinkPad&estado=disponible` validando estructura de respuesta paginada `{ data: [...], meta: { total, page, limit, totalPages } }`.
**Role:** role-be (backend_developer)

### ITEM 5: Backend Solicitudes & Prestamos Modules — Loan Requests, Approvals, Returns & Renewals
**Goal:** Implementar los módulos centrales de flujo de negocio: creación de solicitudes por colaboradores validando el cupo estricto (< 2 préstamos activos) y disponibilidad del activo; aprobación/rechazo por el Encargado de TI (`PATCH /api/v1/solicitudes/:id/resolver`) creando automáticamente el registro en `prestamos` y actualizando el equipo a `prestado`; registro de devolución física (`POST /api/v1/prestamos/:id/devolucion`) con actualización de estado físico e inspectivo; y renovación de préstamo (`POST /api/v1/prestamos/:id/renovar`) permitida como máximo 1 vez por hasta 30 días adicionales.
**Files to create:**
- backend/src/modules/solicitudes/dto/create-solicitud.dto.ts (create) - DTO con equipo_id, motivo y días solicitados (1 a 30)
- backend/src/modules/solicitudes/dto/resolver-solicitud.dto.ts (create) - DTO con estado (aprobada/rechazada), observaciones y días de préstamo
- backend/src/modules/solicitudes/solicitudes.service.ts (create) - Reglas de negocio para cupo máximo de 2 préstamos, unicidad de solicitud pendiente y actualización atómica
- backend/src/modules/solicitudes/solicitudes.controller.ts (create) - Endpoints POST /api/v1/solicitudes, GET /api/v1/solicitudes y PATCH /api/v1/solicitudes/:id/resolver
- backend/src/modules/solicitudes/solicitudes.module.ts (create) - Módulo SolicitudesModule integrando entidades y servicios de notificación
- backend/src/modules/prestamos/dto/registrar-devolucion.dto.ts (create) - DTO con observaciones y estado_fisico_equipo (disponible, en_mantencion, de_baja)
- backend/src/modules/prestamos/dto/renovar-prestamo.dto.ts (create) - DTO con dias_extension (hasta 30) y motivo_renovacion
- backend/src/modules/prestamos/prestamos.service.ts (create) - Procesamiento transaccional de devoluciones físicas, cambio de estado de equipo y regla de renovación única
- backend/src/modules/prestamos/prestamos.controller.ts (create) - Endpoints GET /api/v1/prestamos, POST /api/v1/prestamos/:id/devolucion y POST /api/v1/prestamos/:id/renovar
- backend/src/modules/prestamos/prestamos.module.ts (create) - Módulo PrestamosModule con TypeORM y dependencias de notificación
**Dependencies:** Item 1, Item 2, Item 4
**Validation:** Probar solicitud sobre equipo no disponible verificando bloqueo, probar solicitud de usuario con 2 préstamos verificando rechazo, y aprobar solicitud verificando cambio a `prestado` y generación de registro en `prestamos`.
**Role:** role-be (backend_developer)

### ITEM 6: Backend Auditoria, Notificaciones & Cron Worker — Immutable Audit Logging, Mailer & 3-Day Alerts
**Goal:** Implementar el módulo de auditoría inmutable de 5 años con endpoint `GET /api/v1/auditoria` (restringido a `administrador_ti`) sin endpoints de mutación ni borrado; el módulo de notificaciones por correo electrónico transaccional para aprobaciones y devoluciones con Nodemailer; y el cron programado (`@nestjs/schedule`) en `CronAlertasService` que se ejecuta diariamente para identificar préstamos con vencimiento en <= 3 días y despachar alertas preventivas con tolerancia a fallos y sin duplicados.
**Files to create:**
- backend/src/modules/auditoria/auditoria.service.ts (create) - Registro inmutable de eventos con snapshots JSONB de entidades y consultas con filtros de rango de fechas y tabla
- backend/src/modules/auditoria/auditoria.controller.ts (create) - Endpoint GET /api/v1/auditoria protegido para rol administrador_ti
- backend/src/modules/auditoria/auditoria.module.ts (create) - Módulo AuditoriaModule registrando AuditoriaEntity y exportando AuditoriaService
- backend/src/modules/notificaciones/notificaciones.service.ts (create) - Servicio de envío de emails transaccionales HTML con Nodemailer para aprobaciones y recepciones
- backend/src/modules/notificaciones/cron-alertas.service.ts (create) - Tarea programada @Cron(CronExpression.EVERY_DAY_AT_8AM) que evalúa préstamos por vencer en 3 días y emite alertas
- backend/src/modules/notificaciones/notificaciones.module.ts (create) - Módulo NotificacionesModule con MailerModule y ScheduleModule
**Dependencies:** Item 1, Item 2, Item 5
**Validation:** Ejecución manual o simulada del método cron verificando detección de préstamos a 3 días de expirar y generación de registro de auditoría inmutable tras una devolución.
**Role:** role-be (backend_developer)

### ITEM 7: Backend Metricas & System Observability — Dashboard KPI Aggregations, Health Probes & Prometheus Metrics
**Goal:** Completar los endpoints de observabilidad y métricas del administrador: `GET /api/v1/metricas/resumen` (total activos, préstamos activos, solicitudes pendientes, por vencer en <= 3 días), endpoint de liveness/readiness `GET /health` verificando conectividad a PostgreSQL, endpoint `GET /metrics` exponiendo métricas de Prometheus con `prom-client`, y configurar el bootstrapping global en `app.module.ts` y `main.ts` con ValidationPipe global, CORS, prefijo `/api/v1` e interceptores.
**Files to create:**
- backend/src/modules/metricas/metricas.service.ts (create) - Consultas agregadas de conteo de inventario, préstamos, solicitudes y métricas de rendimiento
- backend/src/modules/metricas/metricas.controller.ts (create) - Endpoints GET /api/v1/metricas/resumen (administrador_ti), GET /health y GET /metrics
- backend/src/modules/metricas/metricas.module.ts (create) - Módulo MetricasModule integrando repositorios de equipos, solicitudes y préstamos
- backend/src/app.module.ts (create) - Módulo raíz de NestJS que agrega DatabaseModule, AuthModule, EquiposModule, SolicitudesModule, PrestamosModule, AuditoriaModule, NotificacionesModule y MetricasModule
- backend/src/main.ts (create) - Bootstrap de la aplicación con prefijo global /api/v1, ValidationPipe global con whitelist, filtro HttpExceptionFilter y Swagger/OpenAPI
**Dependencies:** Item 1, Item 2, Item 3, Item 4, Item 5, Item 6
**Validation:** Iniciar el backend y verificar que `GET /health` retorne `{"status":"ok","info":{"database":{"status":"up"}}}` y que `GET /metrics` entregue métricas estándar de Prometheus.
**Role:** role-be (backend_developer)

### ITEM 8: Frontend Foundation — UI Tokens, Global Styles, Base UI Components & Build Configuration
**Goal:** Inicializar el frontend SPA con Vite, React 18 y TypeScript configurando los tokens de diseño de Apiux (`tokens.ts`) extraídos del contrato Figma (paleta institucional `#0B2F6B`, `#0E2045`, tipografía Inter, radios, sombras y estados de disponibilidad), `tailwind.config.js`, contratos TypeScript (`types/index.ts`) y los componentes UI base reutilizables (`Button`, `Modal`, `Badge`, `Table`, `AppNavbar`) con soporte para accesibilidad y tipado estricto.
**Files to create:**
- frontend/package.json (create) - Dependencias React 18, React Router 6, MSAL browser/react, Axios, Lucide React, Tailwind CSS
- frontend/tsconfig.json (create) - Configuración TypeScript estricta para React JSX/TSX
- frontend/vite.config.ts (create) - Configuración de empaquetado Vite con soporte de alias y dev server en puerto 5173
- frontend/tailwind.config.js (create) - Configuración de Tailwind vinculando tokens exactos de color, fuentes y sombras institucionales
- frontend/postcss.config.js (create) - Configuración de PostCSS con tailwindcss y autoprefixer
- frontend/index.html (create) - Entry point HTML con carga de fuente Inter y viewport corporativo
- frontend/Dockerfile (create) - Multi-stage build con node:20-alpine para empaquetado y nginx:1.25-alpine para servir la SPA en puerto 80 (mapeado a 23080)
- frontend/nginx.conf (create) - Configuración de Nginx con reverse proxy SPA direccionando todas las rutas a /index.html y compresión gzip
- frontend/src/styles/tokens.ts (create) - Especificación formal de tokens de diseño Apiux (colores primarios, secundarios, bordes, estados)
- frontend/src/styles/index.css (create) - Directivas base de Tailwind y estilos tipográficos corporativos
- frontend/src/types/index.ts (create) - Contratos TypeScript de Usuario, Equipo, SolicitudPrestamo, Prestamo, Auditoria y DTOs
- frontend/src/components/ui/Button.tsx (create) - Componente Button con variantes primary, secondary, danger, ghost, outline y estados de carga
- frontend/src/components/ui/Modal.tsx (create) - Diálogo modal accesible con backdrop semitransparente, encabezado azul claro y pie de acciones
- frontend/src/components/ui/Badge.tsx (create) - Insignia semántica de estados (disponible, prestado, en_mantencion, pendiente, vencido)
- frontend/src/components/ui/Table.tsx (create) - Tabla de datos corporativa con soporte de columnas dinámicas, estados de carga y empty state
- frontend/src/components/ui/AppNavbar.tsx (create) - Barra superior corporativa con selector de roles, pill de usuario y cierre de sesión
**Dependencies:** None
**Validation:** Compilar el frontend con `npm --prefix frontend run build` verificando cero errores de tipos y correcta generación del bundle en `frontend/dist`.
**Role:** role-fe (frontend_developer)

### ITEM 9: Frontend Auth & User Session Flow — MSAL Integration, Protected Routes & SSO Login Screen
**Goal:** Implementar el flujo de autenticación corporativa en el frontend: configuración de MSAL para Microsoft Entra ID (`authConfig.ts`), cliente `apiClient` con inyectores de token e interceptores de caducidad para renovación o redirección automática, `AuthContext` y hook `useAuth`, envoltura de rutas protegidas con validación de roles (`ProtectedRoute.tsx`), componente raíz `App.tsx` con enrutador, y la pantalla `01_Login_SSO.tsx` fiel al diseño Figma (banner hero azul institucional `#0B2F6B`, tarjeta central con botón SSO de Microsoft, spinner de autenticación y footer de políticas de uso).
**Files to create:**
- frontend/src/config/authConfig.ts (create) - Configuración MSAL con client ID, tenant ID, scopes de lectura de perfil y redirección
- frontend/src/config/api.ts (create) - Instancia centralizada de Axios configurada con baseURL e interceptor para Bearer JWT y error 401
- frontend/src/context/AuthContext.tsx (create) - Contexto global administrando estado de sesión, usuario, rol y cuota activa
- frontend/src/hooks/useAuth.ts (create) - Hook personalizado consumiendo AuthContext con utilidades de login, logout e isAdmin
- frontend/src/components/common/ProtectedRoute.tsx (create) - Guard de navegación en React Router redirigiendo usuarios no autorizados o sin rol adecuado
- frontend/src/App.tsx (create) - Configuración de proveedores (MsalProvider, AuthProvider, BrowserRouter) y mapeo de rutas `/`, `/catalogo`, `/panel-encargado`
- frontend/src/main.tsx (create) - Entry point React montando App en el DOM root
- frontend/src/pages/01_Login_SSO.tsx (create) - Vista 01 Login SSO con Hero corporativo, botón de autenticación Microsoft Entra ID y aviso de auditoría de 5 años
**Dependencies:** Item 8, Item 3
**Validation:** Ejecutar la aplicación, verificar renderizado pixel-faithful de `01_Login_SSO.tsx` y comprobar que accesos directos a `/panel-encargado` sin credenciales redirijan inmediatamente a `/`.
**Role:** role-fe (frontend_developer)

### ITEM 10: Frontend Colaborador Flow — Equipment Catalog Exploration, Quota Dashboard & Loan Requests
**Goal:** Desarrollar el flujo del colaborador en la pantalla `02_Catalogo_Equipos.tsx`: barra de navegación `AppNavbar` para rol colaborador, panel de métricas rápidas (préstamos activos, cupo restante de 2 equipos, días máximos), barra de búsqueda con debounce por texto y filtros por categorías (Notebooks, Monitores, Accesorios), grilla/lista de activos con insignias de estado, botón contextual de solicitud bloqueado cuando el cupo está agotado, y modal interactivo de solicitud de préstamo ("Loan Confirmation Panel") con selección de plazo (7, 15, 30 días), justificación obligatoria y confirmación conectada a la API mediante el hook `useCatalog`.
**Files to create:**
- frontend/src/hooks/useCatalog.ts (create) - Hook para búsqueda, filtrado reactivo de equipos, cálculo de cupos y envío de solicitudes a la API
- frontend/src/pages/02_Catalogo_Equipos.tsx (create) - Pantalla completa del catálogo de equipos TI conforme al diseño Figma con grid responsivo y modal de confirmación
**Dependencies:** Item 8, Item 4, Item 5
**Validation:** Cargar la vista `/catalogo`, verificar filtrado por categoría "Monitores", abrir modal de solicitud sobre equipo disponible, validar bloqueo del botón si se supera el cupo y confirmar envío exitoso de la solicitud.
**Role:** role-fe (frontend_developer)

### ITEM 11: Frontend Encargado TI Flow — Admin Console, Approval Workflow, Returns & Metrics Dashboard
**Goal:** Construir la consola de administración del Encargado de TI en `03_Panel_Encargado.tsx`: métricas KPI superiores (Total Activos 150, Préstamos Activos, Solicitudes Pendientes, Por Vencer <= 3 días), sistema de pestañas para "Solicitudes Pendientes" y "Préstamos Activos y Devoluciones", tabla de aprobaciones con acciones de "Aprobar" (asignando días de préstamo) o "Rechazar" (ingresando motivo), tabla de préstamos activos con acción de "Renovar" (habilitada 1 sola vez) y "Registrar Devolución" con modal de confirmación (`ReturnConfirmation`) para registrar estado físico (`disponible` o `en_mantencion`) e inspección técnica, gestionado por los hooks `useLoans` y `useMetrics`.
**Files to create:**
- frontend/src/hooks/useLoans.ts (create) - Hook para obtener solicitudes pendientes, préstamos activos, resolver aprobaciones, registrar devoluciones y renovaciones
- frontend/src/hooks/useMetrics.ts (create) - Hook para consultar y refrescar los indicadores de resumen de inventario
- frontend/src/pages/03_Panel_Encargado.tsx (create) - Pantalla de consola de administración con tabs, tablas de gestión y modal de devolución física
**Dependencies:** Item 8, Item 4, Item 5, Item 6, Item 7
**Validation:** Acceder con rol `administrador_ti` a `/panel-encargado`, aprobar una solicitud pendiente verificando actualización de métricas en tiempo real, y registrar una devolución completando el modal con estado físico "disponible".
**Role:** role-fe (frontend_developer)

### ITEM 12: Infrastructure & Deployment — Multi-Container Orchestration, Environment Config & Startup Script
**Goal:** Proveer la infraestructura completa de orquestación local y preparación para GCP Cloud Run: archivo `docker-compose.yml` orquestando PostgreSQL 15 (puerto host 25432), backend NestJS (puerto host 23000) y frontend SPA Nginx (puerto host 23080) con healthchecks estrictos y orden de dependencia `service_healthy`, plantilla documentada `.env.example`, archivos `.gitignore` y `.dockerignore`, script ejecutable `run.sh` con inicialización automática, comprobación de salud y despliegue sin intervención manual, y documentación integral en `README.md`.
**Files to create:**
- docker-compose.yml (create) - Orquestación de postgres, backend y frontend con healthchecks y puertos 25432, 23000 y 23080
- .env.example (create) - Documentación completa de todas las variables de entorno de base de datos, Azure AD, JWT, SMTP y puertos
- .gitignore (create) - Exclusiones para node_modules, dist, .env, archivos de log y temporales
- .dockerignore (create) - Exclusiones de empaquetado para imágenes Docker
- run.sh (create) - Script de ejecución con validación de Docker, compilación, espera activa de healthchecks y mensaje final con URLs de acceso
- README.md (create) - Manual de arquitectura, requisitos previos, instrucciones de arranque rápido (./run.sh), guía de endpoints y políticas de auditoría
**Dependencies:** Item 1, Item 2, Item 3, Item 4, Item 5, Item 6, Item 7, Item 8, Item 9, Item 10, Item 11
**Validation:** Ejecutar `./run.sh`, validar que los 3 contenedores reporten estado `healthy`, acceder a `http://localhost:23080` en el navegador y verificar comunicación fluida con la API en `http://localhost:23000/api/v1`.
**Role:** role-devops (devops_support)