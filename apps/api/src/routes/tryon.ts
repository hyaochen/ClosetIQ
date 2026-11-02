// ---- T-CL-022 ---- Virtual try-on (local FASHN VTON via the host tryon-bridge). Results are never stored.
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import { storagePath } from '../lib/storage.js';
import {
  tryonStatus,
  isTryonUserAllowed,
  mapCategory,
  garmentSource,
  submitTryonJob,
  getTryonJob,
  getTryonResult,
  userHasActiveTryonJob,
  reserveTryonQuota,
  refundTryonQuota,
  tryonDailyLimit,
  TryonError,
} from '../services/tryon.service.js';
import { cutoutForTryon } from '../services/cutout.service.js';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_EDGE = 1536;

export async function tryonRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/tryon/status - the item page only shows the try-on entry when enabled
  app.get('/api/tryon/status', async (request, reply) => reply.send(await tryonStatus(request.user.id)));

  // POST /api/tryon  multipart: "itemId" field + "file" (full-body photo). Responds 202 { jobId }; poll /api/tryon/jobs/:id, fetch /result when done.
  app.post('/api/tryon', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!isTryonUserAllowed(request.user.id)) return reply.status(403).send({ error: '此帳號未開放虛擬試穿' });
    if (!request.isMultipart()) return reply.status(400).send({ error: '請上傳全身照' });

    // 1. Read the parts (validate before spending quota)
    let itemId = '';
    let photo: Buffer | null = null;
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'file') {
          await part.toBuffer();
          continue;
        }
        if (!ALLOWED_MIMES.includes(part.mimetype)) {
          return reply.status(400).send({ error: '不支援此圖片格式，請使用 JPEG、PNG、WebP 或 HEIC' });
        }
        photo = await part.toBuffer();
      } else if (part.fieldname === 'itemId') {
        itemId = String(part.value ?? '').trim();
      }
    }
    if (!photo || photo.length === 0) return reply.status(400).send({ error: '請上傳全身照' });
    if (!itemId) return reply.status(400).send({ error: '請指定衣物' });

    const item = await prisma.clothingItem.findUnique({
      where: { id: itemId },
      include: { images: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
    });
    if (!item || item.userId !== request.user.id) return reply.status(404).send({ error: '找不到此衣物' });

    const category = mapCategory(item.category);
    if (!category) return reply.status(400).send({ error: '此類衣物暫不支援試穿（目前支援上衣、外套、下身、洋裝）' });

    const image = item.images[0];
    if (!image) return reply.status(400).send({ error: '此衣物沒有照片' });
    const source = garmentSource(image);

    let garment: Buffer;
    let person: Buffer;
    try {
      garment = await fs.readFile(path.join(storagePath(), 'stored' in source ? source.stored : source.fallback));
    } catch {
      return reply.status(404).send({ error: '衣物圖片檔案不存在' });
    }
    try {
      // upright, bounded size, JPEG: keeps the bridge payload small
      person = await sharp(photo)
        .rotate()
        .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#FFFFFF' })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      return reply.status(400).send({ error: '無法讀取此圖片' });
    }
    photo = null;

    // 2. One job in flight per user (checked before spending quota)
    if (userHasActiveTryonJob(request.user.id)) {
      return reply.status(409).send({ error: '你已有一張試穿正在進行，請等它完成後再試' });
    }
    if ('live' in source) garment = (await cutoutForTryon(source.live)) ?? garment;

    // 3. Daily quota (counted at submit; refunded if the bridge call later fails)
    const used = await reserveTryonQuota(request.user.id);
    const limit = tryonDailyLimit();
    if (used === null) {
      return reply.status(429).send({ error: `今日虛擬試穿次數已用完（上限 ${limit} 次）`, quota: { limit, used: limit, remaining: 0 } });
    }

    // 4. Hand the job to the background worker and answer at once (Cloudflare cuts requests at 100 s)
    try {
      const userId = request.user.id;
      const jobId = submitTryonJob(userId, person, garment, category, () => refundTryonQuota(userId));
      reply.header('Cache-Control', 'no-store');
      return reply.status(202).send({ jobId, quota: { limit, used, remaining: Math.max(0, limit - used) } });
    } catch (err: any) {
      await refundTryonQuota(request.user.id);
      if (err instanceof TryonError) return reply.status(err.status).send({ error: err.message });
      request.log.error({ err: err?.message }, 'tryon submit failed');
      return reply.status(500).send({ error: '虛擬試穿暫時失敗，請稍後再試' });
    }
  });

  // GET /api/tryon/jobs/:id  -> { status, error?, queuePosition?, elapsedMs }; 404 for unknown, expired or someone else's job
  app.get('/api/tryon/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const view = getTryonJob(request.user.id, id);
    if (!view) return reply.status(404).send({ error: '找不到此試穿結果，請重新試穿' });
    reply.header('Cache-Control', 'no-store');
    return reply.send(view);
  });

  // GET /api/tryon/jobs/:id/result -> the composite PNG (409 while not finished)
  app.get('/api/tryon/jobs/:id/result', async (request, reply) => {
    const { id } = request.params as { id: string };
    const r = getTryonResult(request.user.id, id);
    if (r === null) return reply.status(404).send({ error: '找不到此試穿結果，請重新試穿' });
    if (r === 'notready') return reply.status(409).send({ error: '試穿尚未完成' });
    reply.header('Cache-Control', 'no-store');
    return reply.type('image/png').send(r);
  });
}
