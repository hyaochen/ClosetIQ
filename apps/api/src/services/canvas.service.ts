import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {
  CANVAS_COVER_HEIGHT,
  CANVAS_COVER_WIDTH,
  CANVAS_THUMB_HEIGHT,
  CANVAS_THUMB_WIDTH,
  CanvasBackgroundHex,
  type CanvasLayout,
  type CanvasPiece,
  type CanvasBackground,
} from '@closet/shared';

const STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || './data/images';

// ---- image source abstraction ----

interface ImageLike {
  displayPath: string;
  // P2 adds a background-removed image path; until that branch is merged this field does not exist
  cutoutPath?: string | null;
}

/**
 * Which stored file a canvas piece should be drawn from.
 * Prefers the background-removed image (cutoutPath, added by P2) and falls back to displayPath.
 * This is the single place to change after P2 is merged.
 */
export function resolvePieceImagePath(image: ImageLike): string {
  return image.cutoutPath || image.displayPath;
}

// ---- compositing ----

export interface RenderPiece extends CanvasPiece {
  /** storage-relative path of the file to draw */
  file: string;
}

interface RenderOptions {
  width?: number;
  height?: number;
}

/**
 * Compose a layout into a raw PNG-capable sharp pipeline.
 * The layout canvas (aspect = layout.width/layout.height) is fitted (contain) into the output
 * size and centered; the remaining margin is filled with the background color.
 */
