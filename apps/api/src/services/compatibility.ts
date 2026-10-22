// 衣物搭配相容度：純函式，不碰資料庫，方便單元測試。
// 規則（全部成立才算「能搭」）：
//   1. 類別互補（上衣配下身／外套／鞋／包／配件；洋裝配外套／鞋／包／配件…）
//   2. 季節交集非空（任一方 seasons 為空視為四季）
//   3. 場合交集非空（任一方 occasions 為空視為所有場合）
//   4. 色彩相容（見 COLOR_COMPAT）
//   5. 圖樣不衝突（兩件都不是素色 -> 不搭）

export interface CompatInput {
  category: string;
  colorFamily: string;
  seasons: string[];
  occasions: string[];
  pattern?: string | null;
}

// ---- 類別 ----
// 互補類別表。內衣褲（UNDERWEAR）不參與搭配。
export const COMPLEMENTARY_CATEGORIES: Record<string, readonly string[]> = {
  TOP: ['BOTTOM', 'OUTERWEAR', 'SHOES', 'BAG', 'ACCESSORY'],
  BOTTOM: ['TOP', 'OUTERWEAR', 'SHOES', 'BAG', 'ACCESSORY'],
  DRESS: ['OUTERWEAR', 'SHOES', 'BAG', 'ACCESSORY'],
  OUTERWEAR: ['TOP', 'BOTTOM', 'DRESS', 'SHOES', 'BAG', 'ACCESSORY'],
  SHOES: ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'BAG', 'ACCESSORY'],
  BAG: ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'SHOES', 'ACCESSORY'],
  ACCESSORY: ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'SHOES', 'BAG'],
  UNDERWEAR: [],
};

export function complementaryCategories(category: string): readonly string[] {
  return COMPLEMENTARY_CATEGORIES[category] ?? [];
}

export function categoriesComplementary(a: string, b: string): boolean {
  return complementaryCategories(a).includes(b);
}

// ---- 色彩 ----
// ColorFamily 實際值：RED ORANGE YELLOW GREEN BLUE PURPLE PINK BLACK WHITE GREY BROWN BEIGE MULTI
// (沒有 NAVY / GRAY；深藍歸在 BLUE，所以 BLUE 不當中性色，用下表控制。)
export const NEUTRAL_COLORS: readonly string[] = ['BLACK', 'WHITE', 'GREY', 'BEIGE', 'BROWN'];

// 非中性色的相容表（對稱；同色系永遠相容，另行處理；MULTI 只和中性色搭）。
// 依據：互補色（橘-藍、黃-紫）、類似色（藍-綠、紫-粉、藍-紫）、牛仔藍百搭（藍-紅、藍-粉）。
const COLOR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['BLUE', 'RED'],
  ['BLUE', 'ORANGE'],
  ['BLUE', 'YELLOW'],
  ['BLUE', 'GREEN'],
  ['BLUE', 'PURPLE'],
  ['BLUE', 'PINK'],
  ['GREEN', 'YELLOW'],
  ['PURPLE', 'PINK'],
  ['PURPLE', 'YELLOW'],
];

const colorPairSet = new Set(COLOR_PAIRS.map(([a, b]) => [a, b].sort().join('|')));

export function isNeutral(colorFamily: string): boolean {
  return NEUTRAL_COLORS.includes(colorFamily);
}

export function colorsCompatible(a: string, b: string): boolean {
  if (isNeutral(a) || isNeutral(b)) return true; // 中性色一律相容（含 MULTI）
  if (a === 'MULTI' || b === 'MULTI') return false; // 兩件都是有色且其一為多色 -> 不搭
  if (a === b) return true; // 同色系
  return colorPairSet.has([a, b].sort().join('|'));
}

// ---- 季節／場合 ----
export function intersectsOrEmpty(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some((x) => b.includes(x));
}

// ---- 圖樣 ----
function isLoudPattern(p: string | null | undefined): boolean {
  return !!p && p !== 'SOLID';
}

// ---- 綜合判斷 ----
export function itemsCompatible(a: CompatInput, b: CompatInput): boolean {
  if (!categoriesComplementary(a.category, b.category)) return false;
  if (!intersectsOrEmpty(a.seasons, b.seasons)) return false;
  if (!intersectsOrEmpty(a.occasions, b.occasions)) return false;
  if (!colorsCompatible(a.colorFamily, b.colorFamily)) return false;
  if (isLoudPattern(a.pattern) && isLoudPattern(b.pattern)) return false;
  return true;
}

export interface CategoryCompat {
  category: string;
  compatible: number;
  total: number;
}

export interface CompatSummary {
  compatibleCount: number;
  totalConsidered: number;
  byCategory: CategoryCompat[];
  compatibleIds: string[];
}

/**
 * 對 candidate 與整個衣櫃逐件比對。
 * total = 衣櫃中「類別互補」的件數；compatible = 其中其餘條件也通過的件數。
 * byCategory 只列互補類別，依 compatible 由多到少。
 */
export function summarizeCompatibility(
  candidate: CompatInput,
  wardrobe: ReadonlyArray<CompatInput & { id: string }>
): CompatSummary {
  const per = new Map<string, CategoryCompat>();
  for (const cat of complementaryCategories(candidate.category)) {
    per.set(cat, { category: cat, compatible: 0, total: 0 });
  }
  const compatibleIds: string[] = [];
  for (const w of wardrobe) {
    const bucket = per.get(w.category);
    if (!bucket) continue;
    bucket.total++;
    if (itemsCompatible(candidate, w)) {
      bucket.compatible++;
      compatibleIds.push(w.id);
    }
  }
  const byCategory = [...per.values()].sort(
    (x, y) => y.compatible - x.compatible || y.total - x.total
  );
  return {
    compatibleCount: compatibleIds.length,
    totalConsidered: byCategory.reduce((s, c) => s + c.total, 0),
    byCategory,
    compatibleIds,
  };
}
