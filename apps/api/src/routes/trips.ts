import type { FastifyInstance } from 'fastify';
import { tileFields } from '../lib/tile.js';
import {
  createTripSchema,
  updateTripSchema,
  createTripItemSchema,
  updateTripItemSchema,
  temperatureToSeason,
  type ForecastDay,
} from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import { loadScoredItems, type ScoredItem } from '../services/scoring.service.js';
import {
  getForecast,
  geocodeCity,
  forecastFor,
  addDays,
  diffDays,
  toDbDate,
  ymdOf,
} from '../services/weather.service.js';

// ---- P5 ----

const MAX_TRIP_DAYS = 60;
const MAX_TOPS = 14;

const tripItemInclude = {
  clothingItem: { include: { images: { where: { isPrimary: true }, take: 1 } } },
} as const;

type TripItemRow = Awaited<ReturnType<typeof prisma.tripItem.findFirstOrThrow<{ include: typeof tripItemInclude }>>>;

function formatTripItem(i: TripItemRow) {
  return {
    id: i.id,
    clothingItemId: i.clothingItemId,
    name: i.clothingItem?.name ?? i.customName ?? '',
    category: i.clothingItem?.category ?? i.category,
    thumbnail: i.clothingItem?.images[0]?.thumbnailPath ?? null,
    ...tileFields(i.clothingItem?.images[0]),
    quantity: i.quantity,
    packed: i.packed,
    reason: i.reason,
    isAuto: i.isAuto,
    sortOrder: i.sortOrder,
  };
}

type TripRow = { id: string; name: string; destination: string; lat: number | null; lon: number | null; startDate: Date; endDate: Date };

function formatTrip(t: TripRow) {
  return {
    id: t.id,
    name: t.name,
    destination: t.destination,
    lat: t.lat,
    lon: t.lon,
    startDate: ymdOf(t.startDate),
    endDate: ymdOf(t.endDate),
    days: diffDays(ymdOf(t.startDate), ymdOf(t.endDate)) + 1,
  };
}

/** 旅行期間的逐日預報摘要；超過 16 天預報窗口的日子 forecast 為 null（無預報） */
async function tripWeather(t: TripRow) {
  const start = ymdOf(t.startDate);
  const end = ymdOf(t.endDate);
  let lat = t.lat;
  let lon = t.lon;
  if (lat === null || lon === null) {
    const geo = await geocodeCity(t.destination);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    }
  }
  const forecast = lat !== null && lon !== null ? await getForecast(lat, lon) : null;
  const days: { date: string; forecast: ForecastDay | null }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push({ date: d, forecast: forecastFor(forecast, d) });
  const known = days.map((d) => d.forecast).filter((f): f is ForecastDay => f !== null);
  const rainDates = days
    .filter((d) => d.forecast && (d.forecast.condition === 'RAINY' || d.forecast.condition === 'SNOWY' || d.forecast.rainChance >= 50))
    .map((d) => d.date);
  return {
    days,
    minTemp: known.length ? Math.min(...known.map((f) => f.min)) : null,
    maxTemp: known.length ? Math.max(...known.map((f) => f.max)) : null,
    rainDates,
    unknownDates: days.filter((d) => d.forecast === null).map((d) => d.date),
  };
}

const dayOfMonth = (ymd: string) => parseInt(ymd.slice(8, 10), 10);
const mdLabel = (ymd: string) => `${parseInt(ymd.slice(5, 7), 10)}/${dayOfMonth(ymd)}`;
const joinDays = (dates: string[]) => `${dates.slice(0, 3).map(dayOfMonth).join('、')}${dates.length > 3 ? ' 等' : ''} 日`;

function seasonForMonth(month: number): string[] {
  if (month >= 3 && month <= 5) return ['SPRING'];
  if (month >= 6 && month <= 8) return ['SUMMER'];
  if (month >= 9 && month <= 11) return ['AUTUMN'];
  return ['WINTER'];
}

