#!/bin/sh
set -e

echo "[closet-api] Running Prisma migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma

echo "[closet-api] Starting API server..."
exec npx tsx src/server.ts
