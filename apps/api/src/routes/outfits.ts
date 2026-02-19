import type { FastifyInstance } from 'fastify';
import { createOutfitSchema, updateOutfitSchema } from '@closet/shared';
import { prisma } from '../lib/prisma.js';

export async function outfitRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/outfits
  app.get('/api/outfits', async (request, reply) => {
    const outfits = await prisma.outfit.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            clothingItem: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
          orderBy: { layerOrder: 'asc' },
        },
        _count: { select: { wearLogs: true } },
      },
    });

    return reply.send({ outfits });
  });

  // GET /api/outfits/:id
  app.get('/api/outfits/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const outfit = await prisma.outfit.findFirst({
      where: { id, userId: request.user.id },
      include: {
        items: {
          include: {
            clothingItem: {
              include: { images: true },
            },
          },
          orderBy: { layerOrder: 'asc' },
        },
        wearLogs: { orderBy: { date: 'desc' }, take: 10 },
      },
    });

    if (!outfit) {
      return reply.status(404).send({ error: '找不到此穿搭' });
    }

    return reply.send({ outfit });
  });

  // POST /api/outfits
  app.post('/api/outfits', async (request, reply) => {
    const parsed = createOutfitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }

    const { itemIds, ...data } = parsed.data;

    // Verify all items belong to user
    const items = await prisma.clothingItem.findMany({
      where: { id: { in: itemIds }, userId: request.user.id },
    });
    if (items.length !== itemIds.length) {
      return reply.status(400).send({ error: '部分衣物不存在或不屬於您' });
    }

    const outfit = await prisma.outfit.create({
      data: {
        userId: request.user.id,
        name: data.name,
        occasions: data.occasions,
        seasons: data.seasons,
        rating: data.rating,
        notes: data.notes,
        items: {
          create: itemIds.map((clothingItemId, index) => ({
            clothingItemId,
            layerOrder: index,
          })),
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
    });

    return reply.status(201).send({ outfit });
  });

  // PUT /api/outfits/:id
  app.put('/api/outfits/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateOutfitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }

    const existing = await prisma.outfit.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: '找不到此穿搭' });
    }

    const { itemIds, ...data } = parsed.data;

    await prisma.$transaction(async (tx) => {
      // Update outfit metadata
      await tx.outfit.update({
        where: { id },
        data: {
          name: data.name,
          occasions: data.occasions,
          seasons: data.seasons,
          rating: data.rating,
          notes: data.notes,
        },
      });

      // Update items if provided
      if (itemIds) {
        await tx.outfitItem.deleteMany({ where: { outfitId: id } });
        await tx.outfitItem.createMany({
          data: itemIds.map((clothingItemId, index) => ({
            outfitId: id,
            clothingItemId,
            layerOrder: index,
          })),
        });
      }
    });

    const outfit = await prisma.outfit.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            clothingItem: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
    });

    return reply.send({ outfit });
  });

  // DELETE /api/outfits/:id
  app.delete('/api/outfits/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.outfit.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: '找不到此穿搭' });
    }

    await prisma.outfit.delete({ where: { id } });
    return reply.send({ message: '穿搭已刪除' });
  });
}
