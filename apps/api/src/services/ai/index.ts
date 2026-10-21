// ---- P2 ---- AI analyze service: provider selection, sanitising, daily quota
import sharp from 'sharp';
import { z } from 'zod';
import { itemSuggestionSchema, ClothingCategory, ColorFamily, Pattern, Season, Occasion } from '@closet/shared';
import type { ItemSuggestion } from '@closet/shared';
import { prisma } from '../../lib/prisma.js';
import type { AnalyzeProvider } from './types.js';
import { MockProvider } from './mock.provider.js';
import { ClaudeVisionProvider, estimateCostUsd } from './claude.provider.js';

export { estimateCostUsd };

const MAX_EDGE = 1024;

/** AI_PROVIDER=auto (default): claude when ANTHROPIC_API_KEY is set, otherwise mock. */
export function getProvider(): AnalyzeProvider | null {
  const mode = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  const key = process.env.ANTHROPIC_API_KEY;
  const hasKey = !!key && !key.includes('your-key-here');
  if (mode === 'mock') return new MockProvider();
  if (mode === 'claude') return hasKey ? new ClaudeVisionProvider(key!) : null;
  return hasKey ? new ClaudeVisionProvider(key!) : new MockProvider();
}

export const dailyLimit = () => {
  const n = parseInt(process.env.AI_DAILY_LIMIT || '30');
  return Number.isFinite(n) && n >= 0 ? n : 30;
};

/** Shrink to long edge <= 1024, flatten alpha onto white, JPEG. Keeps token cost bounded. */
export async function prepareImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#FFFFFF' })
    .jpeg({ quality: 85 })
    .toBuffer();
}

const wrap = z.object({ value: z.unknown(), confidence: z.unknown() });

function clamp01(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Validate one provider field. Anything outside the shared enums / formats is dropped
 * (array fields keep their valid elements; the whole field becomes null if none remain).
 */
function pickField<T>(raw: Record<string, unknown>, key: string, validate: (v: unknown) => T | null) {
  const w = wrap.safeParse(raw[key]);
  if (!w.success) return null;
  const value = validate(w.data.value);
  if (value === null) return null;
  return { value, confidence: Math.round(clamp01(w.data.confidence) * 100) / 100 };
}

const oneOf = (allowed: readonly string[]) => (v: unknown) =>
  typeof v === 'string' && allowed.includes(v.toUpperCase()) ? v.toUpperCase() : null;

const text = (max: number) => (v: unknown) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
};

const listOf = (allowed: readonly string[], max: number) => (v: unknown) => {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.filter((x) => typeof x === 'string').map((x: string) => x.toUpperCase()))].filter((x) =>
    allowed.includes(x)
  );
  return out.length ? out.slice(0, max) : null;
};

const hexList = (v: unknown) => {
  if (!Array.isArray(v)) return null;
  const out = v
    .filter((x) => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x))
    .map((x: string) => x.toUpperCase());
  return out.length ? out.slice(0, 3) : null;
};

export function sanitizeSuggestion(raw: unknown): ItemSuggestion {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const suggestion = {
    category: pickField(r, 'category', oneOf(Object.values(ClothingCategory))),
    subcategory: pickField(r, 'subcategory', text(30)),
    colorFamily: pickField(r, 'colorFamily', oneOf(Object.values(ColorFamily))),
    colors: pickField(r, 'colors', hexList),
    pattern: pickField(r, 'pattern', oneOf(Object.values(Pattern))),
    material: pickField(r, 'material', text(30)),
    seasons: pickField(r, 'seasons', listOf(Object.values(Season), 4)),
    occasions: pickField(r, 'occasions', listOf(Object.values(Occasion), 5)),
    nameSuggestion: pickField(r, 'nameSuggestion', text(50)),
  };
  // Final guard: the result must satisfy the shared contract exactly.
  return itemSuggestionSchema.parse(suggestion);
}

// ---- Daily quota (Asia/Taipei calendar day) ----
export function taipeiDay(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

/** Atomically reserve one analysis. Returns the new count, or null when the limit is already reached. */
export async function reserveQuota(userId: string): Promise<number | null> {
  const day = taipeiDay();
  const limit = dailyLimit();
  const row = await prisma.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (row.count > limit) {
    await prisma.aiUsage.update({ where: { userId_day: { userId, day } }, data: { count: { decrement: 1 } } });
    return null;
  }
  return row.count;
}

export async function refundQuota(userId: string): Promise<void> {
  const day = taipeiDay();
  await prisma.aiUsage
    .update({ where: { userId_day: { userId, day } }, data: { count: { decrement: 1 } } })
    .catch(() => {});
}

export async function recordTokens(userId: string, inputTokens: number, outputTokens: number): Promise<void> {
  await prisma.aiUsage
    .update({
      where: { userId_day: { userId, day: taipeiDay() } },
      data: { inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens } },
    })
    .catch(() => {});
}

export async function getUsedToday(userId: string): Promise<number> {
  const row = await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: taipeiDay() } } });
  return row?.count ?? 0;
}
