import { resolveCurrentSeason, isOutOfSeason } from '@closet/shared';
import { prisma } from '../lib/prisma.js';

// ---- P5 ----
// 從 routes/suggestions.ts 抽出的推薦評分邏輯（公式與原本完全相同），供推薦、自動排週計畫、旅行打包共用。

export interface ScoreOptions {
  targetSeasons: string[];
  occasion?: string;
}

/** 載入使用者所有啟用中衣物並評分（含主圖與穿著統計） */
export async function loadScoredItems(userId: string, opts: ScoreOptions) {
  const { targetSeasons, occasion } = opts;

  // 與 P1 的推薦規則一致：只取乾淨衣物（排除待洗 / 送洗中），季外衣物在下方排除。
  // 這裡是推薦、自動排週計畫、旅行打包共用的入口，所以三者都套同樣規則。
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { currentSeason: true } });
  const currentSeason = resolveCurrentSeason(me?.currentSeason);

  const allItems = await prisma.clothingItem.findMany({
    where: { userId, isActive: true, laundryStatus: 'CLEAN' },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      _count: { select: { wearLogItems: true } },
      wearLogItems: {
        orderBy: { wearLog: { date: 'desc' } },
        take: 1,
        include: { wearLog: { select: { date: true } } },
      },
    },
  });

  const items = allItems.filter((i) => !isOutOfSeason(i.seasons, currentSeason));

  return items.map((item) => {
    let score = 0;
    const lastWorn = item.wearLogItems[0]?.wearLog.date ?? null;
    const wearCount = item._count.wearLogItems;

    // Season match
    if (targetSeasons.length > 0) {
      const seasonMatch = item.seasons.some((s) => targetSeasons.includes(s));
      if (seasonMatch) score += 10;
      else score -= 20; // Strong penalty for wrong season
    }

    // Occasion match
    if (occasion && item.occasions.includes(occasion)) {
      score += 8;
    }

    // Prefer less worn items
    if (wearCount === 0) score += 5;
    else score -= wearCount * 0.3;

    // Prefer items not recently worn
    if (lastWorn) {
      const daysSince = (Date.now() - lastWorn.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.min(daysSince * 0.2, 5);
    } else {
      score += 3; // Never worn bonus
    }

    // Condition bonus
    if (item.condition === 'NEW') score += 2;
    if (item.condition === 'GOOD') score += 1;

    return { ...item, score };
  });
}

export type ScoredItem = Awaited<ReturnType<typeof loadScoredItems>>[number];
