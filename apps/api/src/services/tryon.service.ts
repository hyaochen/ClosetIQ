// ---- T-CL-022 ---- Virtual try-on through the host tryon-bridge (FASHN VTON v1.5, local GPU)
//
// The bridge (tools/tryon-bridge) keeps the model resident and runs one try-on at a time.
// Nothing here is persisted: the person photo and the result only live in request memory.
import { prisma } from '../lib/prisma.js';
import { taipeiDay } from './ai/index.js';

export const tryonUrl = () => (process.env.TRYON_BRIDGE_URL || 'http://host.docker.internal:8766').replace(/\/+$/, '');
const authHeader = () => ({ Authorization: `Bearer ${process.env.TRYON_BRIDGE_TOKEN || ''}` });
const hasToken = () => !!process.env.TRYON_BRIDGE_TOKEN && process.env.TRYON_BRIDGE_TOKEN.length >= 16;

export type TryonCategory = 'tops' | 'bottoms' | 'one-pieces';

/** ClothingCategory -> FASHN category. null = the model cannot try this on (route answers 400). */
export function mapCategory(category: string): TryonCategory | null {
  switch (category) {
    case 'TOP':
    case 'OUTERWEAR':
      return 'tops';
    case 'BOTTOM':
      return 'bottoms';
    case 'DRESS':
      return 'one-pieces';
    default:
      return null;
  }
}

/** Same allowlist as the AI bridge (AI_ALLOWED_USER_IDS, comma separated; empty = nobody). */
export function isTryonUserAllowed(userId: string): boolean {
  const ids = (process.env.AI_ALLOWED_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return ids.includes(userId);
}

export const tryonDailyLimit = () => {
  const n = parseInt(process.env.TRYON_DAILY_LIMIT || '20');
  return Number.isFinite(n) && n >= 0 ? n : 20;
};

// ---- availability ping, cached 60 s so the item page never waits on a dead bridge ----
const PING_TTL_MS = 60_000;
const PING_TIMEOUT_MS = 1_500;
let upCache = { at: 0, up: false };
let inflight: Promise<boolean> | null = null;

export async function pingTryonCached(now = Date.now()): Promise<boolean> {
  if (now - upCache.at < PING_TTL_MS) return upCache.up;
  if (!inflight) {
    inflight = (async () => {
      let up = false;
      try {
        const r = await fetch(`${tryonUrl()}/health`, { headers: authHeader(), signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
        up = r.ok;
      } catch {
        up = false;
      }
      upCache = { at: Date.now(), up };
      return up;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** test hook */
export function resetTryonPingCache() {
  upCache = { at: 0, up: false };
}

export async function tryonStatus(userId: string): Promise<{ enabled: boolean }> {
  if (!hasToken() || !isTryonUserAllowed(userId)) return { enabled: false };
  return { enabled: await pingTryonCached() };
}

export class TryonError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Calls the bridge. Returns the PNG bytes. Throws TryonError with the bridge's status (429 busy, 504 timeout, ...). */
export async function runTryon(person: Buffer, garment: Buffer, category: TryonCategory): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(`${tryonUrl()}/tryon`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: person.toString('base64'), garment: garment.toString('base64'), category }),
      signal: AbortSignal.timeout(200_000), // the bridge itself times out at 180 s
    });
  } catch (err) {
    resetTryonPingCache(); // force a re-ping so status flips to disabled quickly
    throw err;
  }
  if (!res.ok) throw new TryonError(res.status, `tryon bridge HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---- Daily quota (Asia/Taipei day). Reuses AiUsage with day = "tryon:YYYY-MM-DD" so no migration is needed ----
const quotaDay = () => `tryon:${taipeiDay()}`;

/** Atomically reserve one try-on. Returns the new count, or null when the limit is already reached. */
export async function reserveTryonQuota(userId: string): Promise<number | null> {
  const day = quotaDay();
  const limit = tryonDailyLimit();
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

export async function refundTryonQuota(userId: string): Promise<void> {
  await prisma.aiUsage
    .update({ where: { userId_day: { userId, day: quotaDay() } }, data: { count: { decrement: 1 } } })
    .catch(() => {});
}
