// T-CL-018 smoke：node scripts/followups-smoke.mjs
// 前置：api 跑在 BASE（預設 http://127.0.0.1:3045），OPEN_METEO_BASE_URL=OPEN_METEO_GEOCODING_URL=http://127.0.0.1:3046，
// 且 `MOCK_PORT=3046 node scripts/mock-open-meteo.mjs` 在跑。全部用中文命名的測試帳號與資料。
import { account, seedItems, api } from './p5-seed.mjs';

process.env.BASE ||= 'http://127.0.0.1:3045';
let fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log('PASS', msg);
  else { fail++; console.log('FAIL', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
};
const MOCK = `http://127.0.0.1:${process.env.MOCK_PORT || 3046}`;
const last = async () => (await fetch(`${MOCK}/__last`)).json();
const TAIPEI = 8 * 3600 * 1000;
const ymd = (ms) => new Date(ms + TAIPEI).toISOString().slice(0, 10);
const today = ymd(Date.now());
const plus = (n) => ymd(Date.now() + n * 86400000);

const suffix = Date.now().toString(36);
const A = await account('補完甲' + suffix);

// ---- 1. 常用城市 ----
let r = await api('GET', '/api/auth/me', A);
ok(r.json.user.homeCity === null && r.json.user.homeLat === null, '新帳號沒有常用城市', r.json.user);
r = await api('PATCH', '/api/auth/settings', A, { homeCity: '東京' });
ok(r.status === 400, '只給城市名沒給座標 -> 400', r.json);
r = await api('PATCH', '/api/auth/settings', A, { homeCity: '東京', homeLat: 35.68, homeLon: 139.69 });
ok(r.status === 200 && r.json.user.homeCity === '東京' && r.json.user.homeLat === 35.68, '設定常用城市', r.json);
r = await api('GET', '/api/auth/me', A);
ok(r.json.user.homeCity === '東京' && r.json.user.homeLon === 139.69, 'me 回常用城市', r.json.user);
r = await api('GET', '/api/plans/week', A);
const l1 = await last();
ok(r.status === 200 && r.json.days.length === 7 && r.json.days[0].forecast !== null, '週計畫沒給座標也有預報', r.json.days[0]);
ok(Math.abs(l1.lat - 35.7) < 0.01 && Math.abs(l1.lon - 139.7) < 0.01, '週計畫預報用常用城市座標（東京）', l1);
r = await api('GET', '/api/plans/week?lat=1.3&lon=103.8', A);
const l2 = await last();
ok(Math.abs(l2.lat - 1.3) < 0.01, '明確座標優先於常用城市', l2);
r = await api('GET', '/api/suggestions/outfit', A);
ok(r.status === 200 && r.json.weather !== null, '推薦沒給座標時用常用城市取得天氣', r.json.weather);
r = await api('PATCH', '/api/auth/settings', A, { homeCity: null, homeLat: null, homeLon: null });
ok(r.status === 200 && r.json.user.homeCity === null && r.json.user.homeLat === null, '清除常用城市', r.json.user);
r = await api('GET', '/api/suggestions/outfit', A);
ok(r.status === 200 && r.json.weather === null, '清除後推薦沒座標就不帶天氣（維持原行為）', r.json.weather);

// ---- 衣物（含花紋）----
const ids = await seedItems(A, [
  { name: '白色短袖上衣', category: 'TOP' }, { name: '藍色襯衫', category: 'TOP' },
  { name: '深藍直筒褲', category: 'BOTTOM' }, { name: '白色皮革球鞋', category: 'SHOES' },
]);
r = await api('POST', '/api/items', A, {
  name: '花卉長裙', category: 'BOTTOM', colors: ['#aa4466'], colorFamily: 'PINK', pattern: 'FLORAL',
  seasons: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'], occasions: ['CASUAL'], tags: [],
});
ok(r.status === 201, '建立有花紋的衣物', r.json);

// ---- 2. 今日計畫 -> 就穿這套 ----
r = await api('PUT', `/api/plans/${today}`, A, { itemIds: [ids['白色短袖上衣'], ids['深藍直筒褲']], note: '今日計畫' });
ok(r.status === 200, '建立今天的計畫', r.json);
r = await api('GET', `/api/plans?from=${today}&to=${today}`, A);
ok(r.json.days.length === 1 && r.json.days[0].plan && r.json.days[0].plan.items.length === 2 && r.json.days[0].plan.items.every((i) => i.name && i.category), '今日頁用的單日範圍查詢回計畫與衣物', r.json.days[0]);
r = await api('POST', `/api/plans/${today}/wear`, A);
ok(r.status === 201 && r.json.log.items.length === 2, '就穿這套 -> 計畫轉穿著紀錄', r.json);
r = await api('POST', `/api/plans/${today}/wear`, A);
ok(r.status === 409 && /已經記錄/.test(r.json.error), '重複記錄回 409（前端視為已穿）', r.json);

// ---- 3. 旅行編輯 ----
r = await api('POST', '/api/trips', A, { name: '東京小旅行', destination: '東京', startDate: plus(3), endDate: plus(5) });
ok(r.status === 201 && r.json.trip.lat !== null, '建立旅行（地名查詢）', r.json);
const tripId = r.json.trip.id;
r = await api('PATCH', `/api/trips/${tripId}`, A, { name: '東京三日', startDate: plus(4), endDate: plus(7) });
ok(r.status === 200 && r.json.trip.name === '東京三日' && r.json.trip.startDate === plus(4) && r.json.trip.days === 4, 'PATCH 改名稱與日期', r.json);
ok(r.json.trip.lat === 35.68, '只改名稱日期不動座標', r.json.trip);
r = await api('PATCH', `/api/trips/${tripId}`, A, { destination: 'Nowhere 不存在的城市' });
ok(r.status === 200 && r.json.trip.lat === null && r.json.trip.lon === null, '改目的地查不到 -> 座標清成 null（不沿用舊城市）', r.json.trip);
r = await api('PATCH', `/api/trips/${tripId}`, A, { destination: '東京' });
ok(r.status === 200 && r.json.trip.lat === 35.68, '改回可查的目的地 -> 重新查座標', r.json.trip);
r = await api('PATCH', `/api/trips/${tripId}`, A, { startDate: plus(9), endDate: plus(8) });
ok(r.status === 400, '結束早於出發 400', r.json);
r = await api('POST', `/api/trips/${tripId}/generate`, A);
ok(r.status === 200, '改完重新產生打包清單', r.json);
r = await api('GET', `/api/trips/${tripId}`, A);
const before = r.json.items.length;
const pick = ids['藍色襯衫'];
const had = r.json.items.some((i) => i.clothingItemId === pick);
r = await api('POST', `/api/trips/${tripId}/items`, A, { clothingItemId: pick, reason: '手動加入' });
if (had) ok(r.status === 409, '清單已有該衣物 -> 409', r.json);
else ok(r.status === 201 && r.json.item.clothingItemId === pick, '從衣櫃加入衣物到打包清單', r.json);
r = await api('POST', `/api/trips/${tripId}/items`, A, { clothingItemId: pick });
ok(r.status === 409, '重複加入同一件 -> 409', r.json);
r = await api('GET', `/api/trips/${tripId}`, A);
ok(r.json.items.length >= before && r.json.items.some((i) => i.clothingItemId === pick), '詳情含手動加入的衣物', r.json.items.length);

// ---- 4. 願望清單：花紋與列表分數 ----
const wish = (body) => api('POST', '/api/wishlist', A, { category: 'TOP', colorFamily: 'WHITE', seasons: [], occasions: [], ...body });
r = await wish({ name: '白色格紋襯衫', pattern: 'PLAID' });
ok(r.status === 201 && r.json.item.pattern === 'PLAID', '願望清單接受花紋', r.json);
const wPlaid = r.json.item.id;
r = await wish({ name: '白色素色襯衫' });
const wPlain = r.json.item.id;
r = await wish({ name: '不買了的外套', category: 'OUTERWEAR', colorFamily: 'BLACK' });
const wDrop = r.json.item.id;
await api('POST', `/api/wishlist/${wDrop}/drop`, A);
r = await api('GET', '/api/wishlist', A);
const byId = Object.fromEntries(r.json.items.map((i) => [i.id, i]));
ok(r.status === 200 && Number.isInteger(byId[wPlaid]?.score) && Number.isInteger(byId[wPlain]?.score), '列表直接回想買項目的 score', r.json.items.map((i) => [i.name, i.score]));
ok(byId[wDrop].score === null, '不買了的項目 score 為 null', byId[wDrop]);
const aPlaid = (await api('GET', `/api/wishlist/${wPlaid}/analysis`, A)).json;
const aPlain = (await api('GET', `/api/wishlist/${wPlain}/analysis`, A)).json;
ok(aPlaid.score === byId[wPlaid].score && aPlain.score === byId[wPlain].score, '列表 score 與單項分析一致', [aPlaid.score, byId[wPlaid].score, aPlain.score, byId[wPlain].score]);
ok(aPlaid.compatibleCount < aPlain.compatibleCount, '花紋納入分析：格紋上衣少搭到有花紋的下身', [aPlaid.compatibleCount, aPlain.compatibleCount]);
ok(aPlaid.reasons.some((x) => /有花紋/.test(x)) && !aPlain.reasons.some((x) => /有花紋/.test(x)), '分析理由列出花紋影響', aPlaid.reasons);
r = await api('PUT', `/api/wishlist/${wPlaid}`, A, { pattern: 'SOLID' });
const aNow = (await api('GET', `/api/wishlist/${wPlaid}/analysis`, A)).json;
ok(r.status === 200 && aNow.compatibleCount === aPlain.compatibleCount, '改成素色後相容件數恢復', [aNow.compatibleCount, aPlain.compatibleCount]);

console.log(fail === 0 ? 'ALL PASS' : `FAILED: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
