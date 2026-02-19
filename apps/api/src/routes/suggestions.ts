import type { FastifyInstance } from 'fastify';
import { suggestOutfitSchema, temperatureToSeason } from '@closet/shared';
import { prisma } from '../lib/prisma.js';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

interface WeatherData {
  temp: number;
  condition: string;
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'your_api_key_here') return null;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const temp = Math.round(data.main.temp);
    const weatherId = data.weather[0]?.id ?? 0;

    let condition = 'CLOUDY';
    if (weatherId >= 200 && weatherId < 600) condition = 'RAINY';
    else if (weatherId >= 600 && weatherId < 700) condition = 'SNOWY';
    else if (weatherId === 800) condition = 'SUNNY';
    else if (weatherId >= 771) condition = 'WINDY';

    return { temp, condition };
  } catch {
    return null;
  }
}

export async function suggestionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/suggestions/outfit
  app.get('/api/suggestions/outfit', async (request, reply) => {
    const parsed = suggestOutfitSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: '參數錯誤', details: parsed.error.flatten() });
    }

    const { occasion, lat, lon } = parsed.data;
    const userId = request.user.id;

    // Fetch weather if location provided
    let weather: WeatherData | null = null;
    if (lat !== undefined && lon !== undefined) {
      weather = await fetchWeather(lat, lon);
    }

    // Determine target seasons
    const targetSeasons = weather ? temperatureToSeason(weather.temp) : [];

    // Get all active items
    const items = await prisma.clothingItem.findMany({
      where: { userId, isActive: true },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        _count: { select: { wearLogItems: true } },
        wearLogItems: {
          orderBy: { wearLog: { date: 'desc' } },
          take: 1,
          include: { wearLog: { select: { date: true } } },
        },
      },
    });

    // Score each item
    const scored = items.map((item) => {
      let score = 0;
      const lastWorn = item.wearLogItems[0]?.wearLog.date ?? null;
      const wearCount = item._count.wearLogItems;

      // Season match
      if (targetSeasons.length > 0) {
        const seasonMatch = item.seasons.some((s) => targetSeasons.includes(s));
        if (seasonMatch) score += 10;
        else score -= 20; // Strong penalty for wrong season
      }

      // Occasion match
      if (occasion && item.occasions.includes(occasion)) {
        score += 8;
      }

      // Prefer less worn items
      if (wearCount === 0) score += 5;
      else score -= wearCount * 0.3;

      // Prefer items not recently worn
      if (lastWorn) {
        const daysSince = (Date.now() - lastWorn.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.min(daysSince * 0.2, 5);
      } else {
        score += 3; // Never worn bonus
      }

      // Condition bonus
      if (item.condition === 'NEW') score += 2;
      if (item.condition === 'GOOD') score += 1;

      return { ...item, score };
    });

    // Build 3 outfit suggestions
    const suggestions = [];
    const usedItemIds = new Set<string>();

    for (let i = 0; i < 3; i++) {
      const outfit: any = { items: [], score: 0 };

      // Required slots
      const slots = ['TOP', 'BOTTOM', 'SHOES'];

      for (const slot of slots) {
        const candidates = scored
          .filter((item) => item.category === slot && !usedItemIds.has(item.id) && item.score > -10)
          .sort((a, b) => b.score - a.score);

        if (candidates.length > 0) {
          // Add some randomness - pick from top 3
          const pick = candidates[Math.min(i, candidates.length - 1)];
          outfit.items.push({
            id: pick.id,
            name: pick.name,
            category: pick.category,
            colorFamily: pick.colorFamily,
            thumbnail: pick.images[0]?.thumbnailPath ?? null,
          });
          outfit.score += pick.score;
          usedItemIds.add(pick.id);
        }
      }

      // Add outerwear if cold
      if (weather && weather.temp < 15) {
        const outerwear = scored
          .filter((item) => item.category === 'OUTERWEAR' && !usedItemIds.has(item.id))
          .sort((a, b) => b.score - a.score);
        if (outerwear.length > 0) {
          const pick = outerwear[Math.min(i, outerwear.length - 1)];
          outfit.items.push({
            id: pick.id,
            name: pick.name,
            category: pick.category,
            colorFamily: pick.colorFamily,
            thumbnail: pick.images[0]?.thumbnailPath ?? null,
          });
          usedItemIds.add(pick.id);
        }
      }

      if (outfit.items.length > 0) {
        suggestions.push(outfit);
      }
    }

    return reply.send({
      suggestions: suggestions.sort((a, b) => b.score - a.score),
      weather: weather ? { temp: weather.temp, condition: weather.condition } : null,
    });
  });
}
