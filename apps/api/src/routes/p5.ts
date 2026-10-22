import type { FastifyInstance } from 'fastify';
import { weatherRoutes } from './weather.js';
import { planRoutes } from './plans.js';
import { tripRoutes } from './trips.js';

// ---- P5 ----  週穿搭計畫、天氣預報、旅行打包（server.ts 只需註冊這一個）
export async function p5Routes(app: FastifyInstance) {
  await app.register(weatherRoutes);
  await app.register(planRoutes);
  await app.register(tripRoutes);
}
