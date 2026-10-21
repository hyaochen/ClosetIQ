import { z } from 'zod';
import {
  ClothingCategory,
  ColorFamily,
  Pattern,
  Season,
  Occasion,
  Condition,
  DeclutterReason,
  WeatherCondition,
  LaundryStatus,
} from './enums';

// ============ Auth ============

export const registerSchema = z.object({
  email: z.string()
    .trim()
    .min(1, '請輸入帳號'),
  password: z.string()
    .min(1, '請輸入密碼'),
  displayName: z.string()
    .trim()
    .min(1, '請輸入顯示名稱')
    .max(50, '顯示名稱不得超過 50 個字元'),
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, '請輸入帳號'),
  password: z.string()
    .min(1, '請輸入密碼'),
});

// ============ Clothing Item ============

const clothingCategoryEnum = z.nativeEnum(ClothingCategory);
const colorFamilyEnum = z.nativeEnum(ColorFamily);
const patternEnum = z.nativeEnum(Pattern);
const seasonEnum = z.nativeEnum(Season);
const occasionEnum = z.nativeEnum(Occasion);
const conditionEnum = z.nativeEnum(Condition);
const declutterReasonEnum = z.nativeEnum(DeclutterReason);
const weatherConditionEnum = z.nativeEnum(WeatherCondition);
const laundryStatusEnum = z.nativeEnum(LaundryStatus);

export const createClothingItemSchema = z.object({
  name: z.string().min(1, '請輸入衣物名稱').max(100),
  category: clothingCategoryEnum,
  subcategory: z.string().max(50).optional(),
  colors: z.array(z.string()).min(1, '請至少選擇一個顏色').max(5),
  colorFamily: colorFamilyEnum,
  pattern: patternEnum.optional().default('SOLID'),
  material: z.string().max(50).optional(),
  brand: z.string().max(50).optional(),
  size: z.string().max(20).optional(),
  seasons: z.array(seasonEnum).min(1, '請至少選擇一個季節'),
  occasions: z.array(occasionEnum).min(1, '請至少選擇一個場合'),
  purchaseDate: z.string().optional(), // ISO date string
  purchasePrice: z.number().min(0).optional(),
  purchaseLocation: z.string().max(100).optional(),
  condition: conditionEnum.optional().default('GOOD'),
  notes: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  laundryStatus: laundryStatusEnum.optional(),
  storageLocationId: z.string().uuid().nullable().optional(),
});

export const updateClothingItemSchema = createClothingItemSchema.partial();

// ============ Outfit ============

export const createOutfitSchema = z.object({
  name: z.string().min(1, '請輸入穿搭名稱').max(100).optional(),
  itemIds: z.array(z.string().uuid()).min(1, '請至少選擇一件衣物'),
  occasions: z.array(occasionEnum).optional().default([]),
  seasons: z.array(seasonEnum).optional().default([]),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(500).optional(),
});

export const updateOutfitSchema = createOutfitSchema.partial();

// ============ Wear Log ============

export const createWearLogSchema = z.object({
  outfitId: z.string().uuid().optional(),
  itemIds: z.array(z.string().uuid()).min(1, '請至少選擇一件衣物'),
  date: z.string(), // ISO date string
  occasion: occasionEnum.optional(),
  weatherTemp: z.number().int().min(-50).max(60).optional(),
  weatherCondition: weatherConditionEnum.optional(),
  notes: z.string().max(500).optional(),
});

// ============ Query Params ============

export const itemsQuerySchema = z.object({
  category: clothingCategoryEnum.optional(),
  colorFamily: colorFamilyEnum.optional(),
  season: seasonEnum.optional(),
  occasion: occasionEnum.optional(),
  condition: conditionEnum.optional(),
  search: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional().default(true),
  storageLocationId: z.string().uuid().optional(),
  laundryStatus: laundryStatusEnum.optional(),
  inSeason: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['name', 'createdAt', 'wearCount', 'lastWorn', 'purchasePrice']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
});

export const suggestOutfitSchema = z.object({
  occasion: occasionEnum.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

// ============ Laundry / Storage / Settings ============

export const laundryBatchSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, '請至少選擇一件衣物').max(500),
  status: laundryStatusEnum,
});

export const bulkMoveSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, '請至少選擇一件衣物').max(500),
  storageLocationId: z.string().uuid().nullable(),
});

