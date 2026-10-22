// Bulk-fill for the T-CL-015 check: after final-seed, clone the review account's items until the wardrobe has
// TOTAL (default 130) items. Clones are created AFTER the originals, so the 30 originals (used by plans, journal,
// recap, wishlist similar items) become the OLDEST items and fall outside any "newest 50" list.
// Clone images share the originals' files (cutout files included); nothing is written to disk.
// Usage: DATABASE_URL=... node apps/api/scripts/bulk-fill.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const TOTAL = Number(process.env.TOTAL || 130);
const user = await prisma.user.findUnique({ where: { email: process.env.SEED_EMAIL || 'review@test.local' } });
const src = await prisma.clothingItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' }, include: { images: true } });
const have = src.length;
let n = 0;
for (let i = 0; have + n < TOTAL; i++, n++) {
  const o = src[i % have];
  const { id, createdAt, updatedAt, images, ...rest } = o;
  const created = await prisma.clothingItem.create({
    data: { ...rest, name: `${o.name} 備用${n + 1}`, laundryStatus: 'CLEAN', createdAt: new Date(Date.now() + n * 1000) },
  });
  for (const im of images) {
    const { id: _i, clothingItemId, createdAt: _c, ...imRest } = im;
    await prisma.clothingImage.create({ data: { ...imRest, clothingItemId: created.id } });
  }
}
console.log('items now', await prisma.clothingItem.count({ where: { userId: user.id } }));
await prisma.$disconnect();
