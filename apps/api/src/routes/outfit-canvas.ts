import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import {
  saveCanvasSchema,
  autoCanvasSchema,
  canvasLayoutSchema,
  type CanvasLayout,
} from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import {
  buildAutoLayout,
  deleteCoverFiles,
  renderCoverBuffers,
  renderPngBuffer,
  resolvePieceImagePath,
  saveCoverFiles,
  type RenderPiece,
} from '../services/canvas.service.js';

const IMAGE_URL_PREFIX = '/api/images/file/';

const coverUrls = (o: { coverPath: string | null; coverThumbPath: string | null }) => ({
  coverPath: o.coverPath,
  coverThumbPath: o.coverThumbPath,
  coverUrl: o.coverPath ? IMAGE_URL_PREFIX + o.coverPath : null,
  coverThumbUrl: o.coverThumbPath ? IMAGE_URL_PREFIX + o.coverThumbPath : null,
});

// layerOrder follows z (ascending, ties keep array order)
function layerOrderMap(layout: CanvasLayout) {
  const sorted = layout.pieces
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.z - b.p.z || a.i - b.i);
  return new Map(sorted.map((s, rank) => [s.p.itemId, rank]));
}

/** Load drawable pieces. Pieces whose item left the outfit or whose image was deleted are skipped. */
async function resolvePieces(
  userId: string,
  outfitId: string,
  layout: CanvasLayout
): Promise<{ pieces: RenderPiece[]; skipped: string[] }> {
  const outfitItems = await prisma.outfitItem.findMany({
    where: { outfitId, clothingItem: { userId } },
    select: { clothingItemId: true },
  });
  const inOutfit = new Set(outfitItems.map((o) => o.clothingItemId));
  const images = await prisma.clothingImage.findMany({
    where: { id: { in: layout.pieces.map((p) => p.imageId) } },
  });
  const byId = new Map(images.map((i) => [i.id, i]));

  const pieces: RenderPiece[] = [];
  const skipped: string[] = [];
  for (const p of layout.pieces) {
    const img = byId.get(p.imageId);
    if (!inOutfit.has(p.itemId) || !img || img.clothingItemId !== p.itemId) {
      skipped.push(p.itemId);
      continue;
    }
    pieces.push({ ...p, file: resolvePieceImagePath(img) });
  }
  return { pieces, skipped };
}

async function renderAndStore(userId: string, outfitId: string, layout: CanvasLayout) {
  const { pieces, skipped } = await resolvePieces(userId, outfitId, layout);
  if (pieces.length === 0) return { error: '畫布上沒有可繪製的衣物' as const };

  const { cover, thumb } = await renderCoverBuffers(layout, pieces);
  const old = await prisma.outfit.findUnique({
    where: { id: outfitId },
    select: { coverPath: true, coverThumbPath: true },
  });
  const saved = await saveCoverFiles(userId, outfitId, cover, thumb);
  await prisma.outfit.update({ where: { id: outfitId }, data: saved });
  await deleteCoverFiles([old?.coverPath, old?.coverThumbPath]);
  return { ...coverUrls(saved), skipped };
}

const outfitInclude = {
  items: {
    include: {
      clothingItem: { include: { images: { where: { isPrimary: true }, take: 1 } } },
    },
    orderBy: { layerOrder: 'asc' as const },
  },
};