export const createStorageLocationSchema = z.object({
  name: z.string().trim().min(1, '請輸入位置名稱').max(30, '位置名稱不得超過 30 個字'),
  isOffSeason: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const updateStorageLocationSchema = createStorageLocationSchema.partial();

export const updateSettingsSchema = z.object({
  currentSeason: seasonEnum.nullable().optional(),
  autoDirtyOnWear: z.boolean().optional(),
  displayName: z.string().trim().min(1).max(50).optional(),
});

// ============ Type exports ============

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateClothingItemInput = z.infer<typeof createClothingItemSchema>;
export type UpdateClothingItemInput = z.infer<typeof updateClothingItemSchema>;
export type CreateOutfitInput = z.infer<typeof createOutfitSchema>;
export type UpdateOutfitInput = z.infer<typeof updateOutfitSchema>;
export type CreateWearLogInput = z.infer<typeof createWearLogSchema>;
export type ItemsQuery = z.infer<typeof itemsQuerySchema>;
export type SuggestOutfitInput = z.infer<typeof suggestOutfitSchema>;
export type LaundryBatchInput = z.infer<typeof laundryBatchSchema>;
export type BulkMoveInput = z.infer<typeof bulkMoveSchema>;
export type CreateStorageLocationInput = z.infer<typeof createStorageLocationSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ---- P6 ----
// ============ Wishlist =====
export const WishlistStatus = {
  WANT: 'WANT',
  BOUGHT: 'BOUGHT',
  DROPPED: 'DROPPED',
} as const;
export type WishlistStatus = (typeof WishlistStatus)[keyof typeof WishlistStatus];

const wishlistStatusEnum = z.nativeEnum(WishlistStatus);

// url 只存不抓：僅接受 http(s)
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, '商品連結必須是 http 或 https 網址');

export const createWishlistItemSchema = z.object({
  name: z.string().trim().min(1, '請輸入名稱').max(100),
  category: clothingCategoryEnum,
  subcategory: z.string().max(50).optional(),
  colorFamily: colorFamilyEnum,
  colors: z.array(z.string()).max(5).optional().default([]),
  pattern: patternEnum.optional(),
  // 空陣列 = 不限（視為四季／所有場合）
  seasons: z.array(seasonEnum).optional().default([]),
  occasions: z.array(occasionEnum).optional().default([]),
  price: z.number().min(0).max(99999999).optional(),
  url: httpUrl.optional(),
  note: z.string().max(500).optional(),
});

export const updateWishlistItemSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: clothingCategoryEnum.optional(),
  subcategory: z.string().max(50).nullable().optional(),
  colorFamily: colorFamilyEnum.optional(),
  colors: z.array(z.string()).max(5).optional(),
  pattern: patternEnum.nullable().optional(),
  seasons: z.array(seasonEnum).optional(),
  occasions: z.array(occasionEnum).optional(),
  price: z.number().min(0).max(99999999).nullable().optional(),
  url: httpUrl.nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  // 只允許 WANT / DROPPED；BOUGHT 只能經由 purchase 端點
  status: z.enum(['WANT', 'DROPPED']).optional(),
});

export const wishlistQuerySchema = z.object({
  status: wishlistStatusEnum.optional(),
  category: clothingCategoryEnum.optional(),
});

export const purchaseWishlistItemSchema = z.object({
  brand: z.string().max(50).optional(),
  size: z.string().max(20).optional(),
  material: z.string().max(50).optional(),
  purchaseDate: z.string().optional(),
  purchaseLocation: z.string().max(100).optional(),
  purchasePrice: z.number().min(0).optional(), // 預設沿用願望清單 price
  condition: conditionEnum.optional(),
  seasons: z.array(seasonEnum).optional(),
  occasions: z.array(occasionEnum).optional(),
});

export type CreateWishlistItemInput = z.infer<typeof createWishlistItemSchema>;
export type UpdateWishlistItemInput = z.infer<typeof updateWishlistItemSchema>;
export type WishlistQuery = z.infer<typeof wishlistQuerySchema>;
export type PurchaseWishlistItemInput = z.infer<typeof purchaseWishlistItemSchema>;

// 購前分析／衣櫃缺口 回傳型別（前端使用）
export interface WishlistCategoryCompat {
  category: ClothingCategory;
  compatible: number;
  total: number;
}

