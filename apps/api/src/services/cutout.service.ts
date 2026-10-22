// ---- P2 ---- Background removal via the rembg sidecar (HTTP, compose-internal only)
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import { storagePath } from '../lib/storage.js';


// Feature is on only when REMBG_URL is set. Without it uploads behave exactly as before.
export const rembgUrl = () => (process.env.REMBG_URL || '').replace(/\/$/, '');
export const cutoutEnabled = () => rembgUrl() !== '';
const rembgModel = () => process.env.REMBG_MODEL || 'isnet-general-use';
// The first request after the sidecar starts also loads the model (~10s on CPU), so 60s default.
const timeoutMs = () => parseInt(process.env.CUTOUT_TIMEOUT_MS || '60000');

const SEND_MAX_EDGE = 1024; // long edge sent to rembg (the model works at low res anyway)
const OUT_MAX_EDGE = 1024; // long edge of the stored transparent cutout
const THUMB_EDGE = 300;
const ALPHA_THRESHOLD = 16;
const MIN_COVERAGE = 0.01; // less than 1% opaque pixels => mask is empty, treat as failure

class Queue {
  private running = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly concurrency: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
}
// Single in-flight rembg call: the sidecar is CPU bound and has a memory cap.
const queue = new Queue(1);

async function callRembg(jpeg: Buffer): Promise<Buffer> {
  const fd = new FormData();
  fd.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'in.jpg');
  fd.append('model', rembgModel());
  const res = await fetch(`${rembgUrl()}/api/remove`, {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(timeoutMs()),
  });
  if (!res.ok) throw new Error(`rembg HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Crop to the opaque bounding box (+4% pad) so collage / card layouts can centre the garment. */
async function trimToSubject(png: Buffer): Promise<{ image: Buffer; coverage: number }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const coverage = opaque / (width * height);
  if (maxX < 0) return { image: png, coverage: 0 };
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);
  const image = await sharp(png)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .toBuffer();
  return { image, coverage };
}

/** User chose the original photo: drop any cutout files and mark SKIPPED (a still-running job will discard its result). */
export async function skipCutout(imageId: string): Promise<void> {
  const image = await prisma.clothingImage.findUnique({ where: { id: imageId } });
  if (!image) return;
  const root = storagePath();
  for (const p of [image.cutoutPath, image.cutoutThumbPath]) {
    if (p) await fs.unlink(path.join(root, p)).catch(() => {});
  }
  await prisma.clothingImage.update({
    where: { id: imageId },
    data: { cutoutStatus: 'SKIPPED', cutoutPath: null, cutoutThumbPath: null, cutoutError: null, cutoutAt: null },
  });
}

async function markFailed(imageId: string, reason: string) {
  await prisma.clothingImage
    .updateMany({ where: { id: imageId, cutoutStatus: 'PENDING' }, data: { cutoutStatus: 'FAILED', cutoutError: reason.slice(0, 200) } })
    .catch(() => {});
}

/**
 * Generate the cutout for one image. Never throws: failures are recorded as FAILED so that
 * uploads are never affected by a missing / slow / crashed rembg.
 */
export async function runCutout(imageId: string): Promise<void> {
  if (!cutoutEnabled()) return;
  try {
    await queue.run(async () => {
      const image = await prisma.clothingImage.findUnique({ where: { id: imageId } });
      if (!image) return; // deleted while queued
      if (image.cutoutStatus === 'SKIPPED') return; // user picked the original while it was queued
      await prisma.clothingImage.update({
        where: { id: imageId },
        data: { cutoutStatus: 'PENDING', cutoutError: null },
      });

      const root = storagePath();
      const src = await fs.readFile(path.join(root, image.originalPath));
      const jpeg = await sharp(src)
        .rotate()
        .resize(SEND_MAX_EDGE, SEND_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#FFFFFF' })
        .jpeg({ quality: 90 })
        .toBuffer();

      const cut = await callRembg(jpeg);
      const { image: trimmed, coverage } = await trimToSubject(cut);
      if (coverage < MIN_COVERAGE) throw new Error('empty mask');

      // Same user dir layout as the other variants
      const userDir = image.originalPath.split('/')[0];
      const base = path.basename(image.originalPath).replace(/-original\.webp$/, '');
      await fs.mkdir(path.join(root, userDir, 'cutout'), { recursive: true });
      const cutoutPath = `${userDir}/cutout/${base}-cutout.webp`;
      const cutoutThumbPath = `${userDir}/cutout/${base}-cutout-thumb.webp`;

      await sharp(trimmed)
        .resize(OUT_MAX_EDGE, OUT_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, alphaQuality: 100 })
        .toFile(path.join(root, cutoutPath));
      await sharp(trimmed)
        .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, alphaQuality: 100 })
        .toFile(path.join(root, cutoutThumbPath));

      // The row may have been deleted, or switched to SKIPPED, while rembg was running
      const written = await prisma.clothingImage
        .updateMany({
          where: { id: imageId, cutoutStatus: 'PENDING' },
          data: { cutoutPath, cutoutThumbPath, cutoutStatus: 'DONE', cutoutError: null, cutoutAt: new Date() },
        })
        .catch(() => ({ count: 0 }));
      if (written.count === 0) {
        await fs.unlink(path.join(root, cutoutPath)).catch(() => {});
        await fs.unlink(path.join(root, cutoutThumbPath)).catch(() => {});
      }
    });
  } catch (err: any) {
    const reason = err?.name === 'TimeoutError' ? 'rembg timeout' : err?.message || 'unknown error';
    console.error(`[cutout] ${imageId} failed: ${reason}`);
    await markFailed(imageId, reason);
  }
}

/** Fire and forget; safe to call from request handlers. */
export function enqueueCutout(imageId: string): void {
  if (!cutoutEnabled()) return;
  void runCutout(imageId);
}

// ---- Backfill (per user, in-memory job state, cancellable) ----
export interface BackfillJob {
  total: number;
  done: number;
  failed: number;
  cancelled: boolean;
  running: boolean;
  startedAt: string;
}
const jobs = new Map<string, BackfillJob>();

export function getBackfillJob(userId: string): BackfillJob | null {
  return jobs.get(userId) ?? null;
}

export function cancelBackfill(userId: string): boolean {
  const job = jobs.get(userId);
  if (!job || !job.running) return false;
  job.cancelled = true;
  return true;
}

const STALE_PENDING_MS = 10 * 60 * 1000;

export async function startBackfill(userId: string, limit: number): Promise<BackfillJob> {
  const existing = jobs.get(userId);
  if (existing?.running) return existing;

  const staleBefore = new Date(Date.now() - STALE_PENDING_MS);
  // Only the caller's images. PENDING rows older than 10 minutes are orphans of a crash / restart.
  const targets = await prisma.clothingImage.findMany({
    where: {
      clothingItem: { userId },
      OR: [
        { cutoutStatus: { in: ['NONE', 'FAILED'] } },
        { cutoutStatus: 'PENDING', createdAt: { lt: staleBefore } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true },
  });

  const job: BackfillJob = {
    total: targets.length,
    done: 0,
    failed: 0,
    cancelled: false,
    running: targets.length > 0,
    startedAt: new Date().toISOString(),
  };
  jobs.set(userId, job);

  void (async () => {
    for (const t of targets) {
      if (job.cancelled) break;
      await runCutout(t.id);
      const after = await prisma.clothingImage.findUnique({
        where: { id: t.id },
        select: { cutoutStatus: true },
      });
      if (after?.cutoutStatus === 'FAILED') job.failed++;
      job.done++;
    }
    job.running = false;
  })();

  return job;
}

export async function countBackfillRemaining(userId: string): Promise<number> {
  return prisma.clothingImage.count({
    where: { clothingItem: { userId }, cutoutStatus: { in: ['NONE', 'FAILED'] } },
  });
}
