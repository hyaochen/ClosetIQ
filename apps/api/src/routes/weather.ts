import type { FastifyInstance } from 'fastify';
import { weatherForecastQuerySchema } from '@closet/shared';
import { getForecast, geocodeCity, FORECAST_DAYS } from '../services/weather.service.js';

// ---- P5 ----
export async function weatherRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/weather/forecast?lat=&lon=  或  ?city=Taipei
  // 回傳最多 5 天（含今天，台北時區）每日摘要；沒有天氣金鑰或上游失敗時 available=false、days=[]。
  app.get('/api/weather/forecast', async (request, reply) => {
    const parsed = weatherForecastQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: '參數錯誤', details: parsed.error.flatten() });
    }

    let { lat, lon } = parsed.data;
    let location: string | null = null;
    if (parsed.data.city) {
      const geo = await geocodeCity(parsed.data.city);
      if (!geo) return reply.status(404).send({ error: '找不到此城市，或天氣服務尚未設定' });
      lat = geo.lat;
      lon = geo.lon;
      location = geo.name;
    }

    const days = await getForecast(lat!, lon!);
    return reply.send({
      available: days !== null,
      location,
      lat: Math.round(lat! * 10) / 10,
      lon: Math.round(lon! * 10) / 10,
      horizonDays: FORECAST_DAYS,
      days: days ?? [],
    });
  });
}
