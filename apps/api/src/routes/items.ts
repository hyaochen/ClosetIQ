import type { FastifyInstance } from 'fastify';
import { createClothingItemSchema, updateClothingItemSchema, itemsQuerySchema, laundryBatchSchema, bulkMoveSchema, resolveCurrentSeason } from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import { deleteClothingImage } from '../services/image.service.js';

/** 確認 storageLocationId 屬於該使用者 */
async function ownsLocation(userId: string, storageLocationId: string | null | undefined): Promise<boolean> {
  if (!storageLocationId) return true;
  const loc = await prisma.storageLocation.findFirst({ where: { id: storageLocationId, userId }, select: { id: true } });
  return !!loc;
}

/** ---- P2 ---- Drafts (isActive=false and never decluttered) abandoned for over a day are removed with their files. */
async function purgeStaleDrafts(userId: string) {
  const stale = await prisma.clothingItem.findMany({
    where: { userId, isActive: false, declutteredAt: null, createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
    select: { id: true, images: { select: { id: true } } },
  });
  for (const d of stale) {
    for (const img of d.images) await deleteClothingImage(img.id);
    await prisma.clothingItem.delete({ where: { id: d.id } });
  }
}

export async function itemRoutes(app: FastifyInstance) {
  // All item routes require authentication
  app.addHook('onRequest', app.authenticate);

  // GET /api/items - List items with filtering
  app.get('/api/items', async (request, reply) => {
    const parsed = itemsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: '查詢參數錯誤', details: parsed.error.flatten() });
    }

    const { category, colorFamily, season, occasion, condition, search, isActive, storageLocationId, laundryStatus, inSeason, sortBy, sortOrder, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {
      userId: request.user.id,
      isActive,
    };

    if (category) where.category = category;
    if (colorFamily) where.colorFamily = colorFamily;
    if (condition) where.condition = condition;
    if (season) where.seasons = { has: season };
    if (occasion) where.occasions = { has: occasion };
    if (storageLocationId) where.storageLocationId = storageLocationId;
    if (laundryStatus) where.laundryStatus = laundryStatus;
    if (inSeason) {
      const me = await prisma.user.findUnique({ where: { id: request.user.id }, select: { currentSeason: true } });
      const cur = resolveCurrentSeason(me?.currentSeason);
      // 季外 = seasons 非空且不含目前季節
      where.AND = [
        inSeason === 'true'
          ? { OR: [{ seasons: { isEmpty: true } }, { seasons: { has: cur } }] }
          : { AND: [{ seasons: { isEmpty: false } }, { NOT: { seasons: { has: cur } } }] },
      ];
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    // Build orderBy based on sortBy
    let orderBy: any;
    if (sortBy === 'wearCount') {
      // 依穿著次數排序（關聯計數），同次數時新加入的在前
      orderBy = [{ wearLogItems: { _count: sortOrder } }, { createdAt: 'desc' }];
    } else if (sortBy === 'lastWorn') {
      // 需要聚合 - 退回 createdAt，由用戶端處理
      orderBy = { createdAt: sortOrder };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [items, total] = await Promise.all([
      prisma.clothingItem.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          storageLocation: { select: { id: true, name: true, isOffSeason: true } },
          _count: {
            select: { wearLogItems: true },
          },
        },
      }),
      prisma.clothingItem.count({ where }),
    ]);

    return reply.send({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // GET /api/items/brands - Get distinct brands used by this user
  app.get('/api/items/brands', async (request, reply) => {
    const brands = await prisma.clothingItem.groupBy({
      by: ['brand'],
      where: { userId: request.user.id, isActive: true, brand: { not: null } },
      _count: { brand: true },
      orderBy: { _count: { brand: 'desc' } },
    });
    return reply.send(brands.filter(b => b.brand).map(b => b.brand));
  });

  // GET /api/items/materials - Get distinct materials used by this user
  app.get('/api/items/materials', async (request, reply) => {
    const items = await prisma.clothingItem.findMany({
      where: { userId: request.user.id, isActive: true, material: { not: null } },
      select: { material: true },
    });
    const countMap: Record<string, number> = {};
    for (const item of items) {
      if (!item.material) continue;
      const parts = item.material.split('\u3001').map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        countMap[part] = (countMap[part] || 0) + 1;
      }
    }
    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]).map(([name]) => name);
    return reply.send(sorted);
  });

  // GET /api/items/:id - Get single item
  app.get('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await prisma.clothingItem.findFirst({
      where: { id, userId: request.user.id },
      include: {
        images: { orderBy: { isPrimary: 'desc' } },
        storageLocation: { select: { id: true, name: true, isOffSeason: true } },
        _count: { select: { wearLogItems: true } },
        wearLogItems: {
          include: { wearLog: true },
          orderBy: { wearLog: { date: 'desc' } },
          take: 10,
        },
      },
    });

    if (!item) {
      return reply.status(404).send({ error: '找不到此衣物' });
    }

    return reply.send({ item });
  });

  // POST /api/items - Create item (JSON only, images uploaded separately)
  app.post('/api/items', async (request, reply) => {
    const parsed = createClothingItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }

    const data = parsed.data;
    if (!(await ownsLocation(request.user.id, data.storageLocationId))) {
      return reply.status(400).send({ error: '收納位置不存在' });
    }
    if (data.draft) await purgeStaleDrafts(request.user.id);
    const item = await prisma.clothingItem.create({
      data: {
        isActive: !data.draft,
        userId: request.user.id,
        name: data.name,
        category: data.category,
        subcategory: data.subcategory,
        colors: data.colors,
        colorFamily: data.colorFamily,
        pattern: data.pattern,
        material: data.material,
        brand: data.brand,
        size: data.size,
        seasons: data.seasons,
        occasions: data.occasions,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchasePrice: data.purchasePrice,
        purchaseLocation: data.purchaseLocation,
        condition: data.condition,
        notes: data.notes,
        tags: data.tags ?? [],
        laundryStatus: data.laundryStatus,
        storageLocationId: data.storageLocationId ?? null,
      },
      include: { images: true },
    });

    return reply.status(201).send({ item });
  });

  // PUT /api/items/:id - Update item
  app.put('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateClothingItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }

    // Verify ownership
    const existing = await prisma.clothingItem.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: '找不到此衣物' });
    }

    const data = parsed.data;
    if (!(await ownsLocation(request.user.id, data.storageLocationId))) {
      return reply.status(400).send({ error: '收納位置不存在' });
    }
    const { draft, ...rest } = data;
    const updateData: any = { ...rest };
    if (draft === false) updateData.isActive = true; // ---- P2 ---- publish a draft
    if (data.purchaseDate) {
      updateData.purchaseDate = new Date(data.purchaseDate);
    }

    const item = await prisma.clothingItem.update({
      where: { id },
      data: updateData,
      include: { images: true },
    });

    return reply.send({ item });
  });

  // POST /api/items/laundry - 批次改洗衣狀態（單件改狀態走 PUT /api/items/:id 的 laundryStatus）
  app.post('/api/items/laundry', async (request, reply) => {
    const parsed = laundryBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const { itemIds, status } = parsed.data;
    const unique = [...new Set(itemIds)];
    const owned = await prisma.clothingItem.count({ where: { id: { in: unique }, userId: request.user.id } });
    if (owned !== unique.length) {
      return reply.status(400).send({ error: '部分衣物不存在或不屬於您' });
    }
    const result = await prisma.clothingItem.updateMany({
      where: { id: { in: unique }, userId: request.user.id },
      data: { laundryStatus: status },
    });
    return reply.send({ updated: result.count, status });
  });

  // GET /api/items/laundry - 洗衣籃：待洗 + 送洗中
  app.get('/api/items/laundry', async (request, reply) => {
    const items = await prisma.clothingItem.findMany({
      where: { userId: request.user.id, isActive: true, laundryStatus: { in: ['DIRTY', 'CLEANING'] } },
      orderBy: { updatedAt: 'desc' },
      include: { images: { where: { isPrimary: true }, take: 1 } },
    });
    return reply.send({ items });
  });

  // POST /api/items/bulk-move - 批次移動收納位置（storageLocationId 為 null = 取消位置）
  app.post('/api/items/bulk-move', async (request, reply) => {
    const parsed = bulkMoveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const { itemIds, storageLocationId } = parsed.data;
    if (!(await ownsLocation(request.user.id, storageLocationId))) {
      return reply.status(400).send({ error: '收納位置不存在' });
    }
    const unique = [...new Set(itemIds)];
    const owned = await prisma.clothingItem.count({ where: { id: { in: unique }, userId: request.user.id } });
    if (owned !== unique.length) {
      return reply.status(400).send({ error: '部分衣物不存在或不屬於您' });
    }
    const result = await prisma.clothingItem.updateMany({
      where: { id: { in: unique }, userId: request.user.id },
      data: { storageLocationId },
    });
    return reply.send({ moved: result.count });
  });

  // DELETE /api/items/:id - Soft delete (declutter) or hard delete
  app.delete('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { permanent, reason } = request.query as { permanent?: string; reason?: string };

    const existing = await prisma.clothingItem.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: '找不到此衣物' });
    }

    if (permanent === 'true') {
      // ---- P2 ---- remove the image files too (the DB cascade only removes rows)
      const imgs = await prisma.clothingImage.findMany({ where: { clothingItemId: id }, select: { id: true } });
      for (const img of imgs) await deleteClothingImage(img.id);
      await prisma.clothingItem.delete({ where: { id } });
      return reply.send({ message: '衣物已永久刪除' });
    }

    // Soft delete = declutter
    await prisma.clothingItem.update({
      where: { id },
      data: {
        isActive: false,
        declutterReason: reason || null,
        declutteredAt: new Date(),
      },
    });

    return reply.send({ message: '衣物已移至斷捨離' });
  });

  // GET /api/items/:id/similar - Find similar items (duplicate detection)
  app.get('/api/items/:id/similar', async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await prisma.clothingItem.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!item) {
      return reply.status(404).send({ error: '找不到此衣物' });
    }

    const similar = await prisma.clothingItem.findMany({
      where: {
        userId: request.user.id,
        id: { not: id },
        isActive: true,
        category: item.category,
        colorFamily: item.colorFamily,
      },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
      },
      take: 10,
    });

    return reply.send({ similar });
  });
}
