// 衣物分類
export const ClothingCategory = {
  TOP: 'TOP',
  BOTTOM: 'BOTTOM',
  OUTERWEAR: 'OUTERWEAR',
  DRESS: 'DRESS',
  SHOES: 'SHOES',
  ACCESSORY: 'ACCESSORY',
  UNDERWEAR: 'UNDERWEAR',
  BAG: 'BAG',
} as const;
export type ClothingCategory = (typeof ClothingCategory)[keyof typeof ClothingCategory];

// 分類中文對照
export const ClothingCategoryLabel: Record<ClothingCategory, string> = {
  TOP: '上衣',
  BOTTOM: '下身',
  OUTERWEAR: '外套',
  DRESS: '洋裝/連身',
  SHOES: '鞋子',
  ACCESSORY: '配件',
  UNDERWEAR: '內衣褲',
  BAG: '包包',
};

// 色系
export const ColorFamily = {
  RED: 'RED',
  ORANGE: 'ORANGE',
  YELLOW: 'YELLOW',
  GREEN: 'GREEN',
  BLUE: 'BLUE',
  PURPLE: 'PURPLE',
  PINK: 'PINK',
  BLACK: 'BLACK',
  WHITE: 'WHITE',
  GREY: 'GREY',
  BROWN: 'BROWN',
  BEIGE: 'BEIGE',
  MULTI: 'MULTI',
} as const;
export type ColorFamily = (typeof ColorFamily)[keyof typeof ColorFamily];

export const ColorFamilyLabel: Record<ColorFamily, string> = {
  RED: '紅色',
  ORANGE: '橘色',
  YELLOW: '黃色',
  GREEN: '綠色',
  BLUE: '藍色',
  PURPLE: '紫色',
  PINK: '粉紅',
  BLACK: '黑色',
  WHITE: '白色',
  GREY: '灰色',
  BROWN: '棕色',
  BEIGE: '米色',
  MULTI: '多色',
};

// 圖案
export const Pattern = {
  SOLID: 'SOLID',
  STRIPED: 'STRIPED',
  PLAID: 'PLAID',
  FLORAL: 'FLORAL',
  POLKA_DOT: 'POLKA_DOT',
  GRAPHIC: 'GRAPHIC',
  OTHER: 'OTHER',
} as const;
export type Pattern = (typeof Pattern)[keyof typeof Pattern];

export const PatternLabel: Record<Pattern, string> = {
  SOLID: '素色',
  STRIPED: '條紋',
  PLAID: '格紋',
  FLORAL: '花卉',
  POLKA_DOT: '圓點',
  GRAPHIC: '圖案',
  OTHER: '其他',
};

// 季節
export const Season = {
  SPRING: 'SPRING',
  SUMMER: 'SUMMER',
  AUTUMN: 'AUTUMN',
  WINTER: 'WINTER',
} as const;
export type Season = (typeof Season)[keyof typeof Season];

export const SeasonLabel: Record<Season, string> = {
  SPRING: '春',
  SUMMER: '夏',
  AUTUMN: '秋',
  WINTER: '冬',
};

// 場合
export const Occasion = {
  CASUAL: 'CASUAL',
  WORK: 'WORK',
  FORMAL: 'FORMAL',
  SPORT: 'SPORT',
  LOUNGE: 'LOUNGE',
} as const;
export type Occasion = (typeof Occasion)[keyof typeof Occasion];

export const OccasionLabel: Record<Occasion, string> = {
  CASUAL: '休閒',
  WORK: '上班',
  FORMAL: '正式',
  SPORT: '運動',
  LOUNGE: '居家',
};

// 衣物狀況
export const Condition = {
  NEW: 'NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  WORN: 'WORN',
} as const;
export type Condition = (typeof Condition)[keyof typeof Condition];

export const ConditionLabel: Record<Condition, string> = {
  NEW: '全新',
  GOOD: '良好',
  FAIR: '普通',
  WORN: '老舊',
};

// 斷捨離原因
export const DeclutterReason = {
  DONATED: 'DONATED',
  SOLD: 'SOLD',
  DISCARDED: 'DISCARDED',
  GIFTED: 'GIFTED',
} as const;
export type DeclutterReason = (typeof DeclutterReason)[keyof typeof DeclutterReason];

export const DeclutterReasonLabel: Record<DeclutterReason, string> = {
  DONATED: '捐贈',
  SOLD: '售出',
  DISCARDED: '丟棄',
  GIFTED: '送人',
};

// 天氣狀況
export const WeatherCondition = {
  SUNNY: 'SUNNY',
  CLOUDY: 'CLOUDY',
  RAINY: 'RAINY',
  SNOWY: 'SNOWY',
  WINDY: 'WINDY',
} as const;
export type WeatherCondition = (typeof WeatherCondition)[keyof typeof WeatherCondition];

export const WeatherConditionLabel: Record<WeatherCondition, string> = {
  SUNNY: '晴天',
  CLOUDY: '陰天',
  RAINY: '雨天',
  SNOWY: '雪天',
  WINDY: '大風',
};
