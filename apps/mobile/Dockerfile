# ---- Stage 1: build static web export ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json turbo.json ./

# Copy workspace package files
COPY packages/shared/package.json ./packages/shared/
COPY apps/mobile/package.json ./apps/mobile/

# Install all dependencies (build-time only; not shipped in final image)
RUN npm ci

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/mobile/ ./apps/mobile/

# EXPO_PUBLIC_* vars are inlined into the JS bundle at export time.
# Pass the real API URL via build arg (wired in docker-compose*.yml).
ARG EXPO_PUBLIC_API_URL=http://localhost:3001
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV CI=1

WORKDIR /app/apps/mobile

# --no-minify: expo-modules-core registerWebModule breaks on minified prod
# bundles (SDK 52 known issue: "Module implementation must be a class").
# Unminified bundle is larger but gzip (nginx) keeps transfer size sane.
RUN npx expo export --platform web --no-minify

# ---- Stage 2: serve static files with nginx ----
FROM nginx:1.27-alpine

COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

EXPOSE 8083
