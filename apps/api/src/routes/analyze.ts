// ---- P2 ---- POST /api/items/analyze: AI suggestions for a new item (never writes to the DB item tables)
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { analyzeByImageIdSchema } from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import {
  getProvider,
  prepareImage,
  sanitizeSuggestion,
  estimateCostUsd,
  reserveQuota,
  refundQuota,
  recordTokens,
  dailyLimit,
  analyzeStatus,
} from '../services/ai/index.js';

const STORAGE_PATH = () => process.env.IMAGE_STORAGE_PATH || './data/images';
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export async function analyzeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/items/analyze/status - the frontend only looks at this to decide whether to show the AI block
  app.get('/api/items/analyze/status', async (_request, reply) => reply.send(analyzeStatus()));

  // Input (one of):
  //   multipart/form-data with a "file" field (photo taken but not yet saved as an item image)
  //   application/json {"imageId": "<uuid>"} (an already uploaded image owned by the caller)
  app.post('/api/items/analyze', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const provider = getProvider();
    if (!provider) return reply.status(503).send({ error: 'AI 辨識未設定（缺少 ANTHROPIC_API_KEY）' });

    // 1. Load the image bytes (validate before spending quota)
    let source: Buffer;
    if (request.isMultipart()) {
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: '請上傳圖片' });
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        return reply.status(400).send({ error: '不支援此圖片格式，請使用 JPEG、PNG、WebP 或 HEIC' });
      }
      source = await file.toBuffer();
    } else {
      const parsed = analyzeByImageIdSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: '請提供 imageId 或上傳圖片' });
      const image = await prisma.clothingImage.findUnique({
        where: { id: parsed.data.imageId },
        include: { clothingItem: { select: { userId: true } } },
      });
      if (!image || image.clothingItem.userId !== request.user.id) {
        return reply.status(404).send({ error: '找不到此圖片' });
      }
      try {
        source = await fs.readFile(path.join(STORAGE_PATH(), image.originalPath));
      } catch {
        return reply.status(404).send({ error: '圖片檔案不存在' });
      }
    }

    let prepared: Buffer;
    try {
      prepared = await prepareImage(source);
    } catch {
      return reply.status(400).send({ error: '無法讀取此圖片' });
    }

    // 2. Daily quota
    const used = await reserveQuota(request.user.id);
    const limit = dailyLimit();
    if (used === null) {
      return reply.status(429).send({ error: `今日 AI 辨識次數已用完（上限 ${limit} 次）`, quota: { limit, used: limit, remaining: 0 } });
    }

    // 3. Provider call; a failed call does not consume quota
    try {
      const result = await provider.analyze(prepared);
      const suggestion = sanitizeSuggestion(result.raw);
      await recordTokens(request.user.id, result.usage.inputTokens, result.usage.outputTokens);
      return reply.send({
        provider: provider.name,
        model: provider.model,
        suggestion,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedCostUsd: Math.round(estimateCostUsd(result.usage.inputTokens, result.usage.outputTokens) * 1e6) / 1e6,
        },
        quota: { limit, used, remaining: Math.max(0, limit - used) },
      });
    } catch (err: any) {
      await refundQuota(request.user.id);
      request.log.error({ err: err?.message }, 'AI analyze failed');
      return reply.status(502).send({ error: 'AI 辨識暫時失敗，請稍後再試或手動填寫' });
    }
  });
}
