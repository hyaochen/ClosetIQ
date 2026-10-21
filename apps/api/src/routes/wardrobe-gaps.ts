import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { computeWardrobeGaps } from '../services/wardrobe-gaps.js';

export async function wardrobeGapRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/stats/wardrobe-gaps
  app.get('/api/stats/wardrobe-gaps', async (request, reply) => {
    const items = await prisma.clothingItem.findMany({
      where: { userId: request.user.id, isActive: true },
      select: { category: true, seasons: true, occasions: true },
    });
    const gaps = computeWardrobeGaps(items);
    // 依規格直接回陣列 [{ label, detail, severity, ... }]
    return reply.send(
      gaps.map(({ label, detail, severity, kind, occasion, season, count, min }) => ({
        label, detail, severity, kind, occasion, season, count, min,
      }))
    );
  });
}
