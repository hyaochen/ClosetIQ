// 購前分析：相似單品與評分。純函式。
import {
  summarizeCompatibility,
  categoriesComplementary,
  type CompatInput,
  type CategoryCompat,
} from './compatibility.js';
import { computeWardrobeGaps, gapsFilledBy, type Gap } from './wardrobe-gaps.js';

export interface WardrobeItem extends CompatInput {
  id: string;
  name: string;
  subcategory: string | null;
  recentWearCount: number; // 近 90 天
  totalWearCount: number;
}

export interface CandidateItem extends CompatInput {
  subcategory?: string | null;
}

export interface AnalysisResult {
  compatibleCount: number;
  totalConsidered: number;
  byCategory: CategoryCompat[];
  similarItems: SimilarItem[];
  score: number;
  reasons: string[];
  filledGaps: Gap[];
}

// ---- 評分參數（0-100）----
export const SCORE = {
  base: 30,
  compatMax: 45, // 相容比例達 COMPAT_FULL_RATIO 即給滿
  compatFullRatio: 0.6,
  gapBonusMax: 15, // 每補一個缺口 +gapBonusEach，上限 gapBonusMax
  gapBonusEach: 8,
  scarcityBonus: 10, // 衣櫃中同類別 <= scarcityMax 件
  scarcityMax: 2,
  similarBase: 8, // 每件相似單品
  similarUnderused: 6, // 該相似單品近 90 天穿 <= 1 次，額外再扣
  similarPenaltyMax: 45,
  underusedRecentMax: 1,
} as const;

export type MatchType = 'COLOR' | 'SUBCATEGORY';

// 同類別 + 同色系 = 強相似(COLOR)；同類別 + 同 subcategory 但不同色 = 弱相似(SUBCATEGORY)
export function similarityOf(c: CandidateItem, w: WardrobeItem): MatchType | null {
  if (c.category !== w.category) return null;
  if (c.colorFamily === w.colorFamily) return 'COLOR';
  if (c.subcategory && w.subcategory && c.subcategory === w.subcategory) return 'SUBCATEGORY';
  return null;
}

export type SimilarItem = WardrobeItem & { matchType: MatchType };

export function analyzeCandidate(
  candidate: CandidateItem,
  wardrobe: readonly WardrobeItem[]
): AnalysisResult {
  const compat = summarizeCompatibility(candidate, wardrobe);
  const similarItems: SimilarItem[] = [];
  for (const w of wardrobe) {
    const m = similarityOf(candidate, w);
    if (m) similarItems.push({ ...w, matchType: m });
  }
  // 強相似在前，再依總穿著次數
  similarItems.sort(
    (a, b) =>
      (a.matchType === b.matchType ? 0 : a.matchType === 'COLOR' ? -1 : 1) ||
      b.totalWearCount - a.totalWearCount
  );

  const reasons: string[] = [];
  let score: number = SCORE.base;

  // 1. 搭配度
  if (compat.totalConsidered > 0) {
    const ratio = compat.compatibleCount / compat.totalConsidered;
    score += Math.min(1, ratio / SCORE.compatFullRatio) * SCORE.compatMax;
    reasons.push(`能和 ${compat.compatibleCount} 件搭配`);
    if (compat.compatibleCount === 0) reasons.push('目前衣櫃裡沒有能和它搭的衣物');
  } else {
    reasons.push('衣櫃裡還沒有可搭配的衣物');
  }

  // 1b. 圖案：兩件都不是素色就不搭（compatibility 規則），所以有花紋的候選會少掉衣櫃裡有花紋的互補單品
  if (compat.totalConsidered > 0 && candidate.pattern && candidate.pattern !== 'SOLID') {
    const loud = wardrobe.filter((w) => categoriesComplementary(candidate.category, w.category) && w.pattern && w.pattern !== 'SOLID').length;
    if (loud > 0) reasons.push(`有花紋，不和衣櫃裡 ${loud} 件有花紋的單品同穿`);
  }

  // 2. 補缺口
  const gaps = computeWardrobeGaps(wardrobe);
  const filledGaps = gapsFilledBy(gaps, candidate);
  if (filledGaps.length > 0) {
    score += Math.min(SCORE.gapBonusMax, filledGaps.length * SCORE.gapBonusEach);
    reasons.push(`補上缺口：${filledGaps[0].label}${filledGaps.length > 1 ? ` 等 ${filledGaps.length} 項` : ''}`);
  }

  // 3. 同類別稀少
  const sameCategory = wardrobe.filter((w) => w.category === candidate.category).length;
  if (sameCategory <= SCORE.scarcityMax) {
    score += SCORE.scarcityBonus;
    reasons.push(`衣櫃裡同類別只有 ${sameCategory} 件`);
  }

  // 4. 相似單品扣分（越多、越少穿扣越多；弱相似只算一半）
  const strong = similarItems.filter((x) => x.matchType === 'COLOR');
  const weak = similarItems.filter((x) => x.matchType === 'SUBCATEGORY');
  if (similarItems.length > 0) {
    let penalty = 0;
    for (const s of similarItems) {
      const factor = s.matchType === 'COLOR' ? 1 : 0.5;
      let p = SCORE.similarBase;
      if (s.recentWearCount <= SCORE.underusedRecentMax) p += SCORE.similarUnderused;
      penalty += p * factor;
    }
    score -= Math.min(SCORE.similarPenaltyMax, penalty);

    if (strong.length > 0) {
      const underused = strong.filter((s) => s.recentWearCount <= SCORE.underusedRecentMax);
      if (underused.length === strong.length) {
        const wears = strong.map((s) => s.recentWearCount);
        const allSame = wears.every((n) => n === wears[0]);
        reasons.push(
          allSame
            ? `已有 ${strong.length} 件相似且近 90 天各只穿 ${wears[0]} 次`
            : `已有 ${strong.length} 件相似且近 90 天都很少穿`
        );
      } else if (underused.length > 0) {
        reasons.push(`已有 ${strong.length} 件相似，其中 ${underused.length} 件近 90 天很少穿`);
      } else {
        reasons.push(`已有 ${strong.length} 件相似單品，但都常穿`);
      }
    }
    if (weak.length > 0) {
      reasons.push(`另有 ${weak.length} 件同款式但不同色`);
    }
  }

  return {
    compatibleCount: compat.compatibleCount,
    totalConsidered: compat.totalConsidered,
    byCategory: compat.byCategory,
    similarItems,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    filledGaps,
  };
}
