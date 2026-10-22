// 衣物小圖（方塊縮圖）一律由後端決定：去背完成用去背縮圖，否則用原縮圖。
// 前端不需要知道去背狀態，直接用 tileThumbPath / tileCutout 顯示。

/** Prisma select 片段：只回傳需要決定小圖的欄位 */
export const TILE_IMAGE_SELECT = {
  thumbnailPath: true,
  cutoutStatus: true,
  cutoutPath: true,
  cutoutThumbPath: true,
} as const;

export interface TileImageSource {
  thumbnailPath: string;
  cutoutStatus?: string | null;
  cutoutPath?: string | null;
  cutoutThumbPath?: string | null;
}

export interface TileFields {
  /** 要顯示的小圖路徑（去背完成=去背縮圖，否則原縮圖；沒有圖=null） */
  tileThumbPath: string | null;
  /** 顯示的是去背圖（透明底，前端留邊距並用 contain） */
  tileCutout: boolean;
}

export function tileFields(img?: TileImageSource | null): TileFields {
  if (!img) return { tileThumbPath: null, tileCutout: false };
  if (img.cutoutStatus === 'DONE' && img.cutoutPath) {
    return { tileThumbPath: img.cutoutThumbPath || img.cutoutPath, tileCutout: true };
  }
  return { tileThumbPath: img.thumbnailPath ?? null, tileCutout: false };
}