const WATERPROOF_RE = /防水|防潑水|防風|風衣|雨衣|rain|waterproof|windbreaker|gore/i;
const THIN_RE = /薄|針織|襯衫外套|開襟|cardigan|輕/i;

function itemText(i: ScoredItem) {
  return [i.name, i.subcategory, i.material, ...(i.tags ?? [])].filter(Boolean).join(' ');
}

export async function tripRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // ---------- Trip CRUD ----------

  // GET /api/trips
  app.get('/api/trips', async (request, reply) => {
    const trips = await prisma.trip.findMany({
      where: { userId: request.user.id },
      orderBy: { startDate: 'desc' },
      include: { items: { select: { packed: true } } },
    });
    return reply.send({
      trips: trips.map((t) => ({
        ...formatTrip(t),
        itemCount: t.items.length,
        packedCount: t.items.filter((i) => i.packed).length,
      })),
    });
  });

  // POST /api/trips
  app.post('/api/trips', async (request, reply) => {
    const parsed = createTripSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    const d = parsed.data;
    if (diffDays(d.startDate, d.endDate) + 1 > MAX_TRIP_DAYS) {
      return reply.status(400).send({ error: `旅行最多 ${MAX_TRIP_DAYS} 天` });
    }
    let { lat, lon } = d;
    if (lat === undefined || lon === undefined) {
      const geo = await geocodeCity(d.destination);
      if (geo) {
        lat = geo.lat;
        lon = geo.lon;
      }
    }
    const trip = await prisma.trip.create({
      data: {
        userId: request.user.id,
        name: d.name,
        destination: d.destination,
        lat: lat ?? null,
        lon: lon ?? null,
        startDate: toDbDate(d.startDate),
        endDate: toDbDate(d.endDate),
      },
    });
    return reply.status(201).send({ trip: formatTrip(trip) });
  });

  // GET /api/trips/:id — 含打包清單與旅行期間預報
  app.get('/api/trips/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const trip = await prisma.trip.findFirst({
      where: { id, userId: request.user.id },
      include: { items: { include: tripItemInclude, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    });
    if (!trip) return reply.status(404).send({ error: '找不到此旅行' });
    return reply.send({
      trip: formatTrip(trip),
      items: trip.items.map(formatTripItem),
      weather: await tripWeather(trip),
    });
  });

  // PATCH /api/trips/:id
  app.patch('/api/trips/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTripSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    const existing = await prisma.trip.findFirst({ where: { id, userId: request.user.id } });
    if (!existing) return reply.status(404).send({ error: '找不到此旅行' });

    const d = parsed.data;
    const start = d.startDate ?? ymdOf(existing.startDate);
    const end = d.endDate ?? ymdOf(existing.endDate);
    if (end < start) return reply.status(400).send({ error: '結束日期不可早於出發日期' });
    if (diffDays(start, end) + 1 > MAX_TRIP_DAYS) return reply.status(400).send({ error: `旅行最多 ${MAX_TRIP_DAYS} 天` });

    // 改了目的地但沒帶座標：重新查一次，查不到就清成 null，避免沿用舊城市的座標抓預報
    let lat = d.lat;
    let lon = d.lon;
    if (d.destination !== undefined && d.destination !== existing.destination && lat === undefined && lon === undefined) {
      const geo = await geocodeCity(d.destination);
      lat = geo ? geo.lat : null;
      lon = geo ? geo.lon : null;
    }

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        name: d.name,
        destination: d.destination,
        lat,
        lon,
        startDate: d.startDate ? toDbDate(d.startDate) : undefined,
        endDate: d.endDate ? toDbDate(d.endDate) : undefined,
      },
    });
    return reply.send({ trip: formatTrip(trip) });
  });

  // DELETE /api/trips/:id
  app.delete('/api/trips/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await prisma.trip.deleteMany({ where: { id, userId: request.user.id } });
    if (res.count === 0) return reply.status(404).send({ error: '找不到此旅行' });
    return reply.send({ message: '旅行已刪除' });
  });

  // ---------- TripItem ----------

  // POST /api/trips/:id/items — 手動新增（衣物或自訂項目，例如雨傘）
  app.post('/api/trips/:id/items', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createTripItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    const userId = request.user.id;
    const trip = await prisma.trip.findFirst({ where: { id, userId } });
    if (!trip) return reply.status(404).send({ error: '找不到此旅行' });

    const d = parsed.data;
    if (d.clothingItemId) {
      const owned = await prisma.clothingItem.findFirst({ where: { id: d.clothingItemId, userId } });
      if (!owned) return reply.status(400).send({ error: '衣物不存在或不屬於您' });
      const dup = await prisma.tripItem.findFirst({ where: { tripId: id, clothingItemId: d.clothingItemId } });
      if (dup) return reply.status(409).send({ error: '清單裡已經有這件衣物' });
    }
    const last = await prisma.tripItem.aggregate({ where: { tripId: id }, _max: { sortOrder: true } });
    const item = await prisma.tripItem.create({
      data: {
        tripId: id,
        clothingItemId: d.clothingItemId ?? null,
        customName: d.clothingItemId ? null : d.customName,
        category: d.clothingItemId ? null : (d.category ?? null),
        quantity: d.quantity,
        reason: d.reason ?? null,
        isAuto: false,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      include: tripItemInclude,
    });
    return reply.status(201).send({ item: formatTripItem(item) });
  });

  // PATCH /api/trips/:id/items/:itemId — 勾選 packed、改數量等
  app.patch('/api/trips/:id/items/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const parsed = updateTripItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    const existing = await prisma.tripItem.findFirst({ where: { id: itemId, tripId: id, trip: { userId: request.user.id } } });
    if (!existing) return reply.status(404).send({ error: '找不到此項目' });
    const d = parsed.data;
    const item = await prisma.tripItem.update({
      where: { id: itemId },
      data: {
        packed: d.packed,
        quantity: d.quantity,
        // 只有自訂項目可以改名
        customName: existing.clothingItemId ? undefined : d.customName,
        reason: d.reason,
      },
      include: tripItemInclude,
    });
    return reply.send({ item: formatTripItem(item) });
  });

  // DELETE /api/trips/:id/items/:itemId
  app.delete('/api/trips/:id/items/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const res = await prisma.tripItem.deleteMany({ where: { id: itemId, tripId: id, trip: { userId: request.user.id } } });
    if (res.count === 0) return reply.status(404).send({ error: '找不到此項目' });
    return reply.send({ message: '項目已刪除' });
  });

  // ---------- 產生打包清單 ----------

  // POST /api/trips/:id/generate
  // 規則：上衣 = 天數（最多 14）、下身 = ceil(天數/2)、外套至少 1、有雨加防水外套與雨傘、溫差 >= 10 度加薄外套；
  // 超過 16 天預報窗口的日子標「無預報」，改用保守規則（帶傘＋外套）並以出發月份判斷季節。
  // 優先選旅行期間有排計畫的衣物，其次依推薦評分。重新產生時保留手動加的與已勾選的項目。
  app.post('/api/trips/:id/generate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const trip = await prisma.trip.findFirst({ where: { id, userId } });
    if (!trip) return reply.status(404).send({ error: '找不到此旅行' });

    const start = ymdOf(trip.startDate);
    const end = ymdOf(trip.endDate);
    const days = diffDays(start, end) + 1;
    const weather = await tripWeather(trip);
    const known = weather.days.map((d) => d.forecast).filter((f): f is ForecastDay => f !== null);
    const spread = weather.minTemp !== null && weather.maxTemp !== null ? weather.maxTemp - weather.minTemp : 0;
    const targetSeasons = known.length
      ? temperatureToSeason(known.reduce((s, f) => s + (f.min + f.max) / 2, 0) / known.length)
      : seasonForMonth(parseInt(start.slice(5, 7), 10));

    const warnings: string[] = [];

    // 1. 清掉上次產生且尚未勾選的項目；保留其餘（手動加的、已勾選的）
    await prisma.tripItem.deleteMany({ where: { tripId: id, isAuto: true, packed: false } });
    const kept = await prisma.tripItem.findMany({ where: { tripId: id }, include: { clothingItem: true } });
    const keptIds = new Set(kept.map((k) => k.clothingItemId).filter((v): v is string => !!v));
    const keptNames = new Set(kept.filter((k) => !k.clothingItemId).map((k) => (k.customName ?? '').toLowerCase()));
    const keptCount = (cat: string) => kept.filter((k) => (k.clothingItem?.category ?? k.category) === cat).reduce((s, k) => s + k.quantity, 0);
    let sortOrder = kept.reduce((m, k) => Math.max(m, k.sortOrder), -1) + 1;

    // 2. 旅行期間已排計畫的衣物
    const planned = await prisma.plannedOutfitItem.findMany({
      where: { plannedOutfit: { userId, date: { gte: trip.startDate, lte: trip.endDate } } },
      include: { plannedOutfit: { select: { date: true } } },
    });
    const plannedDates = new Map<string, string[]>();
    for (const p of planned) {
      const arr = plannedDates.get(p.clothingItemId) ?? [];
      arr.push(ymdOf(p.plannedOutfit.date));
      plannedDates.set(p.clothingItemId, arr);
    }
    const plannedReason = (itemId: string) => {
      const ds = (plannedDates.get(itemId) ?? []).sort();
      return ds.length === 1 ? `已排入 ${mdLabel(ds[0])} 計畫` : `已排入 ${ds.length} 天計畫（${mdLabel(ds[0])} 起）`;
    };

    // 季外篩選依旅行日期推算季節；同一趟跨季取聯集
    const tripDates: string[] = [];
    for (let i = 0; i < days && i < 60; i++) tripDates.push(addDays(start, i));
    const scored = await loadScoredItems(userId, { targetSeasons, forDates: tripDates });
    const ranked = (cat: string) =>
      scored
        .filter((i) => i.category === cat && !keptIds.has(i.id))
        .sort((a, b) => {
          const pa = plannedDates.get(a.id)?.length ?? 0;
          const pb = plannedDates.get(b.id)?.length ?? 0;
          if (pa !== pb) return pb - pa;
          return b.score - a.score;
        });

    type NewItem = { clothingItemId?: string; customName?: string; category: string; reason: string };
    const out: NewItem[] = [];
    const taken = new Set<string>();
    const takeItem = (i: ScoredItem, reason: string) => {
      taken.add(i.id);
      out.push({ clothingItemId: i.id, category: i.category, reason });
    };
    const takeCustom = (name: string, category: string, reason: string) => {
      if (keptNames.has(name.toLowerCase())) return;
      out.push({ customName: name, category, reason });
    };

    // 3. 上衣、下身
    const topNeed = Math.max(Math.min(days, MAX_TOPS) - keptCount('TOP'), 0);
    const topPool = ranked('TOP');
    topPool.slice(0, topNeed).forEach((i) =>
      takeItem(i, plannedDates.has(i.id) ? plannedReason(i.id) : `${days} 天行程，每天一件`),
    );
    if (topPool.length < topNeed) warnings.push(`上衣只有 ${topPool.length} 件可選，行程需要 ${topNeed} 件`);

    const bottomNeed = Math.max(Math.ceil(days / 2) - keptCount('BOTTOM'), 0);
    const bottomPool = ranked('BOTTOM');
    bottomPool.slice(0, bottomNeed).forEach((i) =>
      takeItem(i, plannedDates.has(i.id) ? plannedReason(i.id) : '約兩天換一件'),
    );
    if (bottomPool.length < bottomNeed) warnings.push(`下身只有 ${bottomPool.length} 件可選，行程需要 ${bottomNeed} 件`);

    // 4. 外套：至少一件；有雨優先挑防水/防風；溫差大再加薄外套
    const rain = weather.rainDates.length > 0;
    const unknown = weather.unknownDates.length > 0;
    const outerPool = ranked('OUTERWEAR');
    const keptOuter = keptCount('OUTERWEAR');
    let outerCount = keptOuter;

    if (rain) {
      const wp = outerPool.find((i) => WATERPROOF_RE.test(itemText(i)) && !taken.has(i.id));
      if (wp) {
        takeItem(wp, `${joinDays(weather.rainDates)}有雨`);
        outerCount++;
      } else if (!kept.some((k) => k.clothingItem && WATERPROOF_RE.test(k.clothingItem.name))) {
        takeCustom('防水外套或雨衣', 'OUTERWEAR', `${joinDays(weather.rainDates)}有雨，衣櫃沒有防水外套`);
        outerCount++;
      }
    }
    if (outerCount === 0) {
      const o = outerPool.find((i) => !taken.has(i.id));
      const why = weather.minTemp !== null && weather.minTemp < 15 ? `低溫 ${weather.minTemp}°` : unknown ? '部分日子無預報，保守帶一件' : '早晚溫差備用';
      if (o) takeItem(o, plannedDates.has(o.id) ? plannedReason(o.id) : why);
      else takeCustom('外套', 'OUTERWEAR', `${why}，衣櫃沒有外套`);
      outerCount++;
    }
    if (spread >= 10 && outerCount < 2) {
      const thin =
        outerPool.find((i) => !taken.has(i.id) && THIN_RE.test(itemText(i))) ??
        outerPool.find((i) => !taken.has(i.id) && i.seasons.some((s) => s === 'SPRING' || s === 'AUTUMN'));
      const why = `溫差 ${spread}°，晚間 ${weather.minTemp}°`;
      if (thin) takeItem(thin, why);
      else takeCustom('薄外套', 'OUTERWEAR', why);
    }

    // 5. 鞋
    if (keptCount('SHOES') === 0) {
      const shoe = ranked('SHOES')[0];
      if (shoe) takeItem(shoe, plannedDates.has(shoe.id) ? plannedReason(shoe.id) : '日常主力鞋');
      else warnings.push('衣櫃沒有鞋子可選');
    }

    // 6. 旅行期間已排計畫、但前面沒涵蓋到的洋裝／包／配件
    for (const cat of ['DRESS', 'BAG', 'ACCESSORY']) {
      for (const i of ranked(cat)) {
        if (plannedDates.has(i.id) && !taken.has(i.id)) takeItem(i, plannedReason(i.id));
      }
    }

    // 7. 雨具
    if (rain) takeCustom('雨傘', 'ACCESSORY', `${joinDays(weather.rainDates)}有雨`);
    else if (unknown) takeCustom('雨傘', 'ACCESSORY', `${joinDays(weather.unknownDates)}無預報，保守帶傘`);

    if (unknown && known.length > 0) {
      warnings.push(`${weather.unknownDates.length} 天無預報（${mdLabel(weather.unknownDates[0])} 起），這部分用保守規則`);
    } else if (unknown) {
      warnings.push('整段行程都沒有預報，依出發月份季節與保守規則產生');
    }

    await prisma.tripItem.createMany({
      data: out.map((o) => ({
        tripId: id,
        clothingItemId: o.clothingItemId ?? null,
        customName: o.customName ?? null,
        category: o.clothingItemId ? null : o.category,
        quantity: 1,
        reason: o.reason,
        isAuto: true,
        sortOrder: sortOrder++,
      })),
    });

    const items = await prisma.tripItem.findMany({
      where: { tripId: id },
      include: tripItemInclude,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return reply.send({
      trip: formatTrip(trip),
      items: items.map(formatTripItem),
      weather,
      warnings,
    });
  });
}
