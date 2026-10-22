// ---- P2 ---- AI analyze service: provider selection, sanitising, daily quota
import sharp from 'sharp';
import { itemSuggestionSchema, ClothingCategory, ColorFamily, Pattern, Season, Occasion } from '@closet/shared';
import type { ItemSuggestion } from '@closet/shared';
import { prisma } from '../../lib/prisma.js';
import type { AnalyzeProvider } from './types.js';
import { MockProvider } from './mock.provider.js';
import { ClaudeVisionProvider, estimateCostUsd } from './claude.provider.js';
import { SubscriptionBridgeProvider, pingBridgeCached } from './bridge.provider.js';

export { estimateCostUsd };

const MAX_EDGE = 1024;

/**
 * AI_PROVIDER = bridge | claude | mock | auto (default).
 *  - bridge: the account holder's Claude subscription via the host claude-bridge (CLAUDE_BRIDGE_TOKEN required)
 *  - claude: Anthropic API key
 *  - auto:   claude when ANTHROPIC_API_KEY is set, else bridge when CLAUDE_BRIDGE_TOKEN is set, else mock (reported disabled)
 */
const hasApiKey = () => {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && !key.includes('your-key-here');
};
const hasBridgeToken = () => !!process.env.CLAUDE_BRIDGE_TOKEN && process.env.CLAUDE_BRIDGE_TOKEN.length >= 16;

export function getProvider(): AnalyzeProvider | null {
  const mode = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  if (mode === 'mock') return new MockProvider();
  if (mode === 'claude') return hasApiKey() ? new ClaudeVisionProvider(process.env.ANTHROPIC_API_KEY!) : null;
  if (mode === 'bridge') return hasBridgeToken() ? new SubscriptionBridgeProvider() : null;
  if (hasApiKey()) return new ClaudeVisionProvider(process.env.ANTHROPIC_API_KEY!);
  if (hasBridgeToken()) return new SubscriptionBridgeProvider();
  return new MockProvider();
}

/**
 * The subscription belongs to the account holder only (Anthropic ToS): bridge results are only
 * available to ClosetIQ user ids listed in AI_ALLOWED_USER_IDS (comma separated; empty = nobody).
 * API-key (claude) and mock providers are not restricted by this list.
 */
export function isUserAllowed(provider: AnalyzeProvider, userId: string): boolean {
  if (provider.name !== 'bridge') return true;
  const ids = (process.env.AI_ALLOWED_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return ids.includes(userId);
}

/**
 * Frontend-facing availability. enabled=true only when a real provider is configured (and for
 * bridge: the user is allowed AND the bridge answers a ping, cached 60 s), or
 * AI_PROVIDER=mock was set explicitly. AI_PROVIDER=auto with nothing configured is disabled.
 */
export async function analyzeStatus(userId: string): Promise<{ enabled: boolean; provider: string }> {
  const mode = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  const provider = getProvider();
  if (!provider) return { enabled: false, provider: 'none' };
  if (provider.name === 'mock' && mode !== 'mock') return { enabled: false, provider: 'none' };
  if (!isUserAllowed(provider, userId)) return { enabled: false, provider: 'none' };
  if (provider.name === 'bridge' && !(await pingBridgeCached())) return { enabled: false, provider: 'none' };
  return { enabled: true, provider: provider.name };
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

function clamp01(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Rule-based fallback confidence for fields where the provider gave a bare value or no usable
 * confidence: clear-cut enums 0.6, free text and lists 0.5, material 0.35 (a photo rarely shows it).
 * Low values make the UI mark the field as "to confirm".
 */
const DEFAULT_CONFIDENCE: Record<string, number> = { category: 0.6, colorFamily: 0.6, pattern: 0.6, material: 0.35 };
const defaultConfidence = (key: string) => DEFAULT_CONFIDENCE[key] ?? 0.5;

/**
 * Validate one provider field. Anything outside the shared enums / formats is dropped
 * (array fields keep their valid elements; the whole field becomes null if none remain).
 * Accepts {value, confidence}, {value} (confidence by rule) or a bare value (confidence by rule).
 */
function pickField<T>(raw: Record<string, unknown>, key: string, validate: (v: unknown) => T | null) {
  const field = raw[key];
  if (field === null || field === undefined) return null;
  const isWrapped = typeof field === 'object' && !Array.isArray(field) && 'value' in (field as object);
  const value = validate(isWrapped ? (field as { value: unknown }).value : field);
  if (value === null) return null;
  const given = isWrapped ? (field as { confidence?: unknown }).confidence : undefined;
  const hasGiven = given !== undefined && given !== null && Number.isFinite(typeof given === 'number' ? given : Number(given));
  return { value, confidence: hasGiven ? Math.round(clamp01(given) * 100) / 100 : defaultConfidence(key) };
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
