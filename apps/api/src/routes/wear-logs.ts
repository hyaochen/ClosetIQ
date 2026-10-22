import type { FastifyInstance } from 'fastify';
import { createWearLogSchema, AUTO_DIRTY_CATEGORIES } from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import { monthQuerySchema } from '@closet/shared';
import { getJournalMonth } from '../services/journal.service.js';
import { deleteImageFiles } from '../services/image.service.js';

export async function wearLogRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/wear-logs
  app.get('/api/wear-logs', async (request, reply) => {
    // ---- P3 ---- ?month=YYYY-MM returns the whole month grouped by day (calendar / photo wall)
    const rawMonth = (request.query as Record<string, string>).month;
    if (rawMonth !== undefined) {
      const m = monthQuerySchema.safeParse({ month: rawMonth });
      if (!m.success) {
        return reply.status(400).send({ error: 'month 格式需為 YYYY-MM', details: m.error.flatten() });
      }
      return reply.send(await getJournalMonth(request.user.id, m.data.month));
    }

    const { from, to, page = '1', limit = '20' } = request.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: request.user.id };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.wearLog.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
        include: {
          outfit: { select: { id: true, name: true } },
          items: {
            include: {
              clothingItem: {
                include: { images: { where: { isPrimary: true }, take: 1 } },
              },
            },
          },
        },
      }),
      prisma.wearLog.count({ where }),
    ]);

    return reply.send({
      logs,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  });

  // POST /api/wear-logs
  app.post('/api/wear-logs', async (request, reply) => {
    const parsed = createWearLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }

    const { itemIds, ...data } = parsed.data;

    // Verify items belong to user
    const items = await prisma.clothingItem.findMany({
      where: { id: { in: itemIds }, userId: request.user.id },
    });
    if (items.length !== itemIds.length) {
      return reply.status(400).send({ error: '部分衣物不存在或不屬於您' });
    }

    // 穿過自動轉待洗：只動上衣 / 下身 / 洋裝 / 內衣褲
    const me = await prisma.user.findUnique({ where: { id: request.user.id }, select: { autoDirtyOnWear: true } });
    const dirtyIds = me?.autoDirtyOnWear === false
      ? []
      : items.filter((i) => AUTO_DIRTY_CATEGORIES.includes(i.category as any)).map((i) => i.id);

    const [log] = await prisma.$transaction([
      prisma.wearLog.create({
      data: {
        userId: request.user.id,
        outfitId: data.outfitId,
        date: new Date(data.date),
        occasion: data.occasion,
        weatherTemp: data.weatherTemp,
        weatherCondition: data.weatherCondition,
        notes: data.notes,
        items: {
          create: itemIds.map((clothingItemId) => ({ clothingItemId })),
        },
      },
      include: {
        items: {
          include: {
            clothingItem: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
      }),
      prisma.clothingItem.updateMany({
        where: { id: { in: dirtyIds }, userId: request.user.id },
        data: { laundryStatus: 'DIRTY' },
      }),
    ]);

    return reply.status(201).send({ log });
  });

  // DELETE /api/wear-logs/:id
  app.delete('/api/wear-logs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.wearLog.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: '找不到此穿著紀錄' });
    }

    await prisma.wearLog.delete({ where: { id } });
    // ---- P3 ---- remove the OOTD photo files together with the log
    await deleteImageFiles([existing.photoOriginalPath, existing.photoDisplayPath, existing.photoThumbnailPath]);
    return reply.send({ message: '穿著紀錄已刪除' });
  });
}
