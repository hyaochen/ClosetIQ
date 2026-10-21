import type { FastifyInstance } from 'fastify';
import { createStorageLocationSchema, updateStorageLocationSchema } from '@closet/shared';
import { prisma } from '../lib/prisma.js';

export async function storageLocationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/storage-locations - 含每處衣物數量（只算未斷捨離）
  app.get('/api/storage-locations', async (request, reply) => {
    const userId = request.user.id;
    const [locations, counts, unassigned] = await Promise.all([
      prisma.storageLocation.findMany({ where: { userId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      prisma.clothingItem.groupBy({
        by: ['storageLocationId'],
        where: { userId, isActive: true, storageLocationId: { not: null } },
        _count: { _all: true },
      }),
      prisma.clothingItem.count({ where: { userId, isActive: true, storageLocationId: null } }),
    ]);
    const countMap = new Map(counts.map((c) => [c.storageLocationId, c._count._all]));
    return reply.send({
      locations: locations.map((l) => ({ ...l, itemCount: countMap.get(l.id) ?? 0 })),
      unassignedCount: unassigned,
    });
  });

  // POST /api/storage-locations
  app.post('/api/storage-locations', async (request, reply) => {
    const parsed = createStorageLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const userId = request.user.id;
    const last = await prisma.storageLocation.findFirst({ where: { userId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const location = await prisma.storageLocation.create({
      data: {
        userId,
        name: parsed.data.name,
        isOffSeason: parsed.data.isOffSeason,
        sortOrder: parsed.data.sortOrder ?? (last ? last.sortOrder + 1 : 0),
      },
    });
    return reply.status(201).send({ location: { ...location, itemCount: 0 } });
  });

  // PUT /api/storage-locations/:id
  app.put('/api/storage-locations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateStorageLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const existing = await prisma.storageLocation.findFirst({ where: { id, userId: request.user.id } });
    if (!existing) return reply.status(404).send({ error: '找不到此收納位置' });
    const location = await prisma.storageLocation.update({ where: { id }, data: parsed.data });
    return reply.send({ location });
  });

  // DELETE /api/storage-locations/:id - 衣物的位置會被清空（SetNull），不會刪衣物
  app.delete('/api/storage-locations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.storageLocation.findFirst({ where: { id, userId: request.user.id } });
    if (!existing) return reply.status(404).send({ error: '找不到此收納位置' });
    await prisma.storageLocation.delete({ where: { id } });
    return reply.send({ message: '收納位置已刪除' });
  });
}
