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
 * 後端直接回傳的衣物小圖欄位（lib 內 TileFields）：tileThumbPath 已決定好是去背縮圖或原縮圖。
 * 只拿到縮圖路徑字串的畫面（計畫、日記、回顧、相似單品等）一律用這組欄位，前端不再猜去背狀態。
 */
export type TileLike = { tileThumbPath?: string | null; tileCutout?: boolean };

export function hasCutout(img?: ImageLike | null): boolean {
  return !!img && img.cutoutStatus === 'DONE' && !!img.cutoutPath;
}

/**
 * 小圖要顯示哪一張：優先用後端給的 tile 欄位；其次是完整 ClothingImage 物件（有去背資訊就用去背縮圖）；
 * 最後退回傳入的原縮圖路徑。
 */
export function tileImage(path?: string | null, image?: ImageLike | null, tile?: TileLike | null): { path: string | null; cutout: boolean } {
  if (tile?.tileThumbPath) return { path: tile.tileThumbPath, cutout: !!tile.tileCutout };
  if (image && hasCutout(image)) return { path: image.cutoutThumbPath || image.cutoutPath!, cutout: true };
  return { path: image?.thumbnailPath ?? path ?? null, cutout: false };
}

/** 大圖（單品詳情等）：去背完成用去背大圖，否則用 displayPath。 */
export function fullImage(img?: ImageLike | null): { path: string | null; cutout: boolean } {
  if (img && hasCutout(img)) return { path: img.cutoutPath!, cutout: true };
  return { path: img?.displayPath ?? img?.thumbnailPath ?? null, cutout: false };
}

/** 完整 ClothingImage 物件 -> 小圖網址（有去背用去背縮圖）；沒有圖回 null。 */
export function imageTileUrl(image?: ImageLike | null): string | null {
  const p = tileImage(null, image).path;
  return p ? imageUrl(p) : null;
}
