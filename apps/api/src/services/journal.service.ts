import type { JournalDay, JournalLog, JournalMonthResponse } from '@closet/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { dateToDayString, monthDateRange } from '../lib/taipei-date.js';

// ---- P3 ----
export const journalLogInclude = {
  items: {
    include: {
      clothingItem: {
        select: {
          id: true,
          name: true,
          category: true,
          colors: true,
          images: { where: { isPrimary: true }, take: 1, select: { thumbnailPath: true } },
        },
      },
    },
  },
} as const;

type LogWithItems = Prisma.WearLogGetPayload<{ include: typeof journalLogInclude }>;

export function toJournalLog(log: LogWithItems): JournalLog {
  return {
    id: log.id,
    date: dateToDayString(log.date),
    occasion: log.occasion,
    notes: log.notes,
    photoOriginalPath: log.photoOriginalPath,
    photoDisplayPath: log.photoDisplayPath,
    photoThumbnailPath: log.photoThumbnailPath,
    items: log.items.map((li) => ({
      id: li.clothingItem.id,
      name: li.clothingItem.name,
      category: li.clothingItem.category,
      colors: li.clothingItem.colors,
      thumbnailPath: li.clothingItem.images[0]?.thumbnailPath ?? null,
    })),
  };
}

/** All wear logs of a month grouped by calendar day (only days that have logs). */
export async function getJournalMonth(userId: string, month: string): Promise<JournalMonthResponse> {
  const { start, end } = monthDateRange(month);
  const logs = await prisma.wearLog.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: journalLogInclude,
  });

  const byDay = new Map<string, JournalLog[]>();
  for (const log of logs) {
    const j = toJournalLog(log);
    const arr = byDay.get(j.date);
    if (arr) arr.push(j);
    else byDay.set(j.date, [j]);
  }

  const days: JournalDay[] = [...byDay.entries()].map(([date, dayLogs]) => {
    const withPhoto = dayLogs.find((l) => l.photoDisplayPath);
    return {
      date,
      logCount: dayLogs.length,
      photoThumbnailPath: withPhoto?.photoThumbnailPath ?? null,
      photoDisplayPath: withPhoto?.photoDisplayPath ?? null,
      logs: dayLogs,
    };
  });
  return { month, days };
}
