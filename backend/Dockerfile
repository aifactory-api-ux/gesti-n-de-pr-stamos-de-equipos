# Etapa 1: Construcción y compilación de dependencias TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: Entorno ligero de ejecución en producción
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Ejecución bajo usuario sin privilegios root
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
