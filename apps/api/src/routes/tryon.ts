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
  runTryon,
  reserveTryonQuota,
  refundTryonQuota,
  tryonDailyLimit,
  TryonError,
} from '../services/tryon.service.js';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_EDGE = 1536;

export async function tryonRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/tryon/status - the item page only shows the try-on entry when enabled
  app.get('/api/tryon/status', async (request, reply) => reply.send(await tryonStatus(request.user.id)));

  // POST /api/tryon  multipart: "itemId" field + "file" (full-body photo). Responds with the composite PNG.
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
    const garmentRel = image.cutoutStatus === 'DONE' && image.cutoutPath ? image.cutoutPath : image.displayPath;

    let garment: Buffer;
    let person: Buffer;
    try {
      garment = await fs.readFile(path.join(storagePath(), garmentRel));
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

    // 2. Daily quota
    const used = await reserveTryonQuota(request.user.id);
    const limit = tryonDailyLimit();
    if (used === null) {
      return reply.status(429).send({ error: `今日虛擬試穿次數已用完（上限 ${limit} 次）`, quota: { limit, used: limit, remaining: 0 } });
    }

    // 3. Bridge call; a failed call does not consume quota
    try {
      const png = await runTryon(person, garment, category);
      reply.header('Cache-Control', 'no-store');
      reply.header('X-Tryon-Remaining', String(Math.max(0, limit - used)));
      return reply.type('image/png').send(png);
    } catch (err: any) {
      await refundTryonQuota(request.user.id);
      request.log.error({ err: err?.message }, 'tryon failed');
      if (err instanceof TryonError && err.status === 429) {
        return reply.status(503).send({ error: '試穿服務忙碌中，請稍後再試' });
      }
      if (err instanceof TryonError && err.status === 400) {
        return reply.status(400).send({ error: '這張照片無法用於試穿，請換一張清楚的全身照' });
      }
      return reply.status(502).send({ error: '虛擬試穿暫時失敗，請稍後再試' });
    }
  });
}
