import { resolveCurrentSeason, seasonFromMonth, type Season } from '@closet/shared';

/**
 * 依目標日期推算「季外」判斷要用的季節（聯集）。
 * - 今天（台北日期）：沿用使用者的「目前季節」設定（手動設定優先，否則依月份）
 * - 其他日期：依該日期的月份推算，不受手動設定影響
 * - 沒給日期：等同今天
 */
export function seasonsForDates(
  dates: readonly string[] | undefined,
  currentSeasonSetting: string | null | undefined,
  todayYmd: string,
): Season[] {
  const todaySeason = resolveCurrentSeason(currentSeasonSetting, new Date(`${todayYmd}T04:00:00Z`));
  if (!dates || dates.length === 0) return [todaySeason];
  const out = new Set<Season>();
  for (const d of dates) {
    if (d === todayYmd) out.add(todaySeason);
    else out.add(seasonFromMonth(parseInt(d.slice(5, 7), 10)));
  }
  return [...out];
}

/** 衣物在所有目標季節都屬季外才排除（只要有任一季節合用就保留） */
export function outOfAllSeasons(itemSeasons: readonly string[], targets: readonly string[]): boolean {
  return itemSeasons.length > 0 && !targets.some((t) => itemSeasons.includes(t));
}
