import type { FastifyInstance } from 'fastify';
import { updateWearLogSchema, wearLogPhotoCreateQuerySchema, AUTO_DIRTY_CATEGORIES } from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import { dayStringToDate, taipeiToday } from '../lib/taipei-date.js';
import { deleteImageFiles, processAndSaveImage } from '../services/image.service.js';
import { journalLogInclude, toJournalLog } from '../services/journal.service.js';

// ---- P3 ----
// OOTD photo diary: one full-body photo per wear log (stored under <userId>/ootd/).
//
// Same-day rule for the photo-first flow (POST /api/wear-logs/photo):
//   1. a log of that day that already has a photo (earliest createdAt)  -> photo is replaced (retake)
//   2. else the earliest log of that day without a photo               -> photo is attached
//   3. else a new empty wear log (no items yet) is created
// So "photograph today's outfit" never piles up duplicate logs. To attach a photo to one specific
// log of a multi-log day, use POST /api/wear-logs/:id/photo.

const OOTD_OPTIONS = { subdir: 'ootd', thumbnail: { width: 300, height: 400 } } as const;

async function readPhotoUpload(request: any) {
  const file = await request.file();
  if (!file) return { error: '請上傳圖片' as const };
  try {
    const buffer: Buffer = await file.toBuffer();
    return { buffer, mimetype: file.mimetype as string };
  } catch {
    return { error: '圖片大小不可超過 10MB' as const, status: 413 };
  }
}

async function savePhotoToLog(
  logId: string,
  userId: string,
  buffer: Buffer,
  mimetype: string
) {
  const old = await prisma.wearLog.findUnique({
    where: { id: logId },
    select: { photoOriginalPath: true, photoDisplayPath: true, photoThumbnailPath: true },
  });
  const paths = await processAndSaveImage(buffer, mimetype, userId, OOTD_OPTIONS);
  const log = await prisma.wearLog.update({
    where: { id: logId },
    data: {
      photoOriginalPath: paths.originalPath,
      photoDisplayPath: paths.displayPath,
      photoThumbnailPath: paths.thumbnailPath,
      photoUpdatedAt: new Date(),
    },
    include: journalLogInclude,
  });
  if (old) await deleteImageFiles([old.photoOriginalPath, old.photoDisplayPath, old.photoThumbnailPath]);
  return log;
}

export async function journalRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // POST /api/wear-logs/photo?date=YYYY-MM-DD  (multipart, field "file"; date defaults to today in Taipei)
  app.post('/api/wear-logs/photo', async (request, reply) => {
    const q = wearLogPhotoCreateQuerySchema.safeParse(request.query);
    if (!q.success) {
      return reply.status(400).send({ error: '日期格式需為 YYYY-MM-DD', details: q.error.flatten() });
    }
    const userId = request.user.id;
    const day = q.data.date ?? taipeiToday();

    const upload = await readPhotoUpload(request);
    if ('error' in upload) return reply.status(upload.status ?? 400).send({ error: upload.error });

    const dayLogs = await prisma.wearLog.findMany({
      where: { userId, date: dayStringToDate(day) },
      orderBy: { createdAt: 'asc' },
      select: { id: true, photoDisplayPath: true },
    });
    let target = dayLogs.find((l) => l.photoDisplayPath) ?? dayLogs[0];
    let created = false;
    if (!target) {
      const fresh = await prisma.wearLog.create({
        data: { userId, date: dayStringToDate(day) },
        select: { id: true, photoDisplayPath: true },
      });
      target = fresh;
      created = true;
    }

    try {
      const log = await savePhotoToLog(target.id, userId, upload.buffer, upload.mimetype);
      return reply.status(created ? 201 : 200).send({ log: toJournalLog(log), created });
    } catch (err: any) {
      // Do not leave an empty log behind when the image was rejected
      if (created) await prisma.wearLog.delete({ where: { id: target.id } }).catch(() => undefined);
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/wear-logs/:id/photo  (multipart, field "file"; upload or replace)
  app.post('/api/wear-logs/:id/photo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    const existing = await prisma.wearLog.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: '找不到此穿著紀錄' });

    const upload = await readPhotoUpload(request);
    if ('error' in upload) return reply.status(upload.status ?? 400).send({ error: upload.error });

    try {
      const log = await savePhotoToLog(id, userId, upload.buffer, upload.mimetype);
      return reply.send({ log: toJournalLog(log) });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // DELETE /api/wear-logs/:id/photo
  app.delete('/api/wear-logs/:id/photo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.wearLog.findFirst({
      where: { id, userId: request.user.id },
      select: { photoOriginalPath: true, photoDisplayPath: true, photoThumbnailPath: true },
    });
    if (!existing) return reply.status(404).send({ error: '找不到此穿著紀錄' });

    const log = await prisma.wearLog.update({
      where: { id },
      data: { photoOriginalPath: null, photoDisplayPath: null, photoThumbnailPath: null, photoUpdatedAt: null },
      include: journalLogInclude,
    });
    await deleteImageFiles([existing.photoOriginalPath, existing.photoDisplayPath, existing.photoThumbnailPath]);
    return reply.send({ log: toJournalLog(log) });
  });

  // PATCH /api/wear-logs/:id  (fill in items / details later, e.g. after a photo-first log)
  app.patch('/api/wear-logs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    const parsed = updateWearLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式有誤', details: parsed.error.flatten() });
    }
    const { itemIds, ...fields } = parsed.data;

    const existing = await prisma.wearLog.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: '找不到此穿著紀錄' });

    if (itemIds) {
      const uniq = [...new Set(itemIds)];
      const owned = await prisma.clothingItem.count({ where: { id: { in: uniq }, userId } });
      if (owned !== uniq.length) {
        return reply.status(400).send({ error: '部分衣物不存在或不屬於你' });
      }
    }
    if (fields.outfitId) {
      const outfit = await prisma.outfit.findFirst({ where: { id: fields.outfitId, userId }, select: { id: true } });
      if (!outfit) return reply.status(400).send({ error: '找不到此穿搭' });
    }

    const log = await prisma.$transaction(async (tx) => {
      if (itemIds) {
        const before = await tx.wearLogItem.findMany({ where: { wearLogId: id }, select: { clothingItemId: true } });
        const beforeIds = new Set(before.map((b) => b.clothingItemId));
        await tx.wearLogItem.deleteMany({ where: { wearLogId: id } });
        const uniq = [...new Set(itemIds)];
        if (uniq.length > 0) {
          await tx.wearLogItem.createMany({
            data: uniq.map((clothingItemId) => ({ wearLogId: id, clothingItemId })),
          });
        }
        // 新加入的衣物套用與建立紀錄相同的自動待洗規則；原本就在的與被移除的不動
        const me = await tx.user.findUnique({ where: { id: userId }, select: { autoDirtyOnWear: true } });
        if (me?.autoDirtyOnWear !== false) {
          const added = uniq.filter((x) => !beforeIds.has(x));
          if (added.length > 0) {
            await tx.clothingItem.updateMany({
              where: { id: { in: added }, userId, category: { in: [...AUTO_DIRTY_CATEGORIES] as any } },
              data: { laundryStatus: 'DIRTY' },
            });
          }
        }
      }
      return tx.wearLog.update({ where: { id }, data: fields, include: journalLogInclude });
    });

    return reply.send({ log: toJournalLog(log) });
  });
}
