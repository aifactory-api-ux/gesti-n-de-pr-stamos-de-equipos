# Sistema de Gestión de Préstamos de Equipos TI — Apiux

Plataforma corporativa integral para el control de inventario, trazabilidad de custodias, flujo de aprobación de préstamos tecnológicos, devoluciones físicas con inspección de condición operativa y observabilidad en tiempo real. Diseñada conforme a los estándares **ISO 27001**, buenas prácticas **ITIL** y la normativa chilena de teletrabajo.

---

## 🏛️ Arquitectura del Sistema

El proyecto está estructurado como un monorepo desacoplado y orientado a microservicios en contenedores:

```
├── backend/                  # API REST construida con NestJS 10 y TypeScript
│   ├── src/
│   │   ├── common/           # Decoradores RBAC, Guards Azure AD, Filtro RFC 7807, Interceptores
│   │   ├── config/           # Configuración tipada y validación de variables de entorno
│   │   ├── database/         # Entidades TypeORM, migraciones relacionales y seeders
│   │   └── modules/          # Auth, Equipos, Solicitudes, Préstamos, Auditoría, Notificaciones, Métricas
│   └── Dockerfile            # Multi-stage build (Node 20 Alpine, usuario node sin privilegios)
│
├── frontend/                 # SPA React 18, Vite, TypeScript y Tailwind CSS
│   ├── src/
│   │   ├── components/       # Componentes UI corporativos (Navbar, Modal, Badge, Button, Table, Tabs)
│   │   ├── context/          # AuthContext con soporte MSAL y simulación SSO
│   │   ├── pages/            # 01_Login_SSO, 02_Catalogo_Equipos, 03_Panel_Encargado
│   │   └── types/            # Contratos de tipos TypeScript compartidos
│   ├── nginx.conf            # Reverse proxy Nginx, compresión Gzip y enrutamiento SPA
│   └── Dockerfile            # Multi-stage build (Node 20 -> Nginx 1.25 Alpine)
│
├── docker-compose.yml        # Orquestación multi-contenedor (PostgreSQL 15, Backend, Frontend)
├── run.sh                    # Script interactivo de despliegue con health checks automáticos
├── .env.example              # Plantilla de variables de entorno documentada
└── README.md                 # Manual técnico y guía de despliegue
```

### Diagrama de Flujo y Red

```
                        [ Cliente / Navegador Web ]
                                    │
                                    ▼  Puerto 23080
                    ┌───────────────────────────────┐
                    │       Nginx Reverse Proxy     │
                    │   (Frontend SPA React 18)     │
                    └───────────────┬───────────────┘
                                    │  Proxy /api/v1/
                                    ▼  Puerto 23000
                    ┌───────────────────────────────┐
                    │      Backend NestJS REST      │
                    │   (RBAC, JWT, Metrics, Audit) │
                    └───────┬───────────────┬───────┘
                            │               │
             TypeORM / SQL  │               │  SMTP
             Puerto 25432   ▼               ▼
      ┌───────────────────────────┐   ┌───────────────────────────┐
      │  PostgreSQL 15 Relacional │   │ Servidor Notificaciones   │
      │  (150 Equipos, Auditoría) │   │ (MailDev / SMTP Corporativo)│
      └───────────────────────────┘   └───────────────────────────┘
```

---

## 🚀 Inicio Rápido con Docker

### Requisitos Previos
- **Docker Engine** 24.0+ y **Docker Compose** v2+ instalados.
- Puertos disponibles en la máquina anfitrión: `25432` (PostgreSQL), `23000` (Backend API), `23080` (Frontend SPA).

### Despliegue Automatizado (Recomendado)

Ejecute el script de arranque institucional:

```bash
./run.sh
```

El script se encarga de:
1. Validar la disponibilidad del demonio de Docker y Docker Compose.
2. Comprobar o generar automáticamente el archivo `.env` a partir de `.env.example`.
3. Construir y levantar los 3 contenedores (`postgres`, `backend`, `frontend`).
4. Realizar polling a las sondas de salud (`pg_isready` y `/health` HTTP 200).
5. Imprimir en pantalla el resumen de accesos directos y credenciales.

### Despliegue Manual con Docker Compose

```bash
# 1. Clonar el archivo de entorno
cp .env.example .env

# 2. Construir e iniciar en segundo plano
docker compose up -d --build

# 3. Monitorear registros de los servicios
docker compose logs -f
```

---

## 🌐 URLs y Puntos de Acceso

