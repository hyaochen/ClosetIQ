import { CanvasBackgroundHex, type CanvasBackground, type CanvasLayout } from '@closet/shared';

/** 編輯中的片段：座標為 0-1 相對值（中心點），陣列順序 = 疊放順序（後面的在上層） */
export type EditorPiece = {
  itemId: string;
  imageId: string;
  /** 畫布上顯示的圖（去背圖優先） */
  path: string;
  name: string;
  category: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  flipX: boolean;
};

export const SCALE_MIN = 0.1;
export const SCALE_MAX = 1.6;
export const bgHex = (b: CanvasBackground) => CanvasBackgroundHex[b];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** 角度正規化到 (-180, 180] */
export function normDeg(d: number): number {
  let r = ((d + 180) % 360 + 360) % 360 - 180;
  if (r === -180) r = 180;
  return Math.round(r * 10) / 10;
}

type Img = {
  id: string;
  isPrimary?: boolean;
  displayPath?: string | null;
  thumbnailPath?: string | null;
  cutoutPath?: string | null;
  cutoutThumbPath?: string | null;
  cutoutStatus?: string | null;
};

export function primaryImage(item: any): Img | undefined {
  const imgs: Img[] = item?.images ?? [];
  return imgs.find((i) => i.isPrimary) ?? imgs[0];
}
/** 與後端 resolvePieceImagePath 同規則：去背完成才用去背圖 */
export function canvasImagePath(img?: Img): string | undefined {
  if (!img) return undefined;
  if (img.cutoutStatus === 'DONE' && img.cutoutPath) return img.cutoutPath;
  return img.displayPath ?? img.thumbnailPath ?? undefined;
}
export function trayThumbPath(img?: Img): string | undefined {
  if (!img) return undefined;
  if (img.cutoutStatus === 'DONE' && img.cutoutThumbPath) return img.cutoutThumbPath;
  return img.thumbnailPath ?? img.displayPath ?? undefined;
}

const SLOT: Record<string, { x: number; y: number; s: number }> = {
  TOP: { x: 0.62, y: 0.3, s: 0.46 },
  OUTERWEAR: { x: 0.34, y: 0.34, s: 0.5 },
  BOTTOM: { x: 0.52, y: 0.66, s: 0.5 },
  DRESS: { x: 0.5, y: 0.45, s: 0.6 },
  SHOES: { x: 0.34, y: 0.88, s: 0.3 },
  BAG: { x: 0.82, y: 0.2, s: 0.28 },
  ACCESSORY: { x: 0.8, y: 0.5, s: 0.2 },
  UNDERWEAR: { x: 0.8, y: 0.5, s: 0.25 },
};

/** 新加入衣物的預設位置：依類別錯開，已有片段時略為偏移避免完全重疊 */
export function defaultPiece(item: any, existing: number): EditorPiece | null {
  const img = primaryImage(item);
  const path = canvasImagePath(img);
  if (!img || !path) return null;
  const slot = SLOT[item.category] ?? { x: 0.5, y: 0.5, s: 0.4 };
  const jitter = (existing % 4) * 0.03;
  return {
    itemId: item.id,
    imageId: img.id,
    path,
    name: item.name,
    category: item.category,
    x: clamp(slot.x + jitter, 0.1, 0.9),
    y: clamp(slot.y + jitter, 0.1, 0.92),
    scale: slot.s,
    rotate: 0,
    flipX: false,
  };
}

/** 後端回傳的版面 -> 編輯用片段（依 z 排序；找不到衣物或圖片的片段略過） */
export function layoutToPieces(layout: CanvasLayout, itemsById: Map<string, any>): EditorPiece[] {
  return [...layout.pieces]
    .sort((a, b) => a.z - b.z)
    .flatMap((p) => {
      const item = itemsById.get(p.itemId);
      if (!item) return [];
      const imgs: Img[] = item.images ?? [];
      const img = imgs.find((i) => i.id === p.imageId) ?? primaryImage(item);
      const path = canvasImagePath(img);
      if (!img || !path) return [];
      return [{ itemId: item.id, imageId: img.id, path, name: item.name, category: item.category, x: p.x, y: p.y, scale: p.scale, rotate: p.rotate, flipX: p.flipX }];
    });
}

export function piecesToLayout(pieces: EditorPiece[], background: CanvasBackground, width: number, height: number): CanvasLayout {
  return {
    v: 1,
    background,
    width: Math.round(width),
    height: Math.round(height),
    pieces: pieces.map((p, i) => ({
      itemId: p.itemId,
      imageId: p.imageId,
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
      scale: Math.round(p.scale * 1000) / 1000,
      rotate: normDeg(p.rotate),
      z: i,
      flipX: p.flipX,
    })),
  };
}
