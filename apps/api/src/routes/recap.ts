import type { FastifyInstance } from 'fastify';
import { monthQuerySchema, yearQuerySchema } from '@closet/shared';
import type { MonthlyRecap, YearlyRecap } from '@closet/shared';
import { computeRecap, round4 } from '../services/recap.service.js';
import {
  addMonths,
  dayStringToDate,
  lastDayOfMonth,
  monthDateRange,
  taipeiMonthStartInstant,
  taipeiToday,
} from '../lib/taipei-date.js';

// ---- P3 ----
export async function recapRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/stats/monthly-recap?month=YYYY-MM
  app.get('/api/stats/monthly-recap', async (request, reply) => {
    const parsed = monthQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: '請提供 month=YYYY-MM', details: parsed.error.flatten() });
    }
    const { month } = parsed.data;
    const userId = request.user.id;
    const prevMonth = addMonths(month, -1);

    const cur = monthDateRange(month);
    const prev = monthDateRange(prevMonth);
    const [now, before] = await Promise.all([
      computeRecap(userId, cur.start, cur.end, taipeiMonthStartInstant(addMonths(month, 1))),
      computeRecap(userId, prev.start, prev.end, taipeiMonthStartInstant(month)),
    ]);

    const today = taipeiToday();
    const throughDate = today.startsWith(month) ? today : lastDayOfMonth(month);

    const body: MonthlyRecap = {
      month,
      throughDate,
      ...now,
      previous: {
        month: prevMonth,
        daysLogged: before.daysLogged,
        usageRate: before.usageRate,
        wardrobeSize: before.wardrobeSize,
      },
      usageRateDelta: round4(now.usageRate - before.usageRate),
    };
    return reply.send(body);
  });

  // GET /api/stats/yearly-recap?year=YYYY
  app.get('/api/stats/yearly-recap', async (request, reply) => {
    const parsed = yearQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: '請提供 year=YYYY', details: parsed.error.flatten() });
    }
    const year = parseInt(parsed.data.year, 10);
    const userId = request.user.id;

    const pad = (y: number) => String(y).padStart(4, '0');
    const yearStart = (y: number) => dayStringToDate(`${pad(y)}-01-01`);
    const yearEndInstant = (y: number) => new Date(`${pad(y + 1)}-01-01T00:00:00+08:00`);

    const [whole, before, ...months] = await Promise.all([
      computeRecap(userId, yearStart(year), yearStart(year + 1), yearEndInstant(year)),
      computeRecap(userId, yearStart(year - 1), yearStart(year), yearEndInstant(year - 1)),
      ...Array.from({ length: 12 }, (_, i) => {
        const m = `${pad(year)}-${String(i + 1).padStart(2, '0')}`;
        const r = monthDateRange(m);
        return computeRecap(userId, r.start, r.end, taipeiMonthStartInstant(addMonths(m, 1)));
      }),
    ]);

    const body: YearlyRecap = {
      year,
      ...whole,
      monthlyDaysLogged: months.map((m) => m.daysLogged),
      monthlyUsageRate: months.map((m) => m.usageRate),
      previous: {
        year: year - 1,
        daysLogged: before.daysLogged,
        usageRate: before.usageRate,
        wardrobeSize: before.wardrobeSize,
      },
      usageRateDelta: round4(whole.usageRate - before.usageRate),
    };
    return reply.send(body);
  });
}
