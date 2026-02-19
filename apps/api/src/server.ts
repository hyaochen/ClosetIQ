import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load root .env (two levels up from apps/api/src/)
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { itemRoutes } from './routes/items.js';
import { imageRoutes } from './routes/images.js';
import { outfitRoutes } from './routes/outfits.js';
import { wearLogRoutes } from './routes/wear-logs.js';
import { statsRoutes } from './routes/stats.js';
import { suggestionRoutes } from './routes/suggestions.js';

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
});

async function start() {
  // Plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:8083'],
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(authPlugin);

  // Routes
  await app.register(authRoutes);
  await app.register(itemRoutes);
  await app.register(imageRoutes);
  await app.register(outfitRoutes);
  await app.register(wearLogRoutes);
  await app.register(statsRoutes);
  await app.register(suggestionRoutes);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  const port = parseInt(process.env.API_PORT || '3001');
  const host = process.env.API_HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`伺服器已啟動 http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
