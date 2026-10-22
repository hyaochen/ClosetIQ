// 衣櫃缺口：純函式 + 表格化設定。調整門檻只需改下面兩張表。

export interface GapItem {
  category: string;
  seasons: string[];
  occasions: string[];
}

export type GapSeverity = 'high' | 'medium' | 'low';

export interface Gap {
  label: string;
  detail: string;
  severity: GapSeverity;
  kind: 'occasion' | 'season';
  occasion?: string;
  season?: string;
  requirement?: string;
  count: number;
  min: number;
}

export const OCCASION_NAMES: Record<string, string> = {
  CASUAL: '休閒',
  WORK: '上班',
  FORMAL: '正式',
  SPORT: '運動',
  LOUNGE: '居家',
};

export const SEASON_NAMES: Record<string, string> = {
  SPRING: '春季',
  SUMMER: '夏季',
  AUTUMN: '秋季',
  WINTER: '冬季',
};

interface Requirement {
  key: string;
  noun: string; // 「正式場合的{noun}」
  unit: string;
  categories: readonly string[]; // 任一類別都算數
  min: number;
}

// 場合 x 必要類別 x 最低件數。min 設 0 代表此場合不要求該項。
const T = { key: 'top', noun: '上衣', unit: '件', categories: ['TOP'] } as const;
const B = { key: 'bottom', noun: '下身或洋裝', unit: '件', categories: ['BOTTOM', 'DRESS'] } as const;
const S = { key: 'shoes', noun: '鞋', unit: '雙', categories: ['SHOES'] } as const;

export const OCCASION_RULES: Record<string, Requirement[]> = {
  CASUAL: [{ ...T, min: 3 }, { ...B, min: 3 }, { ...S, min: 1 }],
  WORK: [{ ...T, min: 3 }, { ...B, min: 3 }, { ...S, min: 1 }],
  FORMAL: [{ ...T, min: 1 }, { ...B, min: 1 }, { ...S, min: 1 }],
  SPORT: [{ ...T, min: 1 }, { ...B, min: 1 }, { ...S, min: 1 }],
  LOUNGE: [{ ...T, min: 1 }, { ...B, min: 1 }, { ...S, min: 0 }],
};

// 季節 x 外套最低件數；夏季不要求。
export const SEASON_OUTERWEAR_MIN: Record<string, number> = {
  SPRING: 1,
  SUMMER: 0,
  AUTUMN: 1,
  WINTER: 2,
};

function severityFor(count: number, min: number): GapSeverity {
  if (count === 0) return 'high';
  if (count * 2 <= min) return 'medium';
  return 'low';
}

const SEV_ORDER: Record<GapSeverity, number> = { high: 0, medium: 1, low: 2 };

const matchesOrEmpty = (list: string[], v: string) => list.length === 0 || list.includes(v);

export function computeWardrobeGaps(items: readonly GapItem[]): Gap[] {
  const gaps: Gap[] = [];

  for (const [occasion, reqs] of Object.entries(OCCASION_RULES)) {
    const pool = items.filter((i) => matchesOrEmpty(i.occasions, occasion));
    for (const r of reqs) {
      if (r.min <= 0) continue;
      const count = pool.filter((i) => r.categories.includes(i.category)).length;
      if (count >= r.min) continue;
      gaps.push({
        label: `${OCCASION_NAMES[occasion]}場合的${r.noun}`,
        detail: `${count === 0 ? '0' : '只有 ' + count} ${r.unit}，建議至少 ${r.min} ${r.unit}`,
        severity: severityFor(count, r.min),
        kind: 'occasion',
        occasion,
        requirement: r.key,
        count,
        min: r.min,
      });
    }
  }

  for (const [season, min] of Object.entries(SEASON_OUTERWEAR_MIN)) {
    if (min <= 0) continue;
    const count = items.filter(
      (i) => i.category === 'OUTERWEAR' && matchesOrEmpty(i.seasons, season)
    ).length;
    if (count >= min) continue;
    gaps.push({
      label: `${SEASON_NAMES[season]}外套`,
      detail: `${count === 0 ? '0' : '只有 ' + count} 件，建議至少 ${min} 件`,
      severity: severityFor(count, min),
      kind: 'season',
      season,
      count,
      min,
    });
  }

  return gaps.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

/** 這件願望清單單品能補上哪些缺口 */
export function gapsFilledBy(
  gaps: readonly Gap[],
  candidate: GapItem
): Gap[] {
  return gaps.filter((g) => {
    if (g.kind === 'occasion' && g.occasion) {
      const req = (OCCASION_RULES[g.occasion] ?? []).find((r) => r.key === g.requirement);
      const covered = !!req && req.categories.includes(candidate.category);
      return covered && matchesOrEmpty(candidate.occasions, g.occasion);
    }
    if (g.kind === 'season' && g.season) {
      return candidate.category === 'OUTERWEAR' && matchesOrEmpty(candidate.seasons, g.season);
    }
    return false;
  });
}