export interface WishlistSimilarItem {
  id: string;
  name: string;
  category: ClothingCategory;
  subcategory: string | null;
  colorFamily: ColorFamily;
  matchType: 'COLOR' | 'SUBCATEGORY'; // COLOR=同類別同色系(強)；SUBCATEGORY=同款式不同色(弱)
  thumbnail: string | null;
  recentWearCount: number; // 近 90 天
  totalWearCount: number;
}

export interface WishlistAnalysis {
  compatibleCount: number;
  totalConsidered: number;
  byCategory: WishlistCategoryCompat[];
  similarItems: WishlistSimilarItem[];
  score: number; // 0-100
  reasons: string[];
}

export type GapSeverity = 'high' | 'medium' | 'low';

export interface WardrobeGap {
  label: string;
  detail: string;
  severity: GapSeverity;
  kind: 'occasion' | 'season';
  occasion?: Occasion;
  season?: Season;
  count: number;
  min: number;
}

// ---- P5 ----
// 週穿搭計畫、天氣預報、旅行打包

const ymdString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式須為 YYYY-MM-DD');

export const weatherForecastQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    city: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.city !== undefined || (v.lat !== undefined && v.lon !== undefined), {
    message: '請提供 lat 與 lon，或 city',
  });

// 計畫相關 query：lat/lon 省略時使用台北
export const planRangeQuerySchema = z.object({
  from: ymdString.optional(),
  to: ymdString.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

export const autoPlanQuerySchema = planRangeQuerySchema.extend({
  occasion: occasionEnum.optional(),
});

// PUT /api/plans/:date：itemIds 或 outfitId 至少一個；兩者都給時以 itemIds 為準
export const upsertPlanSchema = z
  .object({
    outfitId: z.string().uuid().optional(),
    itemIds: z.array(z.string().uuid()).max(20).optional(),
    note: z.string().max(200).optional(),
  })
  .refine((v) => v.outfitId !== undefined || (v.itemIds !== undefined && v.itemIds.length > 0), {
    message: '請提供 outfitId 或至少一件衣物',
  });

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1, '請輸入旅行名稱').max(100),
    destination: z.string().trim().min(1, '請輸入目的地').max(100),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    startDate: ymdString,
    endDate: ymdString,
  })
  .refine((v) => v.endDate >= v.startDate, { message: '結束日期不可早於出發日期', path: ['endDate'] });

export const updateTripSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  destination: z.string().trim().min(1).max(100).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lon: z.number().min(-180).max(180).nullable().optional(),
  startDate: ymdString.optional(),
  endDate: ymdString.optional(),
});

export const createTripItemSchema = z
  .object({
    clothingItemId: z.string().uuid().optional(),
    customName: z.string().trim().min(1).max(50).optional(),
    category: clothingCategoryEnum.optional(),
    quantity: z.number().int().min(1).max(99).optional().default(1),
    reason: z.string().max(100).optional(),
  })
  .refine((v) => v.clothingItemId !== undefined || v.customName !== undefined, {
    message: '請選擇衣物或輸入自訂項目名稱',
  });

export const updateTripItemSchema = z.object({
  packed: z.boolean().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  customName: z.string().trim().min(1).max(50).optional(),
  reason: z.string().max(100).nullable().optional(),
});

export interface ForecastDay {
  date: string; // YYYY-MM-DD（台北時區）
  min: number;
  max: number;
  condition: WeatherCondition;
  rainChance: number; // 0-100
}

export type WeatherForecastQuery = z.infer<typeof weatherForecastQuerySchema>;
export type PlanRangeQuery = z.infer<typeof planRangeQuerySchema>;
export type AutoPlanQuery = z.infer<typeof autoPlanQuerySchema>;
export type UpsertPlanInput = z.infer<typeof upsertPlanSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateTripItemInput = z.infer<typeof createTripItemSchema>;
export type UpdateTripItemInput = z.infer<typeof updateTripItemSchema>;

// ---- P3 ----
// OOTD photo diary and monthly / yearly recap

const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式需為 YYYY-MM');
const dateString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, '日期格式需為 YYYY-MM-DD');

export const monthQuerySchema = z.object({ month: monthString });
export const yearQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/, '年份格式需為 YYYY'),
});

// POST /api/wear-logs/photo?date=YYYY-MM-DD (date defaults to today in Asia/Taipei)
export const wearLogPhotoCreateQuerySchema = z.object({
  date: dateString.optional(),
});

