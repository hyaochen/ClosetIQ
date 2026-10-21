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

// ---- P4 ----
// ============ Outfit Canvas (collage) ============

export const CANVAS_LAYOUT_VERSION = 1 as const;

// Cover render output size (4:5 portrait) and thumbnail size
export const CANVAS_COVER_WIDTH = 1080;
export const CANVAS_COVER_HEIGHT = 1350;
export const CANVAS_THUMB_WIDTH = 360;
export const CANVAS_THUMB_HEIGHT = 450;

export const CanvasBackground = {
  card: 'card',
  white: 'white',
  clay: 'clay',
} as const;
export type CanvasBackground = (typeof CanvasBackground)[keyof typeof CanvasBackground];

export const CanvasBackgroundHex: Record<CanvasBackground, string> = {
  card: '#E9E2D4',
  white: '#FFFFFF',
  clay: '#D9C3B0',
};

const canvasBackgroundEnum = z.nativeEnum(CanvasBackground);

// All geometry is relative so the layout is resolution independent:
// - x, y: piece CENTER as a fraction of canvas width / height (0 = left/top, 1 = right/bottom)
// - scale: piece box side as a fraction of canvas WIDTH; the image is fitted (contain) inside a scale*W square
// - rotate: degrees, clockwise (same as CSS rotate)
// - z: stacking order, larger = on top
// - flipX: mirror horizontally (applied before rotation)
export const canvasPieceSchema = z.object({
  itemId: z.string().uuid(),
  imageId: z.string().uuid(),
  x: z.number().min(-0.5).max(1.5),
  y: z.number().min(-0.5).max(1.5),
  scale: z.number().min(0.05).max(2),
  rotate: z.number().min(-360).max(360).default(0),
  z: z.number().int().min(0).max(999).default(0),
  flipX: z.boolean().default(false),
});

export const canvasLayoutSchema = z
  .object({
    v: z.literal(CANVAS_LAYOUT_VERSION),
    background: canvasBackgroundEnum.default('card'),
    // Size of the editing canvas in logical px (only its aspect ratio matters to the renderer)
    width: z.number().min(100).max(4000),
    height: z.number().min(100).max(4000),
    pieces: z.array(canvasPieceSchema).max(30),
  })
  .refine((l) => new Set(l.pieces.map((p) => p.itemId)).size === l.pieces.length, {
    message: '同一件衣物在畫布上只能出現一次',
    path: ['pieces'],
  });

export const saveCanvasSchema = z.object({
  layout: canvasLayoutSchema,
  // true: make the outfit's item list equal to the placed pieces (adds missing, removes unplaced)
  syncItems: z.boolean().optional().default(false),
  // true: also render the cover image in the same call
  render: z.boolean().optional().default(false),
});

export const autoCanvasSchema = z.object({
  background: canvasBackgroundEnum.optional(),
  render: z.boolean().optional().default(false),
});

export type CanvasPiece = z.infer<typeof canvasPieceSchema>;
export type CanvasLayout = z.infer<typeof canvasLayoutSchema>;
export type SaveCanvasInput = z.infer<typeof saveCanvasSchema>;
export type AutoCanvasInput = z.infer<typeof autoCanvasSchema>;
