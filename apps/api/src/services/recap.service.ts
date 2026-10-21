import type { RecapCore, RecapItem, RecapPair } from '@closet/shared';
import { TILE_IMAGE_SELECT, tileFields } from '../lib/tile.js';
import { prisma } from '../lib/prisma.js';
import { dateToDayString } from '../lib/taipei-date.js';

export const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Compute recap numbers for wear logs with startDate <= date < endDate (UTC-midnight @db.Date bounds).
 * `periodEndInstant` is the Taipei instant that closes the period; it decides which clothing items
 * count as "in the wardrobe" (created before it, and still active or decluttered at/after it).
 *
 * Counting rules:
 * - item count / pair count = number of wear logs containing the item / both items (spec: per wear log)
 * - itemsWorn = distinct items worn in the period
 * - wardrobeSize = union of {items in wardrobe at period end} and {items worn in the period},
 *   so an item logged on a back-dated day is never missing from the denominator and the rate stays <= 1
 */
export async function computeRecap(
  userId: string,
  startDate: Date,
  endDate: Date,
  periodEndInstant: Date
): Promise<RecapCore> {
  const logs = await prisma.wearLog.findMany({
    where: { userId, date: { gte: startDate, lt: endDate } },
    select: {
      id: true,
      date: true,
      items: {
        select: {
          clothingItem: {
            select: {
              id: true,
              name: true,
              category: true,
              images: { where: { isPrimary: true }, take: 1, select: TILE_IMAGE_SELECT },
            },
          },
        },
      },
    },
  });

  const wardrobe = await prisma.clothingItem.findMany({
    where: {
      userId,
      createdAt: { lt: periodEndInstant },
      OR: [{ isActive: true }, { declutteredAt: { gte: periodEndInstant } }],
    },
    select: { id: true },
  });

  const days = new Set<string>();
  const itemMap = new Map<string, { name: string; category: string; thumbnailPath: string | null; tileThumbPath: string | null; tileCutout: boolean; count: number }>();
  const pairMap = new Map<string, { a: string; b: string; count: number }>();

  for (const log of logs) {
    days.add(dateToDayString(log.date));
    const ids: string[] = [];
    for (const li of log.items) {
      const ci = li.clothingItem;
      ids.push(ci.id);
      const cur = itemMap.get(ci.id);
      if (cur) cur.count += 1;
      else
        itemMap.set(ci.id, {
          name: ci.name,
          category: ci.category,
          thumbnailPath: ci.images[0]?.thumbnailPath ?? null,
          ...tileFields(ci.images[0]),
          count: 1,
        });
    }
    ids.sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        const cur = pairMap.get(key);
        if (cur) cur.count += 1;
        else pairMap.set(key, { a: ids[i], b: ids[j], count: 1 });
      }
    }
  }

  const wardrobeIds = new Set(wardrobe.map((w) => w.id));
  for (const id of itemMap.keys()) wardrobeIds.add(id);
  const wardrobeSize = wardrobeIds.size;
  const itemsWorn = itemMap.size;

  const topItems: RecapItem[] = [...itemMap.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'zh-Hant') || x.id.localeCompare(y.id))
    .slice(0, 3);

  const topPairs: RecapPair[] = [...pairMap.values()]
    .sort((x, y) => y.count - x.count || `${x.a}${x.b}`.localeCompare(`${y.a}${y.b}`))
    .slice(0, 3)
    .map((p) => {
      const ia = itemMap.get(p.a)!;
      const ib = itemMap.get(p.b)!;
      return {
        items: [
          { id: p.a, name: ia.name, thumbnailPath: ia.thumbnailPath, tileThumbPath: ia.tileThumbPath, tileCutout: ia.tileCutout },
          { id: p.b, name: ib.name, thumbnailPath: ib.thumbnailPath, tileThumbPath: ib.tileThumbPath, tileCutout: ib.tileCutout },
        ],
        count: p.count,
      };
    });

  return {
    daysLogged: days.size,
    wearLogCount: logs.length,
    itemsWorn,
    wardrobeSize,
    usageRate: wardrobeSize === 0 ? 0 : round4(itemsWorn / wardrobeSize),
    topItems,
    topPairs,
  };
}
