# Etapa 1: Compilación de la aplicación Vite SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copia de dependencias e instalación
COPY package*.json ./
RUN npm install

# Copia de código fuente y compilación
COPY . .
RUN npm run build

# Etapa 2: Servidor web Nginx para producción
FROM nginx:1.25-alpine

# Copia de artefactos estáticos generados
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración personalizada de Nginx para SPA y reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Puerto de escucha del contenedor
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