export async function composeCanvas(
  layout: Pick<CanvasLayout, 'background' | 'width' | 'height'>,
  pieces: RenderPiece[],
  opts: RenderOptions = {}
): Promise<sharp.Sharp> {
  const outW = opts.width ?? CANVAS_COVER_WIDTH;
  const outH = opts.height ?? CANVAS_COVER_HEIGHT;
  const bg = CanvasBackgroundHex[layout.background as CanvasBackground] ?? CanvasBackgroundHex.card;

  // uniform scale of the editing canvas into the output
  const k = Math.min(outW / layout.width, outH / layout.height);
  const cw = layout.width * k;
  const ch = layout.height * k;
  const offX = (outW - cw) / 2;
  const offY = (outH - ch) / 2;

  const overlays: sharp.OverlayOptions[] = [];
  const sorted = [...pieces].sort((a, b) => a.z - b.z);

  for (const p of sorted) {
    const box = Math.max(1, Math.round(p.scale * cw));
    let pipeline = sharp(path.join(STORAGE_PATH, p.file))
      .rotate() // EXIF
      .ensureAlpha()
      .resize(box, box, { fit: 'inside', withoutEnlargement: false })
      .toColourspace('srgb');
    if (p.flipX) pipeline = pipeline.flop();
    let buf = await pipeline.png().toBuffer();

    if (Math.abs(p.rotate % 360) > 0.01) {
      // rotate() grows the canvas to the rotated bounding box; the image center stays the center
      buf = await sharp(buf)
        .rotate(p.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    }

    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const cx = offX + p.x * cw;
    const cy = offY + p.y * ch;
    const left = Math.round(cx - w / 2);
    const top = Math.round(cy - h / 2);

    // sharp composite does not accept negative or overflowing placement: crop to the output rect
    const sx = Math.max(0, -left);
    const sy = Math.max(0, -top);
    const ex = Math.min(w, outW - left);
    const ey = Math.min(h, outH - top);
    if (ex - sx <= 0 || ey - sy <= 0) continue; // completely off-canvas

    if (sx > 0 || sy > 0 || ex < w || ey < h) {
      buf = await sharp(buf)
        .extract({ left: sx, top: sy, width: ex - sx, height: ey - sy })
        .png()
        .toBuffer();
    }
    overlays.push({ input: buf, left: left + sx, top: top + sy });
  }

  return sharp({
    create: { width: outW, height: outH, channels: 3, background: bg },
  }).composite(overlays);
}

export async function renderCoverBuffers(
  layout: Pick<CanvasLayout, 'background' | 'width' | 'height'>,
  pieces: RenderPiece[]
): Promise<{ cover: Buffer; thumb: Buffer }> {
  // render once at full size as PNG, derive both outputs
  const png = await (await composeCanvas(layout, pieces)).png().toBuffer();
  const cover = await sharp(png).webp({ quality: 85 }).toBuffer();
  const thumb = await sharp(png)
    .resize(CANVAS_THUMB_WIDTH, CANVAS_THUMB_HEIGHT, { fit: 'cover' })
    .webp({ quality: 78 })
    .toBuffer();
  return { cover, thumb };
}

export async function renderPngBuffer(
  layout: Pick<CanvasLayout, 'background' | 'width' | 'height'>,
  pieces: RenderPiece[]
): Promise<Buffer> {
  return (await composeCanvas(layout, pieces)).png().toBuffer();
}

// ---- cover file storage ----

export async function saveCoverFiles(
  userId: string,
  outfitId: string,
  cover: Buffer,
  thumb: Buffer
): Promise<{ coverPath: string; coverThumbPath: string }> {
  const dir = path.join(STORAGE_PATH, userId, 'cover');
  await fs.mkdir(dir, { recursive: true });
  // new file name per render: the image route sends max-age=3600, a stable name would serve stale covers
  const stamp = Date.now().toString(36);
  const coverRel = `${userId}/cover/${outfitId}-${stamp}.webp`;
  const thumbRel = `${userId}/cover/${outfitId}-${stamp}-thumb.webp`;
  await fs.writeFile(path.join(STORAGE_PATH, coverRel), cover);
  await fs.writeFile(path.join(STORAGE_PATH, thumbRel), thumb);
  return { coverPath: coverRel, coverThumbPath: thumbRel };
}

export async function deleteCoverFiles(paths: Array<string | null | undefined>) {
  for (const p of paths) {
    if (!p) continue;
    try {
      await fs.unlink(path.join(STORAGE_PATH, p));
    } catch {
      // already gone
    }
  }
}

// ---- auto layout ----

interface Slot {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  z: number;
}

// Flat-lay composition derived from the design mock (Canvas.dc.html, 350x392 area) on a 4:5 canvas.
// Several items of the same category take the following slots in order.
const SLOTS: Record<string, Slot[]> = {
  OUTERWEAR: [
    { x: 0.3, y: 0.3, scale: 0.5, rotate: -7, z: 3 },
    { x: 0.32, y: 0.5, scale: 0.4, rotate: -4, z: 3 },
  ],
  TOP: [
    { x: 0.62, y: 0.27, scale: 0.44, rotate: -3, z: 2 },
    { x: 0.66, y: 0.44, scale: 0.36, rotate: 3, z: 2 },
  ],
  DRESS: [
    { x: 0.5, y: 0.38, scale: 0.62, rotate: 0, z: 2 },
    { x: 0.7, y: 0.5, scale: 0.4, rotate: 4, z: 2 },
  ],
  BOTTOM: [
    { x: 0.7, y: 0.62, scale: 0.5, rotate: 2, z: 1 },
    { x: 0.5, y: 0.7, scale: 0.4, rotate: -2, z: 1 },
  ],
  SHOES: [
    { x: 0.24, y: 0.8, scale: 0.34, rotate: 4, z: 4 },
    { x: 0.5, y: 0.88, scale: 0.3, rotate: -3, z: 4 },
  ],
  BAG: [
    { x: 0.86, y: 0.12, scale: 0.26, rotate: 8, z: 6 },
    { x: 0.2, y: 0.1, scale: 0.26, rotate: -6, z: 6 },
  ],
  ACCESSORY: [
    { x: 0.5, y: 0.1, scale: 0.18, rotate: 0, z: 5 },
    { x: 0.88, y: 0.4, scale: 0.16, rotate: 10, z: 5 },
    { x: 0.1, y: 0.58, scale: 0.16, rotate: -8, z: 5 },
    { x: 0.86, y: 0.86, scale: 0.16, rotate: 6, z: 5 },
  ],
  UNDERWEAR: [
    { x: 0.82, y: 0.86, scale: 0.18, rotate: 0, z: 5 },
    { x: 0.62, y: 0.9, scale: 0.16, rotate: 0, z: 5 },
  ],
};
const OVERFLOW_SLOT: Slot = { x: 0.5, y: 0.5, scale: 0.3, rotate: 0, z: 7 };

export interface AutoLayoutItem {
  itemId: string;
  imageId: string;
  category: string;
}

export function buildAutoLayout(
  items: AutoLayoutItem[],
  background: CanvasBackground = 'card'
): CanvasLayout {
  const used: Record<string, number> = {};
  const pieces: CanvasPiece[] = items.map((it) => {
    const slots = SLOTS[it.category] ?? [OVERFLOW_SLOT];
    const n = used[it.category] ?? 0;
    used[it.category] = n + 1;
    // beyond the defined slots, stagger so pieces do not sit exactly on top of each other
    const slot = slots[n] ?? {
      ...OVERFLOW_SLOT,
      x: 0.35 + ((n * 0.13) % 0.4),
      y: 0.35 + ((n * 0.11) % 0.4),
    };
    return {
      itemId: it.itemId,
      imageId: it.imageId,
      x: slot.x,
      y: slot.y,
      scale: slot.scale,
      rotate: slot.rotate,
      z: slot.z,
      flipX: false,
    };
  });
  return { v: 1, background, width: 1080, height: 1350, pieces };
}
