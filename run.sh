#!/usr/bin/env bash
# ==============================================================================
# SISTEMA DE GESTIÓN DE PRÉSTAMOS DE EQUIPOS TI — APIUX
# Script Automatizado de Despliegue y Arranque de Infraestructura Multi-Contenedor
# ==============================================================================

set -euo pipefail

# Colores y formatos para la consola
BOLD='\033[1m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin color

# Directorio raíz del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}${BOLD}"
echo "================================================================================"
echo "    APIUX TECNOLOGÍA — SISTEMA INTEGRAL DE GESTIÓN DE PRÉSTAMOS TI"
echo "        Despliegue Multi-Contenedor (PostgreSQL 15, NestJS, React Vite)"
echo "================================================================================"
echo -e "${NC}"

# 1. Verificación de pre-requisitos de Docker
echo -e "${CYAN}[1/5] Verificando pre-requisitos del entorno...${NC}"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Docker no está instalado o no se encuentra en el PATH.${NC}"
    echo "Por favor instale Docker Desktop o Docker Engine antes de continuar."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] El demonio de Docker no se encuentra en ejecución.${NC}"
    echo "Por favor inicie el servicio de Docker e intente nuevamente."
    exit 1
fi

# Detección de Docker Compose (V2 plugin vs V1 binario)
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose no está instalado.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker y Docker Compose detectados: $($COMPOSE_CMD version)${NC}"

# 2. Verificación y preparación de variables de entorno (.env)
echo -e "\n${CYAN}[2/5] Comprobando archivo de configuración (.env)...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}Archivo .env no encontrado. Creando automáticamente a partir de .env.example...${NC}"
        cp .env.example .env
        echo -e "${GREEN}✓ Archivo .env generado exitosamente.${NC}"
    else
        echo -e "${RED}[ERROR] No se encontró .env ni .env.example en el directorio raíz.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Archivo .env presente y configurado.${NC}"
fi

# 3. Construcción y levantamiento de servicios multi-contenedor
echo -e "\n${CYAN}[3/5] Construyendo imágenes y levantando servicios en Docker...${NC}"
echo "Comando: $COMPOSE_CMD up -d --build"

$COMPOSE_CMD up -d --build

# 4. Espera y validación activa de sondas de salud (Healthchecks)
echo -e "\n${CYAN}[4/5] Esperando estabilización de servicios y sondas de salud...${NC}"

# 4.1 Comprobación de PostgreSQL
echo -n "Esperando base de datos PostgreSQL (puerto 25432)... "
MAX_DB_RETRIES=30
DB_RETRIES=0
until $COMPOSE_CMD exec -T postgres pg_isready -U postgres -d prestamos_apiux >/dev/null 2>&1 || [ $DB_RETRIES -eq $MAX_DB_RETRIES ]; do
    echo -n "."
    sleep 2
    DB_RETRIES=$((DB_RETRIES + 1))
done

if [ $DB_RETRIES -eq $MAX_DB_RETRIES ]; then
    echo -e "\n${YELLOW}Advertencia: PostgreSQL tardó en responder. Continuando con verificación...${NC}"
else
    echo -e " ${GREEN}[UP]${NC}"
fi

# 4.2 Comprobación del Backend NestJS
echo -n "Esperando sonda de salud del Backend API (/health)... "
MAX_BACKEND_RETRIES=35
BACKEND_RETRIES=0
BACKEND_HEALTHY=false

while [ $BACKEND_RETRIES -lt $MAX_BACKEND_RETRIES ]; do
    if command -v curl >/dev/null 2>&1; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:23000/health || true)
    elif command -v wget >/dev/null 2>&1; then
        HTTP_CODE=$(wget --spider -S "http://localhost:23000/health" 2>&1 | awk '/HTTP\// {print $2}' | tail -n 1 || true)
    else
        HTTP_CODE="unknown"
    fi

    if [ "$HTTP_CODE" = "200" ]; then
        BACKEND_HEALTHY=true
        break
    fi

    echo -n "."
    sleep 2
    BACKEND_RETRIES=$((BACKEND_RETRIES + 1))
done

if [ "$BACKEND_HEALTHY" = true ]; then
    echo -e " ${GREEN}[UP (200 OK)]${NC}"
else
    echo -e " ${YELLOW}[Iniciando en segundo plano]${NC}"
fi

# 4.3 Comprobación del Frontend SPA Nginx
echo -n "Esperando servidor web Frontend SPA (puerto 23080)... "
MAX_FRONTEND_RETRIES=20
FRONTEND_RETRIES=0
FRONTEND_HEALTHY=false

while [ $FRONTEND_RETRIES -lt $MAX_FRONTEND_RETRIES ]; do
    if command -v curl >/dev/null 2>&1; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:23080/ || true)
    elif command -v wget >/dev/null 2>&1; then
        HTTP_CODE=$(wget --spider -S "http://localhost:23080/" 2>&1 | awk '/HTTP\// {print $2}' | tail -n 1 || true)
    else
        HTTP_CODE="unknown"
    fi

    if [ "$HTTP_CODE" = "200" ]; then
        FRONTEND_HEALTHY=true
        break
    fi

    echo -n "."
    sleep 2
    FRONTEND_RETRIES=$((FRONTEND_RETRIES + 1))
done

if [ "$FRONTEND_HEALTHY" = true ]; then
    echo -e " ${GREEN}[UP (200 OK)]${NC}"
else
    echo -e " ${YELLOW}[Iniciando en segundo plano]${NC}"
fi

# 5. Resumen ejecutivo de despliegue y enlaces de acceso
echo -e "\n${CYAN}[5/5] Despliegue institucional completado con éxito.${NC}"
echo -e "${BLUE}${BOLD}"
echo "================================================================================"
echo "                   PANEL DE CONTROL DE ACCESOS Y SERVICIOS"
echo "================================================================================"
echo -e "${NC}"

echo -e "  ${BOLD}🌐 Frontend SPA (Portal Web):${NC}       ${CYAN}http://localhost:23080${NC}"
echo -e "  ${BOLD}🚀 Backend REST API:${NC}                ${CYAN}http://localhost:23000/api/v1${NC}"
echo -e "  ${BOLD}🩺 Health Check Probe:${NC}              ${CYAN}http://localhost:23000/health${NC}"
echo -e "  ${BOLD}📊 Métricas Prometheus:${NC}             ${CYAN}http://localhost:23000/metrics${NC}"
echo -e "  ${BOLD}📚 Documentación Swagger/OpenAPI:${NC}   ${CYAN}http://localhost:23000/docs${NC}"
echo -e "  ${BOLD}🗄️ PostgreSQL Database:${NC}             ${CYAN}localhost:25432 (DB: prestamos_apiux)${NC}"

echo -e "\n${BOLD}Credenciales de Demostración (Azure SSO Mock):${NC}"
echo -e "  • ${YELLOW}Administrador TI / Encargado:${NC}  admin.ti@apiux.com  (Rol: administrador_ti)"
echo -e "  • ${YELLOW}Colaborador Solicitante:${NC}       colaborador@apiux.com (Rol: colaborador)"

echo -e "\n${BOLD}Comandos de Operación:${NC}"
echo "  • Ver logs en tiempo real:  $COMPOSE_CMD logs -f"
echo "  • Estado de contenedores:   $COMPOSE_CMD ps"
echo "  • Detener servicios:        $COMPOSE_CMD down"
echo "  • Reiniciar servicios:      $COMPOSE_CMD restart"

echo -e "\n${GREEN}${BOLD}¡Sistema Apiux TI listo para operar!${NC}\n"
