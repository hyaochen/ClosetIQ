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
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
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
