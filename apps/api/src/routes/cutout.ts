// ---- P2 ---- Cutout (background removal) endpoints
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  cutoutEnabled,
  runCutout,
  startBackfill,
  cancelBackfill,
  getBackfillJob,
  countBackfillRemaining,
} from '../services/cutout.service.js';

const backfillSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const imageSelect = {
  id: true,
  clothingItemId: true,
  cutoutPath: true,
  cutoutThumbPath: true,
  cutoutStatus: true,
  cutoutError: true,
  cutoutAt: true,
} as const;

async function findOwnImage(imageId: string, userId: string) {
  const image = await prisma.clothingImage.findUnique({
    where: { id: imageId },
    include: { clothingItem: { select: { userId: true } } },
  });
  if (!image || image.clothingItem.userId !== userId) return null;
  return image;
}

export async function cutoutRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/images/:imageId/cutout - Status (poll this after upload while status is PENDING)
  app.get('/api/images/:imageId/cutout', async (request, reply) => {
    const { imageId } = request.params as { imageId: string };
    const own = await findOwnImage(imageId, request.user.id);
    if (!own) return reply.status(404).send({ error: '找不到此圖片' });
    const image = await prisma.clothingImage.findUnique({ where: { id: imageId }, select: imageSelect });
    return reply.send({ image, enabled: cutoutEnabled() });
  });

  // POST /api/images/:imageId/cutout - Re-run background removal
  //   ?wait=true  -> hold the request until finished (<= CUTOUT_TIMEOUT_MS) and return the final state
  //   default     -> 202 immediately, poll GET for the result
  app.post('/api/images/:imageId/cutout', async (request, reply) => {
    const { imageId } = request.params as { imageId: string };
    const own = await findOwnImage(imageId, request.user.id);
    if (!own) return reply.status(404).send({ error: '找不到此圖片' });
    if (!cutoutEnabled()) return reply.status(503).send({ error: '去背服務未啟用' });

    const wait = (request.query as any).wait === 'true';
    await prisma.clothingImage.update({
      where: { id: imageId },
      data: { cutoutStatus: 'PENDING', cutoutError: null },
    });
    const job = runCutout(imageId);
    if (!wait) return reply.status(202).send({ image: { id: imageId, cutoutStatus: 'PENDING' } });

    await job;
    const image = await prisma.clothingImage.findUnique({ where: { id: imageId }, select: imageSelect });
    return reply.send({ image });
  });

  // GET /api/images/cutout/backfill - Progress of the caller's backfill job + how many are left
  app.get('/api/images/cutout/backfill', async (request, reply) => {
    return reply.send({
      enabled: cutoutEnabled(),
      job: getBackfillJob(request.user.id),
      remaining: await countBackfillRemaining(request.user.id),
    });
  });

  // POST /api/images/cutout/backfill - Cut out the caller's older photos, newest first.
  // Sequential (one rembg call at a time), capped per call, rate limited to 3 calls / minute.
  app.post('/api/images/cutout/backfill', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (!cutoutEnabled()) return reply.status(503).send({ error: '去背服務未啟用' });
    const parsed = backfillSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: '參數錯誤', details: parsed.error.flatten() });

    const job = await startBackfill(request.user.id, parsed.data.limit);
    return reply.status(202).send({ job, remaining: await countBackfillRemaining(request.user.id) });
  });

  // POST /api/images/cutout/backfill/cancel - Stop after the image currently being processed
  app.post('/api/images/cutout/backfill/cancel', async (request, reply) => {
    const ok = cancelBackfill(request.user.id);
    return reply.send({ cancelled: ok, job: getBackfillJob(request.user.id) });
  });
}
