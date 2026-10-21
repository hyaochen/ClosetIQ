import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  createWishlistItemSchema,
  updateWishlistItemSchema,
  wishlistQuerySchema,
  purchaseWishlistItemSchema,
} from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import { processAndSaveImage } from '../services/image.service.js';
import { analyzeCandidate, type WardrobeItem } from '../services/wishlist-analysis.js';

const STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || './data/images';
const ALL_SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
const RECENT_DAYS = 90;

type WishRow = NonNullable<Awaited<ReturnType<typeof prisma.wishlistItem.findFirst>>>;

function present(w: WishRow) {
  return { ...w, price: w.price === null ? null : Number(w.price) };
}

async function removeFiles(paths: Array<string | null | undefined>) {
  for (const p of paths) {
    if (!p) continue;
    try {
      await fs.unlink(path.join(STORAGE_PATH, p));
    } catch {
      /* 檔案可能已不存在 */
    }
  }
}

export async function wishlistRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/wishlist?status=WANT&category=TOP
  app.get('/api/wishlist', async (request, reply) => {
    const parsed = wishlistQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: '查詢參數錯誤', details: parsed.error.flatten() });
    }
    const where: any = { userId: request.user.id };
    if (parsed.data.status) where.status = parsed.data.status;
    if (parsed.data.category) where.category = parsed.data.category;
    const rows = await prisma.wishlistItem.findMany({ where, orderBy: { createdAt: 'desc' } });
    return reply.send({ items: rows.map(present) });
  });

  // POST /api/wishlist
  app.post('/api/wishlist', async (request, reply) => {
    const parsed = createWishlistItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const row = await prisma.wishlistItem.create({
      data: {
        userId: request.user.id,
        name: d.name,
        category: d.category,
        subcategory: d.subcategory,
        colorFamily: d.colorFamily,
        colors: d.colors,
        pattern: d.pattern,
        seasons: d.seasons,
        occasions: d.occasions,
        price: d.price,
        url: d.url,
        note: d.note,
      },
    });
    return reply.status(201).send({ item: present(row) });
  });

  // GET /api/wishlist/:id
  app.get('/api/wishlist/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.wishlistItem.findFirst({ where: { id, userId: request.user.id } });
    if (!row) return reply.status(404).send({ error: '找不到此願望清單項目' });
    return reply.send({ item: present(row) });
  });

  // PUT /api/wishlist/:id  (含 status: WANT / DROPPED)
  app.put('/api/wishlist/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateWishlistItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const existing = await prisma.wishlistItem.findFirst({ where: { id, userId: request.user.id } });
    if (!existing) return reply.status(404).send({ error: '找不到此願望清單項目' });
    if (existing.status === 'BOUGHT') {
      return reply.status(409).send({ error: '已買入的項目不能再修改，請到衣櫃編輯' });
    }
    const row = await prisma.wishlistItem.update({ where: { id }, data: parsed.data });
    return reply.send({ item: present(row) });
  });

  // POST /api/wishlist/:id/drop  -- 不買了（保留紀錄）
  app.post('/api/wishlist/:id/drop', async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await prisma.wishlistItem.updateMany({
      where: { id, userId: request.user.id, status: 'WANT' },
      data: { status: 'DROPPED' },
    });
    if (res.count === 0) {
      const exists = await prisma.wishlistItem.findFirst({ where: { id, userId: request.user.id } });
      if (!exists) return reply.status(404).send({ error: '找不到此願望清單項目' });
      return reply.status(409).send({ error: '只有「想買」狀態的項目可以標記為不買了' });
    }
    const row = await prisma.wishlistItem.findUniqueOrThrow({ where: { id } });
    return reply.send({ item: present(row) });
  });

  // DELETE /api/wishlist/:id  -- 真的刪掉（含願望清單自己的圖片）
  app.delete('/api/wishlist/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.wishlistItem.findFirst({ where: { id, userId: request.user.id } });
    if (!row) return reply.status(404).send({ error: '找不到此願望清單項目' });
    await prisma.wishlistItem.delete({ where: { id } });
    await removeFiles([row.imageOriginalPath, row.imageDisplayPath, row.imageThumbnailPath]);
    return reply.send({ message: '已從願望清單刪除' });
  });

  // POST /api/wishlist/:id/image  (multipart, 欄位任意，取第一個檔)
  app.post('/api/wishlist/:id/image', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.wishlistItem.findFirst({ where: { id, userId: request.user.id } });
    if (!row) return reply.status(404).send({ error: '找不到此願望清單項目' });

    const file = await request.file();
    if (!file) return reply.status(400).send({ error: '請上傳圖片' });
    const buffer = await file.toBuffer();

    try {
      // 沿用 sharp 管線；以 "<userId>/wishlist" 當根目錄 -> <userId>/wishlist/{original,display,thumbnail}/
      const paths = await processAndSaveImage(buffer, file.mimetype, `${request.user.id}/wishlist`);
      const updated = await prisma.wishlistItem.update({
        where: { id },
        data: {
          imageOriginalPath: paths.originalPath,
          imageDisplayPath: paths.displayPath,
          imageThumbnailPath: paths.thumbnailPath,
        },
      });
      await removeFiles([row.imageOriginalPath, row.imageDisplayPath, row.imageThumbnailPath]);
      return reply.status(201).send({ item: present(updated) });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/wishlist/:id/purchase  -- 買了，移進衣櫃（單一 transaction）
  app.post('/api/wishlist/:id/purchase', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = purchaseWishlistItemSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const extra = parsed.data;
    const userId = request.user.id;

    const wish = await prisma.wishlistItem.findFirst({ where: { id, userId } });
    if (!wish) return reply.status(404).send({ error: '找不到此願望清單項目' });
    if (wish.status !== 'WANT') {
      return reply.status(409).send({ error: '只有「想買」狀態的項目可以移進衣櫃' });
    }

    // 複製圖片檔：衣櫃圖片與願望清單圖片互不相依，之後刪願望清單不會弄壞衣物圖
    let copied: { originalPath: string; displayPath: string; thumbnailPath: string } | null = null;
    if (wish.imageOriginalPath && wish.imageDisplayPath && wish.imageThumbnailPath) {
      const uid = randomUUID();
      const targets = {
        originalPath: `${userId}/original/${uid}-original.webp`,
        displayPath: `${userId}/display/${uid}-display.webp`,
        thumbnailPath: `${userId}/thumbnail/${uid}-thumbnail.webp`,
      };
      try {
        for (const dir of ['original', 'display', 'thumbnail']) {
          await fs.mkdir(path.join(STORAGE_PATH, userId, dir), { recursive: true });
        }
        await fs.copyFile(path.join(STORAGE_PATH, wish.imageOriginalPath), path.join(STORAGE_PATH, targets.originalPath));
        await fs.copyFile(path.join(STORAGE_PATH, wish.imageDisplayPath), path.join(STORAGE_PATH, targets.displayPath));
        await fs.copyFile(path.join(STORAGE_PATH, wish.imageThumbnailPath), path.join(STORAGE_PATH, targets.thumbnailPath));
        copied = targets;
      } catch {
        await removeFiles(Object.values(targets));
        copied = null; // 原圖遺失就不帶圖，仍完成移入
      }
    }

    try {
      const item = await prisma.$transaction(async (tx) => {
        // 以條件式更新擋掉併發重複購買
        const claimed = await tx.wishlistItem.updateMany({
          where: { id, userId, status: 'WANT' },
          data: { status: 'BOUGHT' },
        });
        if (claimed.count === 0) throw new Error('ALREADY_PROCESSED');

        const created = await tx.clothingItem.create({
          data: {
            userId,
            name: wish.name,
            category: wish.category,
            subcategory: wish.subcategory,
            colors: wish.colors,
            colorFamily: wish.colorFamily,
            pattern: wish.pattern ?? 'SOLID',
            brand: extra.brand,
            size: extra.size,
            material: extra.material,
            seasons: extra.seasons ?? (wish.seasons.length ? wish.seasons : ALL_SEASONS),
            occasions: extra.occasions ?? (wish.occasions.length ? wish.occasions : ['CASUAL']),
            purchaseDate: extra.purchaseDate ? new Date(extra.purchaseDate) : new Date(),
            purchasePrice: extra.purchasePrice ?? (wish.price === null ? null : wish.price),
            purchaseLocation: extra.purchaseLocation,
            condition: extra.condition ?? 'NEW',
            notes: wish.note,
            tags: [],
            ...(copied ? { images: { create: { ...copied, isPrimary: true } } } : {}),
          },
          include: { images: true },
        });

        await tx.wishlistItem.update({ where: { id }, data: { boughtItemId: created.id } });
        return created;
      });

      const updatedWish = await prisma.wishlistItem.findUniqueOrThrow({ where: { id } });
      return reply.status(201).send({ item, wishlistItem: present(updatedWish) });
    } catch (err: any) {
      if (copied) await removeFiles(Object.values(copied));
      if (err?.message === 'ALREADY_PROCESSED') {
        return reply.status(409).send({ error: '此項目已被處理' });
      }
      throw err;
    }
  });

  // GET /api/wishlist/:id/analysis  -- 購前分析
  app.get('/api/wishlist/:id/analysis', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const wish = await prisma.wishlistItem.findFirst({ where: { id, userId } });
    if (!wish) return reply.status(404).send({ error: '找不到此願望清單項目' });

    const since = new Date();
    since.setDate(since.getDate() - RECENT_DAYS);

    const rows = await prisma.clothingItem.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true,
        colorFamily: true,
        pattern: true,
        seasons: true,
        occasions: true,
        images: { where: { isPrimary: true }, take: 1, select: { thumbnailPath: true } },
        _count: { select: { wearLogItems: true } },
        wearLogItems: {
          where: { wearLog: { date: { gte: since } } },
          select: { id: true },
        },
      },
    });

    const thumbs = new Map<string, string | null>();
    const wardrobe: WardrobeItem[] = rows.map((r) => {
      thumbs.set(r.id, r.images[0]?.thumbnailPath ?? null);
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        subcategory: r.subcategory,
        colorFamily: r.colorFamily,
        pattern: r.pattern,
        seasons: r.seasons,
        occasions: r.occasions,
        recentWearCount: r.wearLogItems.length,
        totalWearCount: r._count.wearLogItems,
      };
    });

    const result = analyzeCandidate(
      {
        category: wish.category,
        subcategory: wish.subcategory,
        colorFamily: wish.colorFamily,
        pattern: wish.pattern,
        seasons: wish.seasons,
        occasions: wish.occasions,
      },
      wardrobe
    );

    return reply.send({
      compatibleCount: result.compatibleCount,
      totalConsidered: result.totalConsidered,
      byCategory: result.byCategory,
      similarItems: result.similarItems.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        subcategory: s.subcategory,
        colorFamily: s.colorFamily,
        matchType: s.matchType,
        thumbnail: thumbs.get(s.id) ?? null,
        recentWearCount: s.recentWearCount,
        totalWearCount: s.totalWearCount,
      })),
      score: result.score,
      reasons: result.reasons,
      filledGaps: result.filledGaps.map((g) => g.label),
    });
  });
}
