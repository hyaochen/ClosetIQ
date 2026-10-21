import type { FastifyInstance } from 'fastify';
import {
  upsertPlanSchema,
  planRangeQuerySchema,
  autoPlanQuerySchema,
  temperatureToSeason,
  type ForecastDay,
} from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import { loadScoredItems, type ScoredItem } from '../services/scoring.service.js';
import {
  getForecast,
  forecastFor,
  todayTaipei,
  addDays,
  diffDays,
  isValidYmd,
  toDbDate,
  ymdOf,
  weekdayLabel,
  DEFAULT_LAT,
  DEFAULT_LON,
  FORECAST_DAYS,
} from '../services/weather.service.js';

// ---- P5 ----
// 規則：同一使用者同一天只有一筆計畫；PUT 為整筆取代（itemIds 優先，其次展開 outfitId 的衣物）。

const MAX_RANGE_DAYS = 62;
const MAX_AUTO_DAYS = 14;
const NO_REPEAT_WINDOW = 7; // 同一件上衣在任意 7 天內不重複

const planInclude = {
  items: {
    include: {
      clothingItem: { include: { images: { where: { isPrimary: true }, take: 1 } } },
    },
  },
} as const;

type PlanRow = NonNullable<Awaited<ReturnType<typeof prisma.plannedOutfit.findFirst<{ include: typeof planInclude }>>>>;

function formatPlan(p: PlanRow) {
  return {
    id: p.id,
    date: ymdOf(p.date),
    outfitId: p.outfitId,
    note: p.note,
    items: p.items.map((i) => ({
      id: i.clothingItem.id,
      name: i.clothingItem.name,
      category: i.clothingItem.category,
      colorFamily: i.clothingItem.colorFamily,
      thumbnail: i.clothingItem.images[0]?.thumbnailPath ?? null,
    })),
  };
}

