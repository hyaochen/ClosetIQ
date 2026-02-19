import type { FastifyInstance } from 'fastify';
import { createClothingItemSchema, updateClothingItemSchema, itemsQuerySchema } from '@closet/shared';
import { prisma } from '../lib/prisma.js';

export async function itemRoutes(app: FastifyInstance) {
  // All item routes require authentication
  app.addHook('onRequest', app.authenticate);

  // GET /api/items - List items with filtering
  app.get('/api/items', async (request, reply) => {
    const parsed = itemsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: '查詢參數錯誤', details: parsed.error.flatten() });
    }

    const { category, colorFamily, season, occasion, condition, search, isActive, sortBy, sortOrder, page, limit } = parsed.data;
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
    if (sortBy === 'wearCount' || sortBy === 'lastWorn') {
      // These require aggregation - fallback to createdAt, computed on client
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
    const item = await prisma.clothingItem.create({
      data: {
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
    const updateData: any = { ...data };
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
