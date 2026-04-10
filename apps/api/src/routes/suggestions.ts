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

    // Helper: pick a candidate with randomness that increases by attempt index
    const pickCandidate = (candidates: typeof scored, attempt: number) => {
      if (candidates.length === 0) return null;
      const topN = Math.min(Math.max(3, attempt + 1), candidates.length);
      return candidates[Math.floor(Math.random() * topN)];
    };

    // Helper: format item for response
    const formatItem = (item: (typeof scored)[0]) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      colorFamily: item.colorFamily,
      thumbnail: item.images[0]?.thumbnailPath ?? null,
    });

    // Build 6 outfit suggestions
    // Each suggestion picks independently (usedItemIds resets per outfit)
    // so all clothes remain candidates for every suggestion (variety via randomness)
    const suggestions = [];

    for (let i = 0; i < 6; i++) {
      const outfit: any = { items: [], score: 0 };
      const usedInOutfit = new Set<string>();

      // Get sorted candidates for a category (no score threshold — always show something)
      const byCategory = (cat: string) =>
        scored
          .filter((item) => item.category === cat && !usedInOutfit.has(item.id))
          .sort((a, b) => b.score - a.score);

      // Decide strategy: every 3rd suggestion try DRESS if available
      const dresses = byCategory('DRESS');
      const tops = byCategory('TOP');
      const bottoms = byCategory('BOTTOM');
      const useDress = dresses.length > 0 && (i % 3 === 2 || (tops.length === 0 && bottoms.length === 0));

      if (useDress) {
        // DRESS strategy: dress + shoes (+ optional outerwear)
        const dress = pickCandidate(dresses, i);
        if (dress) {
          outfit.items.push(formatItem(dress));
          outfit.score += dress.score;
          usedInOutfit.add(dress.id);
        }
      } else {
        // TOP + BOTTOM strategy
        const top = pickCandidate(tops, i);
        if (top) {
          outfit.items.push(formatItem(top));
          outfit.score += top.score;
          usedInOutfit.add(top.id);
        }
        const bottom = pickCandidate(byCategory('BOTTOM'), i);
        if (bottom) {
          outfit.items.push(formatItem(bottom));
          outfit.score += bottom.score;
          usedInOutfit.add(bottom.id);
        }
      }

      // Shoes
      const shoe = pickCandidate(byCategory('SHOES'), i);
      if (shoe) {
        outfit.items.push(formatItem(shoe));
        outfit.score += shoe.score;
        usedInOutfit.add(shoe.id);
      }

      // Outerwear if cold (temp < 15°C)
      if (weather && weather.temp < 15) {
        const outerwear = pickCandidate(byCategory('OUTERWEAR'), i);
        if (outerwear) {
          outfit.items.push(formatItem(outerwear));
          usedInOutfit.add(outerwear.id);
        }
      }

      // Optional: bag
      const bag = pickCandidate(byCategory('BAG'), i);
      if (bag) {
        outfit.items.push(formatItem(bag));
        usedInOutfit.add(bag.id);
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
