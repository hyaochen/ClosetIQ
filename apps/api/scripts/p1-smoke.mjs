// P1 key smoke (laundry / season exclusion / storage ownership), also covering P5 auto-plan and trip packing exclusions.
// Usage: BASE=http://127.0.0.1:3020 node apps/api/scripts/p1-smoke.mjs   (local api + temp DB only; test data is created here)
import { api, account } from './p5-seed.mjs';

let fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log('PASS', msg);
  else { fail++; console.log('FAIL', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
};
const ALL = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
const suffix = Date.now().toString(36);
const A = await account('洗衣甲' + suffix);
const B = await account('洗衣乙' + suffix);

const me = await api('GET', '/api/auth/me', A);
const season = me.json.user.effectiveSeason;
const otherSeason = season === 'WINTER' ? 'SUMMER' : 'WINTER';

const mk = async (tok, name, category, seasons) => {
  const r = await api('POST', '/api/items', tok, { name, category, colors: ['#336699'], colorFamily: 'BLUE', seasons, occasions: ['CASUAL'] });
  if (r.status !== 201) throw new Error('create item failed ' + JSON.stringify(r.json));
  return r.json.item.id;
};
const top1 = await mk(A, '乾淨白上衣', 'TOP', [season]);
const top2 = await mk(A, '乾淨灰上衣', 'TOP', ALL);
const topWorn = await mk(A, '今天要穿的藍襯衫', 'TOP', [season]);
const topOos = await mk(A, '季外薄背心', 'TOP', [otherSeason]);
const topDirty = await mk(A, '手動待洗上衣', 'TOP', [season]);
const pants = await mk(A, '深藍長褲', 'BOTTOM', ALL);
const pantsOos = await mk(A, '季外短褲', 'BOTTOM', [otherSeason]);
const shoes = await mk(A, '白色球鞋', 'SHOES', ALL);
const coat = await mk(A, '駝色外套', 'OUTERWEAR', [season]);

// ---- wear log -> TOP / BOTTOM turn DIRTY, outerwear and shoes do not ----
const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
let r = await api('POST', '/api/wear-logs', A, { itemIds: [topWorn, pants, shoes, coat], date: today });
ok(r.status === 201, '建立穿著紀錄 201', r.json);
const status = async (id) => (await api('GET', `/api/items/${id}`, A)).json.item.laundryStatus;
ok((await status(topWorn)) === 'DIRTY', '穿過的上衣轉 DIRTY');
ok((await status(pants)) === 'DIRTY', '穿過的下身轉 DIRTY');
ok((await status(shoes)) === 'CLEAN' && (await status(coat)) === 'CLEAN', '鞋與外套不轉 DIRTY');

// 手動標待洗 / 送洗中
r = await api('PUT', `/api/items/${topDirty}`, A, { laundryStatus: 'DIRTY' });
ok(r.status === 200 && (await status(topDirty)) === 'DIRTY', 'PUT 單件標待洗');
r = await api('POST', '/api/items/laundry', A, { itemIds: [topDirty], status: 'CLEANING' });
ok(r.status === 200 && (await status(topDirty)) === 'CLEANING', '批次改送洗中');
r = await api('POST', '/api/items/laundry', B, { itemIds: [top1], status: 'DIRTY' });
ok((r.status === 404 || r.status === 400 || (r.json && r.json.updated === 0)) && (await status(top1)) === 'CLEAN', 'B 不能改 A 的洗衣狀態', r.json);

// ---- suggestions exclude DIRTY / CLEANING / out-of-season ----
const bad = new Set([topWorn, topDirty, topOos, pants, pantsOos]);
let leaked = 0;
for (let i = 0; i < 4; i++) {
  r = await api('GET', '/api/suggestions/outfit?lat=25.03&lon=121.56', A);
  for (const s of r.json.suggestions) for (const it of s.items) if (bad.has(it.id)) leaked++;
}
ok(r.status === 200 && leaked === 0, '推薦不含待洗、送洗中、季外衣物', { leaked });
ok(r.json.suggestions.every((s) => s.items.every((it) => it.category !== 'BOTTOM')), '唯一的下身已待洗、另一件季外 -> 推薦沒有下身');
ok(r.json.suggestions.length > 0 && r.json.suggestions[0].items.some((it) => it.id === top1 || it.id === top2), '推薦仍有乾淨的上衣');
ok(r.json.weather && typeof r.json.weather.temp === 'number', '推薦回應帶天氣（來自 weather.service）', r.json.weather);

// ---- P5 auto plan and trip packing apply the same exclusion ----
const d = (n) => new Date(Date.now() + 8 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const cleanBottom = await mk(A, '乾淨牛仔褲', 'BOTTOM', ALL);
r = await api('POST', `/api/plans/auto?from=${d(1)}&to=${d(3)}`, A);
ok(r.status === 201, '自動排一週 201', r.json);
const plans = (await api('GET', `/api/plans?from=${d(1)}&to=${d(3)}`, A)).json.days.filter((x) => x.plan);
const planIds = plans.flatMap((x) => x.plan.items.map((i) => i.id));
ok(planIds.length > 0 && !planIds.some((id) => bad.has(id)), '自動排程不含待洗與季外衣物', planIds.filter((id) => bad.has(id)));
r = await api('POST', '/api/trips', A, { name: '短程', destination: '台中', startDate: d(1), endDate: d(3) });
const trip = r.json.trip;
r = await api('POST', `/api/trips/${trip.id}/generate`, A);
const packed = r.json.items.filter((i) => i.clothingItemId).map((i) => i.clothingItemId);
ok(r.status === 200 && packed.length > 0 && !packed.some((id) => bad.has(id)), '旅行打包不含待洗與季外衣物', packed.filter((id) => bad.has(id)));

// ---- storage ownership ----
const locA = (await api('POST', '/api/storage-locations', A, { name: '甲的衣櫃上層' })).json.location;
const itemB = await mk(B, '乙的外套', 'OUTERWEAR', ALL);
r = await api('PUT', `/api/items/${itemB}`, B, { storageLocationId: locA.id });
ok(r.status === 400 || r.status === 403 || r.status === 404, 'B 不能把自己的衣物放進 A 的收納位置（PUT）', r.status);
r = await api('POST', '/api/items/bulk-move', B, { itemIds: [itemB], storageLocationId: locA.id });
ok(r.status === 400 || r.status === 403 || r.status === 404, 'B 不能 bulk-move 到 A 的收納位置', r.status);
r = await api('POST', '/api/items/bulk-move', B, { itemIds: [top1], storageLocationId: null });
const stillA = (await api('GET', `/api/items/${top1}`, A)).json.item;
ok(stillA.storageLocationId === null, 'B 不能搬動 A 的衣物位置（A 的衣物位置沒被改）', r.status);
r = await api('PUT', `/api/storage-locations/${locA.id}`, B, { name: '被改名' });
ok(r.status === 404, 'B 改不了 A 的收納位置', r.status);
r = await api('DELETE', `/api/storage-locations/${locA.id}`, B);
ok(r.status === 404, 'B 刪不了 A 的收納位置', r.status);
r = await api('POST', '/api/items/bulk-move', A, { itemIds: [top1, top2], storageLocationId: locA.id });
ok(r.status === 200 && (await api('GET', '/api/storage-locations', A)).json.locations[0].itemCount === 2, 'A 自己搬動成功，件數 2');
r = await api('GET', `/api/items?storageLocationId=${locA.id}`, B);
ok(r.status === 200 && r.json.items.length === 0, 'B 用 A 的位置 id 篩選看不到任何東西');

console.log(fail ? `${fail} FAILED` : 'ALL PASS');
process.exit(fail ? 1 : 0);
