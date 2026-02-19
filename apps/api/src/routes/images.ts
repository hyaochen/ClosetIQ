import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { saveClothingImage, deleteClothingImage } from '../services/image.service.js';

const STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || './data/images';

export async function imageRoutes(app: FastifyInstance) {
  // GET /api/images/file/* - Serve image files (public, no auth required)
  app.get('/api/images/file/*', async (request, reply) => {
    const imagePath = (request.params as any)['*'];
    const fullPath = path.join(STORAGE_PATH, imagePath);

    // Basic path traversal prevention
    const resolved = path.resolve(fullPath);
    const storageResolved = path.resolve(STORAGE_PATH);
    if (!resolved.startsWith(storageResolved)) {
      return reply.status(403).send({ error: '禁止存取' });
    }

    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({ error: '圖片不存在' });
    }

    // Cache for 1 hour
    reply.header('Cache-Control', 'public, max-age=3600');
    const stream = fs.createReadStream(fullPath);
    return reply.type('image/webp').send(stream);
  });

  // POST /api/items/:itemId/images - Upload image for a clothing item (auth required)
  app.post('/api/items/:itemId/images', {
    onRequest: app.authenticate,
  }, async (request, reply) => {
    const { itemId } = request.params as { itemId: string };

    // Verify item ownership
    const item = await prisma.clothingItem.findFirst({
      where: { id: itemId, userId: request.user.id },
    });
    if (!item) {
      return reply.status(404).send({ error: '找不到此衣物' });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: '請上傳圖片' });
    }

    const buffer = await file.toBuffer();
    const isPrimary = (request.query as any).primary === 'true';

    try {
      const image = await saveClothingImage(
        itemId,
        buffer,
        file.mimetype,
        request.user.id,
        isPrimary
      );
      return reply.status(201).send({ image });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // DELETE /api/images/:imageId - Delete an image (auth required)
  app.delete('/api/images/:imageId', {
    onRequest: app.authenticate,
  }, async (request, reply) => {
    const { imageId } = request.params as { imageId: string };

    const image = await prisma.clothingImage.findUnique({
      where: { id: imageId },
      include: { clothingItem: { select: { userId: true } } },
    });

    if (!image || image.clothingItem.userId !== request.user.id) {
      return reply.status(404).send({ error: '找不到此圖片' });
    }

    await deleteClothingImage(imageId);
    return reply.send({ message: '圖片已刪除' });
  });
}
