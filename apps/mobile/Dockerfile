FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json turbo.json ./

# Copy workspace package files
COPY packages/shared/package.json ./packages/shared/
COPY apps/mobile/package.json ./apps/mobile/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/mobile/ ./apps/mobile/

WORKDIR /app/apps/mobile

EXPOSE 8083

CMD ["npx", "expo", "start", "--web", "--port", "8083", "--host", "lan"]
