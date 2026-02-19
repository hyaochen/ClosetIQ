/**
 * 計算每次穿著成本
 */
export function costPerWear(purchasePrice: number | null, wearCount: number): number | null {
  if (purchasePrice === null || purchasePrice === 0 || wearCount === 0) return null;
  return Math.round((purchasePrice / wearCount) * 100) / 100;
}

/**
 * 計算距離上次穿著的天數
 */
export function daysSinceLastWorn(lastWornDate: string | null): number | null {
  if (!lastWornDate) return null;
  const last = new Date(lastWornDate);
  const now = new Date();
  const diff = now.getTime() - last.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 根據溫度判斷建議季節
 */
export function temperatureToSeason(tempCelsius: number): string[] {
  if (tempCelsius >= 28) return ['SUMMER'];
  if (tempCelsius >= 22) return ['SUMMER', 'SPRING'];
  if (tempCelsius >= 15) return ['SPRING', 'AUTUMN'];
  if (tempCelsius >= 5) return ['AUTUMN', 'WINTER'];
  return ['WINTER'];
}
