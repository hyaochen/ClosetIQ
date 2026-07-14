# ---- Stage 1: install deps + generate Prisma client ----
# Needs the build toolchain (python3/make/g++) for native modules (argon2, sharp)
# and openssl for Prisma engine detection.
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat openssl

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json turbo.json ./

# Copy workspace package files
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (tsx + prisma CLI are needed at runtime by the
# entrypoint: prisma migrate deploy + tsx src/server.ts)
RUN npm ci && npm cache clean --force

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# ---- Stage 2: runtime without build toolchain ----
FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY --from=builder /app /app

COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["/entrypoint.sh"]
