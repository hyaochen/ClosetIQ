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