| Servicio | URL Local | Descripción |
| :--- | :--- | :--- |
| **Frontend SPA** | [http://localhost:23080](http://localhost:23080) | Portal Web (Catálogo Colaborador y Consola Encargado TI) |
| **Backend REST API** | [http://localhost:23000/api/v1](http://localhost:23000/api/v1) | Endpoint base de la API RESTful |
| **Health Check Probe** | [http://localhost:23000/health](http://localhost:23000/health) | Sonda Liveness/Readiness y estado de PostgreSQL |
| **Prometheus Metrics** | [http://localhost:23000/metrics](http://localhost:23000/metrics) | Métricas operacionales en formato Prometheus |
| **Swagger / OpenAPI** | [http://localhost:23000/docs](http://localhost:23000/docs) | Documentación interactiva Swagger UI |
| **PostgreSQL 15** | `localhost:25432` | Base de datos relacional (DB: `prestamos_apiux`) |

---

## 🔐 Cuentas de Acceso y Roles (Azure AD Mock)

El sistema soporta autenticación mediante **Azure AD MSAL** y un modo de autenticación simulada (Mock SSO) para entornos locales y demostraciones:

| Usuario | Correo Corporativo | Rol | Capacidades |
| :--- | :--- | :--- | :--- |
| **Encargado TI** | `admin.ti@apiux.com` | `administrador_ti` | Aprobar/rechazar solicitudes, registrar devoluciones físicas con inspección, renovar préstamos, ver auditoría y métricas de inventario. |
| **Colaborador** | `colaborador@apiux.com` | `colaborador` | Explorar catálogo de equipos disponibles, solicitar préstamo con justificación y visualizar historial de custodias propias. |

---

## 📋 Catálogo Completo de Endpoints API

### 1. Autenticación y Perfil (`/api/v1/auth`)
- `POST /api/v1/auth/sso-login`: Inicio de sesión institucional mediante token SSO o correo simulado. Retorna JWT Bearer.
- `GET /api/v1/auth/me`: Obtiene el perfil y rol del usuario autenticado actual.

### 2. Inventario de Equipos (`/api/v1/equipos`)
- `GET /api/v1/equipos`: Listado paginado con filtros (`categoria_id`, `estado`, `search`, `page`, `limit`).
- `GET /api/v1/equipos/categorias`: Listado de categorías de activos (Notebooks, Monitores, Periféricos).
- `GET /api/v1/equipos/:id`: Detalle técnico de un equipo específico.

### 3. Solicitudes de Préstamo (`/api/v1/solicitudes`)
- `POST /api/v1/solicitudes`: Crear solicitud para un activo disponible con justificación obligatoria.
- `GET /api/v1/solicitudes`: Listado de solicitudes (filtrado automático para colaboradores; visión total para Encargados TI).
- `GET /api/v1/solicitudes/:id`: Detalle de una solicitud.
- `PATCH /api/v1/solicitudes/:id/resolver`: Resolución de solicitud (`aprobada` con vigencia de 7, 15 o 30 días, o `rechazada` con justificación obligatoria).

### 4. Préstamos y Custodias (`/api/v1/prestamos`)
- `GET /api/v1/prestamos`: Listado de préstamos con filtros (`usuario_id`, `estado`, `por_vencer`).
- `GET /api/v1/prestamos/:id`: Detalle de custodia.
- `POST /api/v1/prestamos/:id/devolucion`: Devolución física del equipo con inspección de condición operativa (`disponible`, `en_mantencion`, `de_baja`) e informe de accesorios.
- `POST /api/v1/prestamos/:id/renovacion`: Prórroga excepcional de 30 días (restringida a un máximo de 1 renovación por préstamo).

### 5. Auditoría Inmutable ISO 27001 (`/api/v1/auditoria`)
- `GET /api/v1/auditoria`: Consulta de registros inmutables de auditoría con filtros por módulo, acción, usuario y rango de fechas.

### 6. Notificaciones y Alertas ITIL (`/api/v1/notificaciones`)
- `GET /api/v1/notificaciones/resumen`: Estadísticas de notificaciones despachadas por correo.
- `POST /api/v1/notificaciones/alertas-vencimiento`: Ejecución forzada bajo demanda del cron de alertas automáticas para préstamos a vencer (≤ 3 días) y vencidos.

### 7. Métricas y Observabilidad (`/api/v1/metricas`, `/health`, `/metrics`)
- `GET /api/v1/metricas/resumen`: Agregación de KPIs de inventario (total activos, préstamos activos, solicitudes pendientes, por vencer en ≤ 3 días).
- `GET /health`: Sonda de salud pública liveness/readiness con verificación activa de PostgreSQL.
- `GET /metrics`: Endpoint en formato texto estándar para Prometheus.

---

## 🛡️ Seguridad, Auditoría y Cumplimiento Normativo

1. **Trazabilidad Inmutable (ISO 27001):** Cada cambio de estado sobre solicitudes, inventario y préstamos dispara automáticamente un registro inmutable en la tabla `auditoria` con dirección IP, User-Agent, ID del usuario responsable y detalle de la operación.
2. **Estándar RFC 7807:** Todos los errores HTTP devuelven un formato estructurado de Problema (`type`, `title`, `status`, `detail`, `timestamp`).
3. **Métricas Prometheus:** Exportador integrado que expone latencias HTTP, conteo de requests por código de estado y gauges en tiempo real sobre el stock de activos.
4. **Contenedores Hardened:** Las imágenes Docker ejecutan los procesos bajo el usuario sin privilegios `node` (UID 1000) y capas mínimas sobre Alpine Linux.

---

## 🧪 Pruebas Unitarias y Verificación de Calidad

### Ejecución de Pruebas en Backend
```bash
cd backend
npm test          # 176 pruebas unitarias en 15 suites (Jest)
npm run build     # Compilación estricta TypeScript (NestJS)
```

### Ejecución de Pruebas en Frontend
```bash
cd frontend
npm test          # 34 pruebas unitarias en 2 suites (Vitest)
npm run build     # Compilación estricta TypeScript y empaquetado Vite
```

---

## 🗄️ Modelo de Datos y Esquema Relacional (Contrato PostgreSQL)

El sistema implementa estrictamente las 6 entidades relacionales normalizadas para el control integral del inventario y la trazabilidad de custodias:

1. **`USUARIO`**:
   - `id` (UUID, PK), `email` (VARCHAR 255, UNIQUE), `nombre` (VARCHAR 255), `rol` (ENUM: `colaborador`, `administrador_ti`), `departamento` (VARCHAR 100), `activo` (BOOLEAN, default true), `creado_en` (TIMESTAMP).
2. **`CATEGORIA`**:
   - `id` (UUID, PK), `nombre` (VARCHAR 100, UNIQUE), `descripcion` (TEXT), `activo` (BOOLEAN, default true).
3. **`EQUIPO`**:
   - `id` (UUID, PK), `categoria_id` (UUID, FK `CATEGORIA`), `numero_serie` (VARCHAR 100, UNIQUE), `marca` (VARCHAR 100), `modelo` (VARCHAR 100), `estado` (ENUM: `disponible`, `prestado`, `en_mantencion`, `de_baja`), `especificaciones` (JSONB: RAM, CPU, disco, etc.), `creado_en` (TIMESTAMP), `actualizado_en` (TIMESTAMP).
4. **`SOLICITUD_PRESTAMO`**:
   - `id` (UUID, PK), `usuario_id` (UUID, FK `USUARIO`), `equipo_id` (UUID, FK `EQUIPO`), `fecha_solicitud` (TIMESTAMP), `motivo` (TEXT), `estado` (ENUM: `pendiente`, `aprobada`, `rechazada`, `cancelada`), `aprobado_por` (UUID, FK `USUARIO`, nullable), `fecha_resolucion` (TIMESTAMP, nullable), `observaciones_resolucion` (TEXT, nullable).
5. **`PRESTAMO`**:
   - `id` (UUID, PK), `solicitud_id` (UUID, FK `SOLICITUD_PRESTAMO`), `usuario_id` (UUID, FK `USUARIO`), `equipo_id` (UUID, FK `EQUIPO`), `fecha_inicio` (TIMESTAMP), `fecha_vencimiento` (TIMESTAMP), `fecha_devolucion` (TIMESTAMP, nullable), `estado` (ENUM: `activo`, `devuelto`, `vencido`), `observaciones_entrega` (TEXT), `observaciones_devolucion` (TEXT, nullable), `estado_equipo_devolucion` (ENUM: `disponible`, `en_mantencion`, `de_baja`, nullable), `renovaciones` (INT, default 0, máx 1).
6. **`AUDITORIA`**:
   - `id` (UUID, PK), `usuario_id` (UUID, FK `USUARIO`, nullable en eventos del sistema), `accion` (VARCHAR 100), `modulo` (VARCHAR 100), `entidad_id` (VARCHAR 100, nullable), `detalles` (JSONB), `ip` (VARCHAR 45, nullable), `user_agent` (VARCHAR 255, nullable), `creado_en` (TIMESTAMP, NOT NULL).

---

## ☁️ Guía de Despliegue en GCP (Google Cloud Platform)

La solución fue diseñada siguiendo los principios de arquitectura *cloud-native* para ejecutarse de manera escalable y serverless en **Google Cloud Run** respaldada por **Google Cloud SQL (PostgreSQL 15)**.

### 1. Requisitos Previos en Google Cloud
- Proyecto en GCP activo con facturación habilitada.
- API habilitadas: `run.googleapis.com`, `sqladmin.googleapis.com`, `secretmanager.googleapis.com`, `cloudbuild.googleapis.com`.
- Instancia de Cloud SQL PostgreSQL 15 creada (ej. `apiux-prestamos-db`).

### 2. Almacenamiento Seguro de Secretos con Secret Manager
Cree los secretos requeridos para producción:
```bash
# Crear secretos institucionales
gcloud secrets create apiux-db-password --data-file=<(echo -n "ContrasenaSuperSegura2026")
gcloud secrets create apiux-jwt-secret --data-file=<(echo -n "JWT_PROD_SECRET_APIUX_ENTERPRISE_KEY_2026")
gcloud secrets create apiux-azure-client-secret --data-file=<(echo -n "AZURE_PROD_CLIENT_SECRET")
```

### 3. Construcción y Publicación de Imágenes (Google Cloud Build / Artifact Registry)
```bash
# Configurar repositorio en Artifact Registry
gcloud artifacts repositories create apiux-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Repositorio Docker para Sistema de Prestamos Apiux"

# Construcción de la imagen Backend
gcloud builds submit ./backend \
    --tag us-central1-docker.pkg.dev/$PROJECT_ID/apiux-repo/prestamos-backend:latest

# Construcción de la imagen Frontend
gcloud builds submit ./frontend \
    --tag us-central1-docker.pkg.dev/$PROJECT_ID/apiux-repo/prestamos-frontend:latest
```

### 4. Despliegue del Backend en Cloud Run con Conexión a Cloud SQL
```bash
gcloud run deploy apiux-prestamos-backend \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/apiux-repo/prestamos-backend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --add-cloudsql-instances $PROJECT_ID:us-central1:apiux-prestamos-db \
    --update-env-vars NODE_ENV=production,PORT=3000,DB_HOST=/cloudsql/$PROJECT_ID:us-central1:apiux-prestamos-db,DB_PORT=5432,DB_USERNAME=postgres,DB_NAME=prestamos_apiux,AZURE_AD_ENABLED=true,AZURE_AD_CLIENT_ID=$AZURE_CLIENT_ID,AZURE_AD_TENANT_ID=$AZURE_TENANT_ID \
    --update-secrets DB_PASSWORD=apiux-db-password:latest,JWT_SECRET=apiux-jwt-secret:latest,AZURE_AD_CLIENT_SECRET=apiux-azure-client-secret:latest
```

### 5. Despliegue del Frontend en Cloud Run
```bash
gcloud run deploy apiux-prestamos-frontend \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/apiux-repo/prestamos-frontend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 80
```

---

## 💻 Desarrollo Local (Sin Docker)

Si prefiere ejecutar los servicios directamente en su máquina anfitriona para desarrollo rápido:

### 1. Iniciar Base de Datos Local
Asegúrese de tener PostgreSQL 15 ejecutándose en el puerto `5432` o utilice un contenedor aislado:
```bash
docker run -d --name pg-dev -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=prestamos_apiux postgres:15-alpine
```

### 2. Backend NestJS
```bash
cd backend
npm install
npm run migration:run   # Ejecuta las migraciones de TypeORM
npm run seed            # Carga el inventario de 150 activos y usuarios iniciales
npm run start:dev       # Inicia en modo watch en http://localhost:3000
```

### 3. Frontend React SPA
```bash
cd frontend
npm install
npm run dev             # Inicia servidor Vite en http://localhost:5173
```

---

## 🛑 Detención y Limpieza de Contenedores

Para detener todos los servicios y liberar recursos:

```bash
docker compose down
```

Para reiniciar eliminando los volúmenes de base de datos y recrear el inventario desde cero:

```bash
docker compose down -v
./run.sh
```

---
*Apiux Tecnología — División de Infraestructura y Operaciones TI 2026*