function rangeFrom(q: { from?: string; to?: string }, defaultDays: number) {
  const from = q.from ?? todayTaipei();
  const to = q.to ?? addDays(from, defaultDays - 1);
  if (!isValidYmd(from) || !isValidYmd(to)) return { error: '日期格式須為 YYYY-MM-DD' as const };
  if (to < from) return { error: '結束日期不可早於開始日期' as const };
  return { from, to };
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 範圍若與預報窗口（今天起 16 天）有交集才去拿預報 */
async function forecastForRange(from: string, to: string, lat?: number, lon?: number) {
  const today = todayTaipei();
  if (to < today || from > addDays(today, FORECAST_DAYS - 1)) return null;
  return getForecast(lat ?? DEFAULT_LAT, lon ?? DEFAULT_LON);
}

export async function planRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/plans/week — 今日頁本週 7 格（今天起 7 天）
  app.get('/api/plans/week', async (request, reply) => {
    const parsed = planRangeQuerySchema.pick({ lat: true, lon: true }).safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: '參數錯誤', details: parsed.error.flatten() });
    const userId = request.user.id;
    const from = todayTaipei();
    const to = addDays(from, 6);

    const [forecast, plans, logs] = await Promise.all([
      forecastForRange(from, to, parsed.data.lat, parsed.data.lon),
      prisma.plannedOutfit.findMany({
        where: { userId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
        select: { date: true },
      }),
      prisma.wearLog.findMany({
        where: { userId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
        select: { date: true },
      }),
    ]);
    const planDates = new Set(plans.map((p) => ymdOf(p.date)));
    const logDates = new Set(logs.map((l) => ymdOf(l.date)));

    return reply.send({
      days: eachDate(from, to).map((date) => ({
        date,
        weekday: weekdayLabel(date),
        forecast: forecastFor(forecast, date),
        hasPlan: planDates.has(date),
        hasWearLog: logDates.has(date),
      })),
    });
  });

  // GET /api/plans?from=&to=&lat=&lon=  （預設今天起 7 天，最多 62 天；每天都回一格，沒計畫 plan 為 null）
  app.get('/api/plans', async (request, reply) => {
    const parsed = planRangeQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: '參數錯誤', details: parsed.error.flatten() });
    const r = rangeFrom(parsed.data, 7);
    if ('error' in r) return reply.status(400).send({ error: r.error });
    if (diffDays(r.from, r.to) + 1 > MAX_RANGE_DAYS) {
      return reply.status(400).send({ error: `範圍最多 ${MAX_RANGE_DAYS} 天` });
    }
    const userId = request.user.id;

    const [forecast, plans, logs] = await Promise.all([
      forecastForRange(r.from, r.to, parsed.data.lat, parsed.data.lon),
      prisma.plannedOutfit.findMany({
        where: { userId, date: { gte: toDbDate(r.from), lte: toDbDate(r.to) } },
        include: planInclude,
      }),
      prisma.wearLog.findMany({
        where: { userId, date: { gte: toDbDate(r.from), lte: toDbDate(r.to) } },
        select: { date: true },
      }),
    ]);
    const planByDate = new Map(plans.map((p) => [ymdOf(p.date), p]));
    const logDates = new Set(logs.map((l) => ymdOf(l.date)));

    return reply.send({
      from: r.from,
      to: r.to,
      forecastAvailable: forecast !== null,
      days: eachDate(r.from, r.to).map((date) => {
        const p = planByDate.get(date);
        return {
          date,
          weekday: weekdayLabel(date),
          forecast: forecastFor(forecast, date),
          plan: p ? formatPlan(p) : null,
          hasWearLog: logDates.has(date),
        };
      }),
    });
  });

  // PUT /api/plans/:date
  app.put('/api/plans/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!isValidYmd(date)) return reply.status(400).send({ error: '日期格式須為 YYYY-MM-DD' });
    const parsed = upsertPlanSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: '輸入格式錯誤', details: parsed.error.flatten() });
    const userId = request.user.id;
    const { outfitId, note } = parsed.data;

    let itemIds = [...new Set(parsed.data.itemIds ?? [])];
    if (outfitId) {
      const outfit = await prisma.outfit.findFirst({
        where: { id: outfitId, userId },
        include: { items: true },
      });
      if (!outfit) return reply.status(404).send({ error: '找不到此穿搭' });
      if (itemIds.length === 0) itemIds = outfit.items.map((i) => i.clothingItemId);
    }
    if (itemIds.length === 0) return reply.status(400).send({ error: '此穿搭沒有衣物' });

    const owned = await prisma.clothingItem.count({ where: { id: { in: itemIds }, userId } });
    if (owned !== itemIds.length) return reply.status(400).send({ error: '部分衣物不存在或不屬於您' });

    const dbDate = toDbDate(date);
    const planId = await prisma.$transaction(async (tx) => {
      const plan = await tx.plannedOutfit.upsert({
        where: { userId_date: { userId, date: dbDate } },
        create: { userId, date: dbDate, outfitId: outfitId ?? null, note: note ?? null },
        update: { outfitId: outfitId ?? null, note: note ?? null },
      });
      await tx.plannedOutfitItem.deleteMany({ where: { plannedOutfitId: plan.id } });
      await tx.plannedOutfitItem.createMany({
        data: itemIds.map((clothingItemId) => ({ plannedOutfitId: plan.id, clothingItemId })),
      });
      return plan.id;
    });

    const plan = await prisma.plannedOutfit.findUniqueOrThrow({ where: { id: planId }, include: planInclude });
    return reply.send({ plan: formatPlan(plan) });
  });

  // DELETE /api/plans/:date
  app.delete('/api/plans/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!isValidYmd(date)) return reply.status(400).send({ error: '日期格式須為 YYYY-MM-DD' });
    const res = await prisma.plannedOutfit.deleteMany({ where: { userId: request.user.id, date: toDbDate(date) } });
    if (res.count === 0) return reply.status(404).send({ error: '這天沒有計畫' });
    return reply.send({ message: '計畫已刪除' });
  });

  // POST /api/plans/:date/wear — 「就穿這套」：把計畫轉成穿著紀錄（不可是未來日期；同一組衣物同一天不重複建立）
  app.post('/api/plans/:date/wear', async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!isValidYmd(date)) return reply.status(400).send({ error: '日期格式須為 YYYY-MM-DD' });
    if (date > todayTaipei()) return reply.status(400).send({ error: '還沒到的日子不能記為已穿' });
    const userId = request.user.id;

    const plan = await prisma.plannedOutfit.findUnique({
      where: { userId_date: { userId, date: toDbDate(date) } },
      include: { items: true },
    });
    if (!plan || plan.items.length === 0) return reply.status(404).send({ error: '這天沒有計畫' });
    const itemIds = plan.items.map((i) => i.clothingItemId);

    const sameDayLogs = await prisma.wearLog.findMany({
      where: { userId, date: toDbDate(date) },
      include: { items: true },
    });
    const wanted = [...itemIds].sort().join(',');
    if (sameDayLogs.some((l) => l.items.map((i) => i.clothingItemId).sort().join(',') === wanted)) {
      return reply.status(409).send({ error: '這套已經記錄為當天穿著' });
    }

    // 預報有資料時順便帶入天氣
    let weatherTemp: number | undefined;
    let weatherCondition: string | undefined;
    const fc = forecastFor(await forecastForRange(date, date), date);
    if (fc) {
      weatherTemp = Math.round((fc.min + fc.max) / 2);
      weatherCondition = fc.condition;
    }

    const log = await prisma.wearLog.create({
      data: {
        userId,
        outfitId: plan.outfitId,
        date: toDbDate(date),
        weatherTemp,
        weatherCondition,
        notes: plan.note,
        items: { create: itemIds.map((clothingItemId) => ({ clothingItemId })) },
      },
      include: {
        items: { include: { clothingItem: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
      },
    });
    return reply.status(201).send({ log });
  });

  // POST /api/plans/auto?from=&to=&lat=&lon=&occasion=
  // 只補空白日子，不覆蓋已排的；同一件上衣（或洋裝）任意 7 天內不重複（含既有計畫）；範圍最多 14 天、不可早於今天。
  app.post('/api/plans/auto', async (request, reply) => {
    const parsed = autoPlanQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: '參數錯誤', details: parsed.error.flatten() });
    const today = todayTaipei();
    const r = rangeFrom({ from: parsed.data.from ?? today, to: parsed.data.to }, 7);
    if ('error' in r) return reply.status(400).send({ error: r.error });
    if (r.from < today) return reply.status(400).send({ error: '不能替過去的日子排計畫' });
    if (diffDays(r.from, r.to) + 1 > MAX_AUTO_DAYS) {
      return reply.status(400).send({ error: `自動排程範圍最多 ${MAX_AUTO_DAYS} 天` });
    }
    const userId = request.user.id;

    // 既有計畫：範圍內的日子不覆蓋；前後 6 天內的上衣/洋裝計入「不重複」
    const existing = await prisma.plannedOutfit.findMany({
      where: {
        userId,
        date: {
          gte: toDbDate(addDays(r.from, -(NO_REPEAT_WINDOW - 1))),
          lte: toDbDate(addDays(r.to, NO_REPEAT_WINDOW - 1)),
        },
      },
      include: { items: { include: { clothingItem: { select: { id: true, category: true } } } } },
    });
    const filled = new Set(existing.map((p) => ymdOf(p.date)));
    const usedOn = new Map<string, string[]>(); // 上衣/洋裝 id -> 使用日期
    const markUsed = (id: string, date: string) => {
      if (!usedOn.has(id)) usedOn.set(id, []);
      usedOn.get(id)!.push(date);
    };
    for (const p of existing) {
      for (const i of p.items) {
        if (i.clothingItem.category === 'TOP' || i.clothingItem.category === 'DRESS') {
          markUsed(i.clothingItem.id, ymdOf(p.date));
        }
      }
    }
    const blocked = (id: string, date: string) =>
      (usedOn.get(id) ?? []).some((d) => Math.abs(diffDays(d, date)) < NO_REPEAT_WINDOW);

    const forecast = await forecastForRange(r.from, r.to, parsed.data.lat, parsed.data.lon);
    const scoredBySeasons = new Map<string, ScoredItem[]>();
    const getScored = async (seasons: string[]) => {
      const k = seasons.join(',');
      if (!scoredBySeasons.has(k)) {
        scoredBySeasons.set(
          k,
          await loadScoredItems(userId, { targetSeasons: seasons, occasion: parsed.data.occasion }),
        );
      }
      return scoredBySeasons.get(k)!;
    };

    const created: { date: string; weekday: string; forecast: ForecastDay | null; itemNames: string[] }[] = [];
    const skipped: { date: string; reason: string }[] = [];
    let dressTurn = 0;

    for (const date of eachDate(r.from, r.to)) {
      if (filled.has(date)) {
        skipped.push({ date, reason: '已有計畫，保留不動' });
        continue;
      }
      const fc = forecastFor(forecast, date);
      const temp = fc ? (fc.min + fc.max) / 2 : null;
      const scored = await getScored(temp !== null ? temperatureToSeason(temp) : []);
      const best = (cat: string, ok: (i: ScoredItem) => boolean = () => true) =>
        scored.filter((i) => i.category === cat && ok(i)).sort((a, b) => b.score - a.score)[0] ?? null;

      const free = (i: ScoredItem) => !blocked(i.id, date);
      const picks: ScoredItem[] = [];
      const dress = best('DRESS', free);
      const top = best('TOP', free);
      const useDress = dress !== null && (dressTurn % 3 === 2 || top === null);
      if (useDress && dress) {
        picks.push(dress);
        dressTurn++;
      } else if (top) {
        picks.push(top);
        const bottom = best('BOTTOM');
        if (bottom) picks.push(bottom);
        dressTurn++;
      } else {
        skipped.push({ date, reason: '沒有可用的上衣（一週內不重複）' });
        continue;
      }
      const shoe = best('SHOES');
      if (shoe) picks.push(shoe);
      if (temp !== null && temp < 15) {
        const outer = best('OUTERWEAR');
        if (outer) picks.push(outer);
      }

      await prisma.plannedOutfit.create({
        data: {
          userId,
          date: toDbDate(date),
          note: '自動排程',
          items: { create: picks.map((i) => ({ clothingItemId: i.id })) },
        },
      });
      for (const i of picks) if (i.category === 'TOP' || i.category === 'DRESS') markUsed(i.id, date);
      created.push({ date, weekday: weekdayLabel(date), forecast: fc, itemNames: picks.map((i) => i.name) });
    }

    return reply.status(201).send({ from: r.from, to: r.to, forecastAvailable: forecast !== null, created, skipped });
  });
}
