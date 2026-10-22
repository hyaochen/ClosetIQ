import { prisma } from './prisma.js';

// T-CL-018：使用者的常用城市。座標沒帶時（plans、suggestions）才用它，都沒有再由呼叫端退回台北。
export async function homeCoords(userId: string): Promise<{ lat: number; lon: number; city: string | null } | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { homeCity: true, homeLat: true, homeLon: true } });
  if (!u || u.homeLat === null || u.homeLon === null) return null;
  return { lat: u.homeLat, lon: u.homeLon, city: u.homeCity };
}

/** 明確座標優先，其次常用城市；兩者都沒有回 undefined（呼叫端決定是否退回預設） */
export async function resolveCoords(userId: string, lat?: number, lon?: number): Promise<{ lat: number; lon: number } | undefined> {
  if (lat !== undefined && lon !== undefined) return { lat, lon };
  const h = await homeCoords(userId);
  return h ? { lat: h.lat, lon: h.lon } : undefined;
}
