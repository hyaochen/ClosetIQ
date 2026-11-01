// ---- T-CL-022 ---- Virtual try-on through the host tryon-bridge (FASHN VTON v1.5, local GPU)
//
// The bridge (tools/tryon-bridge) keeps the model resident and runs one try-on at a time.
// Nothing here is persisted: the person photo and the result only live in api memory.
// T-CL-023: submit + poll. The public site sits behind a Cloudflare tunnel that cuts a request at 100 s
// (524), and a contended GPU needs minutes per image, so POST /api/tryon answers 202 at once and the
// api (same host as the bridge, no tunnel in between) works the job in the background.
import { randomUUID } from 'node:crypto';
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

const envInt = (name: string, def: number) => {
  const n = parseInt(process.env[name] || '');
  return Number.isFinite(n) && n > 0 ? n : def;
};
/** How long the api waits for the bridge per job (api and bridge are both local, so this can be long). */
export const tryonJobTimeoutMs = () => envInt('TRYON_JOB_TIMEOUT_MS', 600_000);
/** How long a finished/failed job (and its PNG) stays in memory. */
export const tryonJobTtlMs = () => envInt('TRYON_JOB_TTL_MS', 15 * 60_000);
/** Max jobs held at once (queued + running + finished-not-yet-expired). */
export const tryonMaxJobs = () => envInt('TRYON_MAX_JOBS', 50);
/** Max jobs waiting for the single GPU slot (all users together). */
export const tryonMaxQueued = () => envInt('TRYON_MAX_QUEUED', 4);

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
      signal: AbortSignal.timeout(tryonJobTimeoutMs()), // the bridge itself times out a little earlier (570 s)
    });
  } catch (err: any) {
    resetTryonPingCache(); // force a re-ping so status flips to disabled quickly
    if (err?.name === 'TimeoutError') throw new TryonError(504, 'tryon bridge timeout (api side)');
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

// ---- Job store (in memory only; an api restart loses every job, the client shows "not found, retry") ----
export type TryonJobStatus = 'queued' | 'running' | 'done' | 'failed';
interface TryonJob {
  id: string;
  userId: string;
  status: TryonJobStatus;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  expiresAt?: number; // set when the job ends; queued/running jobs never expire
  person: Buffer | null;
  garment: Buffer | null;
  category: TryonCategory;
  png: Buffer | null;
  onFail?: () => void | Promise<void>;
}

const jobs = new Map<string, TryonJob>();
const waiting: TryonJob[] = []; // FIFO for the single GPU slot
let draining = false;

/** Drop expired jobs. Called on every access; `now` is injectable for tests. */
export function sweepTryonJobs(now = Date.now()) {
  for (const [id, j] of jobs) {
    if (j.expiresAt !== undefined && j.expiresAt <= now) jobs.delete(id);
  }
}
const sweeper = setInterval(() => sweepTryonJobs(), 60_000);
sweeper.unref();

export function userHasActiveTryonJob(userId: string): boolean {
  sweepTryonJobs();
  for (const j of jobs.values()) if (j.userId === userId && (j.status === 'queued' || j.status === 'running')) return true;
  return false;
}

function failMessage(err: unknown): string {
  if (err instanceof TryonError && err.status === 429) return '試穿服務忙碌中，請稍後再試';
  if (err instanceof TryonError && err.status === 400) return '這張照片無法用於試穿，請換一張清楚的全身照';
  if (err instanceof TryonError && err.status === 504) return '合成逾時，主機可能正忙，請稍後再試';
  return '虛擬試穿暫時失敗，請稍後再試';
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (let job = waiting.shift(); job; job = waiting.shift()) {
      job.status = 'running';
      job.startedAt = Date.now();
      try {
        const png = await runTryon(job.person!, job.garment!, job.category);
        job.png = png;
        job.status = 'done';
      } catch (err: any) {
        job.status = 'failed';
        job.error = failMessage(err);
        console.error(`[tryon] job ${job.id} failed: ${err?.message || err}`);
        try {
          await job.onFail?.();
        } catch {
          /* quota refund is best effort */
        }
      } finally {
        job.person = null; // the portrait never outlives its inference
        job.garment = null;
        job.finishedAt = Date.now();
        job.expiresAt = job.finishedAt + tryonJobTtlMs();
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Register a job and start working it in the background. Throws TryonError:
 * 409 the user already has a job in flight, 503 too many jobs queued / held.
 * `onFail` runs once when the bridge call fails (the route refunds the daily quota there).
 */
export function submitTryonJob(
  userId: string,
  person: Buffer,
  garment: Buffer,
  category: TryonCategory,
  onFail?: () => void | Promise<void>,
): string {
  if (userHasActiveTryonJob(userId)) throw new TryonError(409, '你已有一張試穿正在進行，請等它完成');
  if (waiting.length >= tryonMaxQueued() || jobs.size >= tryonMaxJobs()) throw new TryonError(503, '試穿服務忙碌中，請稍後再試');
  const id = randomUUID();
  const job: TryonJob = { id, userId, status: 'queued', createdAt: Date.now(), person, garment, category, png: null, onFail };
  jobs.set(id, job);
  waiting.push(job);
  void drain();
  return id;
}

export interface TryonJobView {
  status: TryonJobStatus;
  error?: string;
  queuePosition?: number; // 1 = next in line (only while queued)
  elapsedMs: number;
}

/** null when missing, expired or owned by someone else (all look the same to the caller). */
export function getTryonJob(userId: string, id: string, now = Date.now()): TryonJobView | null {
  sweepTryonJobs(now);
  const j = jobs.get(id);
  if (!j || j.userId !== userId) return null;
  const view: TryonJobView = { status: j.status, elapsedMs: Math.max(0, (j.finishedAt ?? now) - j.createdAt) };
  if (j.status === 'queued') view.queuePosition = waiting.indexOf(j) + 1;
  if (j.status === 'failed') view.error = j.error;
  return view;
}

/** PNG of a finished job: Buffer, 'notready' while queued/running/failed, null when missing or not yours. */
export function getTryonResult(userId: string, id: string, now = Date.now()): Buffer | 'notready' | null {
  sweepTryonJobs(now);
  const j = jobs.get(id);
  if (!j || j.userId !== userId) return null;
  return j.status === 'done' && j.png ? j.png : 'notready';
}

/** test hook */
export function resetTryonJobs() {
  jobs.clear();
  waiting.length = 0;
}
