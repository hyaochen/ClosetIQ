export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export function imageUrl(path: string): string {
  return `${API_BASE}/api/images/file/${path}`;
}

/** 後端 ClothingImage 與去背相關的欄位（P2） */
export type ImageLike = {
  id?: string;
  thumbnailPath?: string | null;
  displayPath?: string | null;
  cutoutStatus?: string | null;
  cutoutPath?: string | null;
  cutoutThumbPath?: string | null;
};

/**
 * 縮圖路徑 -> 該張圖的去背資訊。api() 每次收到回應都會把裡面所有 ClothingImage 物件登記進來，
 * GarmentTile 只拿到 thumbnailPath 字串時，靠這張表決定要不要改用去背圖。
 * 這樣各畫面不必改，只要資料是從 api() 來的就會自動套用去背。
 */
const registry = new Map<string, ImageLike>();

export function registerImages(data: unknown, depth = 0): void {
  if (!data || typeof data !== 'object' || depth > 8) return;
  if (Array.isArray(data)) {
    for (const v of data) registerImages(v, depth + 1);
    return;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.thumbnailPath === 'string' && 'cutoutStatus' in o) {
    registry.set(o.thumbnailPath, o as ImageLike);
  }
  for (const k in o) {
    const v = o[k];
    if (v && typeof v === 'object') registerImages(v, depth + 1);
  }
}

export function hasCutout(img?: ImageLike | null): boolean {
  return !!img && img.cutoutStatus === 'DONE' && !!img.cutoutPath;
}

/** 小圖（縮圖）要顯示哪一張：去背完成用去背縮圖，否則用原縮圖。 */
export function tileImage(path?: string | null, image?: ImageLike | null): { path: string | null; cutout: boolean } {
  const img = image ?? (path ? registry.get(path) : undefined);
  if (img && hasCutout(img)) {
    const p = img.cutoutThumbPath || img.cutoutPath!;
    return { path: p, cutout: true };
  }
  return { path: image?.thumbnailPath ?? path ?? null, cutout: false };
}

/** 大圖（單品詳情等）：去背完成用去背大圖，否則用 displayPath。 */
export function fullImage(img?: ImageLike | null): { path: string | null; cutout: boolean } {
  if (img && hasCutout(img)) return { path: img.cutoutPath!, cutout: true };
  return { path: img?.displayPath ?? img?.thumbnailPath ?? null, cutout: false };
}
