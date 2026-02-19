import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function statsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /api/stats/overview
  app.get('/api/stats/overview', async (request, reply) => {
    const userId = request.user.id;

    const [totalItems, activeItems, totalOutfits, totalWearLogs, categoryBreakdown, colorBreakdown] =
      await Promise.all([
        prisma.clothingItem.count({ where: { userId } }),
        prisma.clothingItem.count({ where: { userId, isActive: true } }),
        prisma.outfit.count({ where: { userId } }),
        prisma.wearLog.count({ where: { userId } }),
        prisma.clothingItem.groupBy({
          by: ['category'],
          where: { userId, isActive: true },
          _count: { id: true },
        }),
        prisma.clothingItem.groupBy({
          by: ['colorFamily'],
          where: { userId, isActive: true },
          _count: { id: true },
        }),
      ]);

    return reply.send({
      totalItems,
      activeItems,
      declutteredItems: totalItems - activeItems,
      totalOutfits,
      totalWearLogs,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      colorBreakdown: colorBreakdown.map((c) => ({
        colorFamily: c.colorFamily,
        count: c._count.id,
      })),
    });
  });

  // GET /api/stats/wear-frequency
  app.get('/api/stats/wear-frequency', async (request, reply) => {
    const userId = request.user.id;
    const { days = '90' } = request.query as { days?: string };
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Get items with wear counts
    const items = await prisma.clothingItem.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        colorFamily: true,
        purchasePrice: true,
        images: { where: { isPrimary: true }, take: 1 },
        _count: { select: { wearLogItems: true } },
        wearLogItems: {
          where: { wearLog: { date: { gte: since } } },
          select: { wearLog: { select: { date: true } } },
        },
      },
    });

    const stats = items.map((item) => {
      const recentWearCount = item.wearLogItems.length;
      const totalWearCount = item._count.wearLogItems;
      const lastWorn = item.wearLogItems.length > 0
        ? item.wearLogItems.sort((a, b) => b.wearLog.date.getTime() - a.wearLog.date.getTime())[0].wearLog.date
        : null;
      const costPerWear = item.purchasePrice && totalWearCount > 0
        ? Number(item.purchasePrice) / totalWearCount
        : null;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        colorFamily: item.colorFamily,
        thumbnail: item.images[0]?.thumbnailPath ?? null,
        totalWearCount,
        recentWearCount,
        lastWorn,
        costPerWear: costPerWear ? Math.round(costPerWear * 100) / 100 : null,
      };
    });

    // Sort by wear count ascending (least worn first)
    const leastWorn = [...stats].sort((a, b) => a.totalWearCount - b.totalWearCount).slice(0, 20);
    const mostWorn = [...stats].sort((a, b) => b.totalWearCount - a.totalWearCount).slice(0, 20);
    const neverWorn = stats.filter((s) => s.totalWearCount === 0);

    return reply.send({ leastWorn, mostWorn, neverWorn, totalTracked: stats.length });
  });

  // GET /api/stats/declutter-suggestions
  app.get('/api/stats/declutter-suggestions', async (request, reply) => {
    const userId = request.user.id;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

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

    const suggestions = items
      .map((item) => {
        const lastWorn = item.wearLogItems[0]?.wearLog.date ?? null;
        const wearCount = item._count.wearLogItems;
        const costPerWear = item.purchasePrice && wearCount > 0
          ? Number(item.purchasePrice) / wearCount
          : null;

        // Score: higher = more likely to suggest decluttering
        let score = 0;
        if (wearCount === 0) score += 5;
        if (!lastWorn || lastWorn < sixMonthsAgo) score += 3;
        if (item.condition === 'WORN') score += 2;
        if (item.condition === 'FAIR') score += 1;
        if (costPerWear && costPerWear > 500) score += 2;

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          colorFamily: item.colorFamily,
          condition: item.condition,
          thumbnail: item.images[0]?.thumbnailPath ?? null,
          wearCount,
          lastWorn,
          costPerWear,
          score,
        };
      })
      .filter((item) => item.score >= 3) // Only suggest items with meaningful score
      .sort((a, b) => b.score - a.score);

    return reply.send({ suggestions });
  });

  // GET /api/stats/advanced - Brand, material, spending, cross-analysis
  app.get('/api/stats/advanced', async (request, reply) => {
    const userId = request.user.id;

    const items = await prisma.clothingItem.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        brand: true,
        material: true,
        purchasePrice: true,
        category: true,
        createdAt: true,
        _count: { select: { wearLogItems: true } },
      },
    });

    // 1. Brand breakdown: count + total spending per brand
    const brandMap = new Map<string, { count: number; totalSpent: number; totalWears: number }>();
    for (const item of items) {
      const brand = item.brand || '未標註';
      const entry = brandMap.get(brand) || { count: 0, totalSpent: 0, totalWears: 0 };
      entry.count++;
      entry.totalSpent += item.purchasePrice ? Number(item.purchasePrice) : 0;
      entry.totalWears += item._count.wearLogItems;
      brandMap.set(brand, entry);
    }
    const brandBreakdown = [...brandMap.entries()]
      .map(([brand, data]) => ({
        brand,
        count: data.count,
        totalSpent: Math.round(data.totalSpent),
        totalWears: data.totalWears,
        avgCostPerWear: data.totalWears > 0
          ? Math.round(data.totalSpent / data.totalWears)
          : null,
      }))
      .sort((a, b) => b.count - a.count);

    // 2. Total spending analysis
    const itemsWithPrice = items.filter((i) => i.purchasePrice);
    const totalSpent = itemsWithPrice.reduce((sum, i) => sum + Number(i.purchasePrice), 0);

    // Monthly spending (group by year-month of createdAt)
    const monthlyMap = new Map<string, number>();
    for (const item of itemsWithPrice) {
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(item.purchasePrice));
    }
    const monthlySpending = [...monthlyMap.entries()]
      .map(([month, amount]) => ({ month, amount: Math.round(amount) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const avgMonthlySpending = monthlySpending.length > 0
      ? Math.round(totalSpent / monthlySpending.length)
      : 0;

    // Spending by category
    const categorySpendMap = new Map<string, number>();
    for (const item of itemsWithPrice) {
      const cat = item.category;
      categorySpendMap.set(cat, (categorySpendMap.get(cat) || 0) + Number(item.purchasePrice));
    }
    const categorySpending = [...categorySpendMap.entries()]
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount);

    // 3. Material breakdown
    const materialMap = new Map<string, number>();
    for (const item of items) {
      const material = item.material || '未標註';
      materialMap.set(material, (materialMap.get(material) || 0) + 1);
    }
    const materialBreakdown = [...materialMap.entries()]
      .map(([material, count]) => ({ material, count }))
      .sort((a, b) => b.count - a.count);

    // 5. Cost per wear ranking (best and worst value)
    const costPerWearItems = items
      .filter((i) => i.purchasePrice && i._count.wearLogItems > 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        brand: i.brand,
        category: i.category,
        purchasePrice: Math.round(Number(i.purchasePrice)),
        wearCount: i._count.wearLogItems,
        costPerWear: Math.round(Number(i.purchasePrice) / i._count.wearLogItems),
      }));

    const bestValue = [...costPerWearItems]
      .sort((a, b) => a.costPerWear - b.costPerWear)
      .slice(0, 10);
    const worstValue = [...costPerWearItems]
      .sort((a, b) => b.costPerWear - a.costPerWear)
      .slice(0, 10);

    return reply.send({
      brandBreakdown,
      spending: {
        totalSpent: Math.round(totalSpent),
        avgMonthlySpending,
        monthlySpending,
        categorySpending,
        itemsWithPriceCount: itemsWithPrice.length,
        totalItemCount: items.length,
      },
      materialBreakdown,
      costPerWear: { bestValue, worstValue },
    });
  });
}