// PATCH /api/wear-logs/:id  (fill in items later after a photo-first log)
export const updateWearLogSchema = z.object({
  itemIds: z.array(z.string().uuid()).optional(),
  outfitId: z.string().uuid().nullable().optional(),
  occasion: occasionEnum.nullable().optional(),
  weatherTemp: z.number().int().min(-50).max(60).nullable().optional(),
  weatherCondition: weatherConditionEnum.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type UpdateWearLogInput = z.infer<typeof updateWearLogSchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type YearQuery = z.infer<typeof yearQuerySchema>;

export interface WearLogPhotoPaths {
  photoOriginalPath: string | null;
  photoDisplayPath: string | null;
  photoThumbnailPath: string | null;
}

export interface JournalItemThumb {
  id: string;
  name: string;
  category: string;
  colors: string[];
  thumbnailPath: string | null;
}

export interface JournalLog extends WearLogPhotoPaths {
  id: string;
  date: string; // YYYY-MM-DD
  occasion: string | null;
  notes: string | null;
  items: JournalItemThumb[];
}

export interface JournalDay {
  date: string; // YYYY-MM-DD
  logCount: number;
  // photo of the day: first log (by createdAt) that has a photo, else null
  photoThumbnailPath: string | null;
  photoDisplayPath: string | null;
  logs: JournalLog[];
}

// GET /api/wear-logs?month=YYYY-MM  -> only days that have at least one log
export interface JournalMonthResponse {
  month: string;
  days: JournalDay[];
}

export interface RecapItem {
  id: string;
  name: string;
  category: string;
  thumbnailPath: string | null;
  count: number;
}

export interface RecapPair {
  items: [
    { id: string; name: string; thumbnailPath: string | null },
    { id: string; name: string; thumbnailPath: string | null },
  ];
  count: number;
}

export interface RecapCore {
  daysLogged: number;
  wearLogCount: number;
  itemsWorn: number;
  wardrobeSize: number;
  usageRate: number; // 0..1, 4 decimals
  topItems: RecapItem[];
  topPairs: RecapPair[];
}

export interface MonthlyRecap extends RecapCore {
  month: string;
  throughDate: string; // today (Taipei) for the current month, else last day of month
  previous: { month: string; daysLogged: number; usageRate: number; wardrobeSize: number };
  usageRateDelta: number; // current - previous, 4 decimals
}

export interface YearlyRecap extends RecapCore {
  year: number;
  monthlyDaysLogged: number[]; // 12 entries, Jan..Dec
  monthlyUsageRate: number[]; // 12 entries
  previous: { year: number; daysLogged: number; usageRate: number; wardrobeSize: number };
  usageRateDelta: number;
}

// ---- P2 ---- AI 辨識（POST /api/items/analyze）與去背

export const analyzeByImageIdSchema = z.object({
  imageId: z.string().uuid(),
});

const confidence = z.number().min(0).max(1);

/** 單一欄位建議：值 + 信心值（0-1）。欄位值不合法時 API 會把整個欄位設為 null */
export function suggestionField<T extends z.ZodTypeAny>(value: T) {
  return z.object({ value, confidence }).nullable();
}

export const hexColorSchema = z.string().regex(/^#[0-9A-F]{6}$/);

export const itemSuggestionSchema = z.object({
  category: suggestionField(clothingCategoryEnum),
  subcategory: suggestionField(z.string().min(1).max(30)),
  colorFamily: suggestionField(colorFamilyEnum),
  colors: suggestionField(z.array(hexColorSchema).min(1).max(3)),
  pattern: suggestionField(patternEnum),
  material: suggestionField(z.string().min(1).max(30)),
  seasons: suggestionField(z.array(seasonEnum).min(1).max(4)),
  occasions: suggestionField(z.array(occasionEnum).min(1).max(5)),
  nameSuggestion: suggestionField(z.string().min(1).max(50)),
});

export const analyzeResponseSchema = z.object({
  provider: z.enum(['claude', 'mock']),
  model: z.string(),
  suggestion: itemSuggestionSchema,
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  }),
  quota: z.object({ limit: z.number().int(), used: z.number().int(), remaining: z.number().int() }),
});

export const cutoutStatusEnum = z.enum(['NONE', 'PENDING', 'DONE', 'FAILED']);

export type ItemSuggestion = z.infer<typeof itemSuggestionSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