export async function outfitCanvasRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // PUT /api/outfits/:id/canvas - save a layout
  app.put('/api/outfits/:id/canvas', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const parsed = saveCanvasSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }
    const { layout, syncItems, render } = parsed.data;

    const outfit = await prisma.outfit.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!outfit) return reply.status(404).send({ error: '找不到此穿搭' });

    const itemIds = layout.pieces.map((p) => p.itemId);
    const owned = await prisma.clothingItem.findMany({
      where: { id: { in: itemIds }, userId },
      select: { id: true },
    });
    if (owned.length !== itemIds.length) {
      return reply.status(400).send({ error: '部分衣物不存在或不屬於您' });
    }
    const inOutfit = new Set(outfit.items.map((o) => o.clothingItemId));
    if (!syncItems && itemIds.some((i) => !inOutfit.has(i))) {
      return reply.status(400).send({ error: '畫布上有不在此穿搭內的衣物（可加上 syncItems 讓穿搭跟著更新）' });
    }

    const imageIds = layout.pieces.map((p) => p.imageId);
    const images = await prisma.clothingImage.findMany({
      where: { id: { in: imageIds } },
      select: { id: true, clothingItemId: true },
    });
    const imgItem = new Map(images.map((i) => [i.id, i.clothingItemId]));
    if (layout.pieces.some((p) => imgItem.get(p.imageId) !== p.itemId)) {
      return reply.status(400).send({ error: '圖片與衣物不符' });
    }

    const order = layerOrderMap(layout);
    const placed = new Set(itemIds);
    await prisma.$transaction(async (tx) => {
      await tx.outfit.update({
        where: { id },
        data: { canvasLayout: layout as unknown as Prisma.InputJsonValue },
      });
      if (syncItems) {
        await tx.outfitItem.deleteMany({
          where: { outfitId: id, clothingItemId: { notIn: itemIds } },
        });
        const toCreate = itemIds.filter((i) => !inOutfit.has(i));
        if (toCreate.length) {
          await tx.outfitItem.createMany({
            data: toCreate.map((clothingItemId) => ({ outfitId: id, clothingItemId })),
          });
        }
      }
      for (const [clothingItemId, layerOrder] of order) {
        await tx.outfitItem.updateMany({
          where: { outfitId: id, clothingItemId },
          data: { layerOrder },
        });
      }
      // items still in the outfit but not on the canvas go behind everything else
      if (!syncItems) {
        let n = order.size;
        for (const o of outfit.items.filter((o) => !placed.has(o.clothingItemId))) {
          await tx.outfitItem.update({ where: { id: o.id }, data: { layerOrder: n++ } });
        }
      }
    });

    const unplaced = syncItems ? [] : outfit.items.map((o) => o.clothingItemId).filter((i) => !placed.has(i));
    let cover: Record<string, unknown> | undefined;
    if (render) {
      const r = await renderAndStore(userId, id, layout);
      if ('error' in r) return reply.status(400).send({ error: r.error });
      cover = r;
    }

    const updated = await prisma.outfit.findUnique({ where: { id }, include: outfitInclude });
    return reply.send({ outfit: updated, unplaced, ...(cover ? { cover } : {}) });
  });

  // POST /api/outfits/:id/canvas/auto - build an initial layout from the outfit's items
  app.post('/api/outfits/:id/canvas/auto', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const parsed = autoCanvasSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    }

    const outfit = await prisma.outfit.findFirst({
      where: { id, userId },
      include: {
        items: {
          orderBy: { layerOrder: 'asc' },
          include: {
            clothingItem: {
              include: { images: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
            },
          },
        },
      },
    });
    if (!outfit) return reply.status(404).send({ error: '找不到此穿搭' });

    const usable = outfit.items.filter((o) => o.clothingItem.images.length > 0);
    const noImage = outfit.items.filter((o) => o.clothingItem.images.length === 0).map((o) => o.clothingItemId);
    if (usable.length === 0) {
      return reply.status(400).send({ error: '此穿搭的衣物都沒有照片，無法排版' });
    }

    const background = parsed.data.background ?? 'card';
    const layout = buildAutoLayout(
      usable.map((o) => ({
        itemId: o.clothingItemId,
        imageId: o.clothingItem.images[0].id,
        category: o.clothingItem.category,
      })),
      background
    );
    const order = layerOrderMap(layout);

    await prisma.$transaction(async (tx) => {
      await tx.outfit.update({
        where: { id },
        data: { canvasLayout: layout as unknown as Prisma.InputJsonValue },
      });
      for (const [clothingItemId, layerOrder] of order) {
        await tx.outfitItem.updateMany({ where: { outfitId: id, clothingItemId }, data: { layerOrder } });
      }
    });

    let cover: Record<string, unknown> | undefined;
    if (parsed.data.render) {
      const r = await renderAndStore(userId, id, layout);
      if ('error' in r) return reply.status(400).send({ error: r.error });
      cover = r;
    }
    return reply.send({ layout, skippedNoImage: noImage, ...(cover ? { cover } : {}) });
  });

  // POST /api/outfits/:id/render - composite the cover (1080x1350 WebP) from the saved layout
  app.post('/api/outfits/:id/render', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const outfit = await prisma.outfit.findFirst({ where: { id, userId } });
    if (!outfit) return reply.status(404).send({ error: '找不到此穿搭' });
    const layout = canvasLayoutSchema.safeParse(outfit.canvasLayout);
    if (!outfit.canvasLayout || !layout.success) {
      return reply.status(409).send({ error: '此穿搭還沒有版面，請先儲存版面或呼叫 canvas/auto' });
    }
    const r = await renderAndStore(userId, id, layout.data);
    if ('error' in r) return reply.status(400).send({ error: r.error });
    return reply.send(r);
  });

  // GET /api/outfits/:id/export.png - render on the fly and download as PNG (does not touch the cover)
  app.get('/api/outfits/:id/export.png', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const outfit = await prisma.outfit.findFirst({ where: { id, userId } });
    if (!outfit) return reply.status(404).send({ error: '找不到此穿搭' });
    const layout = canvasLayoutSchema.safeParse(outfit.canvasLayout);
    if (!outfit.canvasLayout || !layout.success) {
      return reply.status(409).send({ error: '此穿搭還沒有版面，請先儲存版面或呼叫 canvas/auto' });
    }
    const { pieces } = await resolvePieces(userId, id, layout.data);
    if (pieces.length === 0) return reply.status(400).send({ error: '畫布上沒有可繪製的衣物' });
    const png = await renderPngBuffer(layout.data, pieces);
    reply.header('Content-Disposition', `attachment; filename="outfit-${id}.png"`);
    reply.header('Cache-Control', 'private, no-store');
    return reply.type('image/png').send(png);
  });
}
