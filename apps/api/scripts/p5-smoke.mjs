// P5 smoke：node scripts/p5-smoke.mjs
// 前置：api 跑在 BASE（預設 http://127.0.0.1:3015），並設 OPEN_METEO_BASE_URL=OPEN_METEO_GEOCODING_URL=http://127.0.0.1:3016，
// 且 `node scripts/mock-open-meteo.mjs` 在跑。全部用中文命名的測試帳號與資料。
import { account, seedItems, api } from './p5-seed.mjs';

let fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log('PASS', msg);
  else { fail++; console.log('FAIL', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
};
const TAIPEI = 8 * 3600 * 1000;
const ymd = (ms) => new Date(ms + TAIPEI).toISOString().slice(0, 10);
const today = ymd(Date.now());
const plus = (n) => ymd(Date.now() + n * 86400000);

const suffix = Date.now().toString(36);
const A = await account('計畫甲' + suffix);
const B = await account('計畫乙' + suffix);

const ids = await seedItems(A, [
  { name: '白色短袖上衣', category: 'TOP' }, { name: '藍色條紋襯衫', category: 'TOP' }, { name: '灰色針織衫', category: 'TOP' },
  { name: '黑色背心', category: 'TOP' }, { name: '格紋襯衫', category: 'TOP' }, { name: '米色上衣', category: 'TOP' },
  { name: '深藍直筒褲', category: 'BOTTOM' }, { name: '黑色寬褲', category: 'BOTTOM' },
  { name: '橄欖綠防風外套', category: 'OUTERWEAR', tags: ['防風'] }, { name: '黑色薄針織外套', category: 'OUTERWEAR' },
  { name: '白色皮革球鞋', category: 'SHOES' },
]);
const idsB = await seedItems(B, [{ name: '乙的上衣', category: 'TOP' }]);

// ---- 預報 ----
let r = await api('GET', '/api/weather/forecast?lat=25.03&lon=121.56', A);
ok(r.status === 200 && r.json.available && r.json.days.length === 16 && r.json.horizonDays === 16, '預報回 16 天', r.json);
ok(r.json.days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && typeof d.min === 'number' && typeof d.max === 'number' && d.rainChance >= 0), '預報欄位', r.json.days[0]);
ok(r.json.days[0].date === today, '第一天是台北今天');
ok(r.json.days.some((d) => d.condition === 'RAINY' && d.rainChance >= 80), '有雨天且降雨機率 80');
const count1 = (await (await fetch(`http://127.0.0.1:${process.env.MOCK_PORT || 3016}/__count`)).json()).calls;
await api('GET', '/api/weather/forecast?lat=25.04&lon=121.58', A); // 四捨五入到同一格 -> 吃快取
const count2 = (await (await fetch(`http://127.0.0.1:${process.env.MOCK_PORT || 3016}/__count`)).json()).calls;
ok(count1 === count2, '同座標(0.1 度)第二次吃快取', { count1, count2 });
r = await api('GET', '/api/weather/forecast?city=Tokyo', A);
ok(r.status === 200 && r.json.location === 'Tokyo', 'city 查詢', r.json);
r = await api('GET', '/api/weather/forecast', A);
ok(r.status === 400, '缺座標 400');
r = await api('GET', '/api/weather/forecast?lat=1&lon=1');
ok(r.status === 401, '未登入 401');

// ---- 計畫 CRUD ----
const d1 = plus(1), d2 = plus(2);
r = await api('PUT', `/api/plans/${d1}`, A, { itemIds: [ids['白色短袖上衣'], ids['深藍直筒褲'], ids['白色皮革球鞋']], note: '開會' });
ok(r.status === 200 && r.json.plan.items.length === 3 && r.json.plan.note === '開會', 'PUT 計畫（直接挑衣物）', r.json);
r = await api('PUT', `/api/plans/${d1}`, A, { itemIds: [ids['藍色條紋襯衫'], ids['黑色寬褲']] });
ok(r.status === 200 && r.json.plan.items.length === 2 && r.json.plan.note === null, '同一天 PUT 為整筆取代', r.json);
r = await api('GET', `/api/plans?from=${today}&to=${plus(6)}`, A);
ok(r.status === 200 && r.json.days.length === 7 && r.json.days[1].plan.items.length === 2, 'GET plans 回 7 天且含縮圖欄位', r.json.days[1]);
ok(r.json.days[1].forecast !== null && r.json.days[6].forecast !== null, '16 天內第 2、7 天都有預報', [r.json.days[1].forecast, r.json.days[6].forecast]);
{
  const rr = await api('GET', `/api/plans?from=${plus(14)}&to=${plus(17)}`, A);
  ok(rr.json.days[1].forecast !== null && rr.json.days[2].forecast === null, '第 16 天(今天算第 1 天)有預報、第 17 天起 null', rr.json.days.map((d) => d.forecast && d.date));
  const w4 = (await api('GET', '/api/weather/forecast?lat=25.03&lon=121.56', A)).json.days;
  ok(w4[4].condition === 'WINDY' && w4[2].condition === 'RAINY' && w4[0].condition === 'CLOUDY', '代碼 2 + 強風 -> WINDY；代碼 63 -> RAINY；代碼 3 -> CLOUDY（不是大風）', w4.slice(0, 5).map((d) => d.condition));
  const cur = await api('GET', '/api/weather/current?lat=25.03&lon=121.56', A);
  ok(cur.status === 200 && cur.json.current.temp === 25 && cur.json.current.condition === 'CLOUDY', '現況天氣', cur.json);
}
ok('thumbnail' in r.json.days[1].plan.items[0], '計畫衣物附 thumbnail 欄位');
r = await api('GET', `/api/plans?from=${today}&to=${plus(100)}`, A);
ok(r.status === 400, '範圍過大 400');
r = await api('PUT', `/api/plans/2026-02-30`, A, { itemIds: [ids['白色短袖上衣']] });
ok(r.status === 400, '不存在日期 400');
r = await api('PUT', `/api/plans/${d2}`, A, {});
ok(r.status === 400, 'PUT 沒給衣物 400');

// outfit 展開
r = await api('POST', '/api/outfits', A, { name: '通勤套', itemIds: [ids['灰色針織衫'], ids['黑色寬褲']] });
const outfitId = r.json.outfit.id;
r = await api('PUT', `/api/plans/${d2}`, A, { outfitId });
ok(r.status === 200 && r.json.plan.outfitId === outfitId && r.json.plan.items.length === 2, 'PUT outfitId 展開衣物', r.json);

// 越權
r = await api('PUT', `/api/plans/${plus(3)}`, B, { itemIds: [ids['白色短袖上衣']] });
ok(r.status === 400, 'B 拿 A 的衣物排計畫被拒', r.json);
r = await api('PUT', `/api/plans/${plus(3)}`, B, { outfitId });
ok(r.status === 404, 'B 拿 A 的 outfit 被拒', r.json);
r = await api('DELETE', `/api/plans/${d1}`, B);
ok(r.status === 404, 'B 刪不到 A 的計畫');
r = await api('GET', `/api/plans?from=${d1}&to=${d1}`, B);
ok(r.json.days[0].plan === null, 'B 看不到 A 的計畫');

// week
r = await api('GET', '/api/plans/week', A);
ok(r.status === 200 && r.json.days.length === 7 && r.json.days[0].date === today && typeof r.json.days[0].weekday === 'string', 'week 回 7 格', r.json.days[0]);
ok(r.json.days[1].hasPlan === true && r.json.days[2].hasPlan === true && r.json.days[0].hasPlan === false && r.json.days[0].hasWearLog === false, 'week hasPlan/hasWearLog', r.json.days.slice(0, 3));

// wear
r = await api('POST', `/api/plans/${d1}/wear`, A);
ok(r.status === 400, '未來日期不能記為已穿', r.json);
r = await api('PUT', `/api/plans/${today}`, A, { itemIds: [ids['黑色背心'], ids['深藍直筒褲']] });
r = await api('POST', `/api/plans/${today}/wear`, A);
ok(r.status === 201 && r.json.log.items.length === 2 && r.json.log.weatherTemp !== null, '就穿這套 -> wear log（含天氣）', r.json);
r = await api('POST', `/api/plans/${today}/wear`, A);
ok(r.status === 409, '同組衣物同一天重複 409');
r = await api('GET', '/api/plans/week', A);
ok(r.json.days[0].hasWearLog === true, 'week hasWearLog 變 true');
r = await api('POST', `/api/plans/${today}/wear`, B);
ok(r.status === 404, 'B 對沒有計畫的日子 wear 404');

// DELETE
r = await api('DELETE', `/api/plans/${today}`, A);
ok(r.status === 200, 'DELETE 計畫');
r = await api('DELETE', `/api/plans/${today}`, A);
ok(r.status === 404, '重複刪 404');

// ---- 自動排一週 ----
// 目前 A 的計畫：d1(藍色條紋襯衫)、d2(灰色針織衫)。自動排 today..+6，只補空白、上衣 7 天內不重複。
r = await api('POST', `/api/plans/auto?from=${today}&to=${plus(6)}`, A);
ok(r.status === 201, '自動排程 201', r.json);
const createdDates = r.json.created.map((c) => c.date);
ok(!createdDates.includes(d1) && !createdDates.includes(d2), '不覆蓋已排的日子', createdDates);
ok(r.json.skipped.filter((s) => s.reason.includes('已有計畫')).length === 2, '已排的日子標 skipped');
r = await api('GET', `/api/plans?from=${today}&to=${plus(6)}`, A);
const tops = [];
for (const d of r.json.days) if (d.plan) for (const i of d.plan.items) if (i.category === 'TOP' || i.category === 'DRESS') tops.push(i.id);
ok(new Set(tops).size === tops.length, '一週內同一件上衣不重複', tops);
const stillD1 = r.json.days[1].plan;
ok(stillD1.items.some((i) => i.name === '藍色條紋襯衫'), '使用者原本排的 d1 沒被動到');
const coldDay = r.json.days.find((d) => d.forecast && (d.forecast.min + d.forecast.max) / 2 < 15 && d.plan && d.plan.note === '自動排程');
ok(!coldDay || coldDay.plan.items.some((i) => i.category === 'OUTERWEAR'), '低溫日自動加外套', coldDay);
// 上衣用完（6 件上衣、7 天、已排 2 天）-> 有些日子拿不到上衣
r = await api('POST', `/api/plans/auto?from=${today}&to=${plus(6)}`, A);
ok(r.status === 201 && r.json.created.length === 0, '再跑一次只剩補不到的日子（不動已排）', r.json);
r = await api('POST', `/api/plans/auto?from=2020-01-01&to=2020-01-03`, A);
ok(r.status === 400, '過去日期不能自動排');
r = await api('POST', `/api/plans/auto?from=${today}&to=${plus(30)}`, A);
ok(r.status === 400, '自動排程範圍上限 14 天');
r = await api('POST', `/api/plans/auto?from=${today}&to=${plus(6)}`, B);
ok(r.status === 201 && r.json.created.length <= 1, 'B 只用自己的衣物（只有 1 件上衣）', r.json.created);

// ---- 旅行 ----
const tripStart = plus(0), tripEnd = plus(4); // 5 天，全在預報窗口內
r = await api('POST', '/api/trips', A, { name: '東京五日', destination: 'Tokyo', startDate: tripStart, endDate: tripEnd });
ok(r.status === 201 && r.json.trip.days === 5 && r.json.trip.lat !== null, '建立旅行（自動地理編碼）', r.json);
const tripId = r.json.trip.id;
r = await api('POST', '/api/trips', A, { name: '壞日期', destination: 'X', startDate: tripEnd, endDate: tripStart });
ok(r.status === 400, '結束早於出發 400');

r = await api('POST', `/api/trips/${tripId}/items`, A, { customName: '行動電源' });
const manualId = r.json.item.id;
ok(r.status === 201 && r.json.item.isAuto === false, '手動新增自訂項目', r.json);

r = await api('POST', `/api/trips/${tripId}/generate`, A);
ok(r.status === 200, 'generate 200', r.json);
const gen = r.json.items;
const cnt = (cat) => gen.filter((i) => i.category === cat).length;
ok(cnt('TOP') === 5, '上衣 = 天數 5', gen.map((i) => i.name));
ok(cnt('BOTTOM') === 2, '下身 = 天數/2 進位（只有 2 件）');
ok(cnt('OUTERWEAR') >= 2, '有雨加防水外套、溫差大加薄外套', gen.filter((i) => i.category === 'OUTERWEAR'));
ok(gen.some((i) => i.name === '橄欖綠防風外套' && /日有雨/.test(i.reason)), '防風外套 reason 含「日有雨」', gen.filter((i) => i.category === 'OUTERWEAR'));
ok(gen.some((i) => i.name === '雨傘' && !i.clothingItemId), '有雨傘（自訂項目）');
ok(gen.every((i) => i.reason || !i.isAuto), '每個自動項目都有 reason');
ok(gen.some((i) => i.name === '行動電源'), '手動項目保留');
const planned = gen.filter((i) => /已排入/.test(i.reason || ''));
ok(planned.length >= 1, '優先選旅行期間已排計畫的衣物', planned.map((i) => [i.name, i.reason]));
ok(gen.find((i) => i.name === '藍色條紋襯衫' && /已排入/.test(i.reason)), 'd1 計畫的襯衫被選入');
ok(r.json.weather.unknownDates.length === 0 && r.json.weather.rainDates.length >= 1, '旅行期間預報摘要', r.json.weather);

// 勾選 + 重新產生
const packTarget = gen.find((i) => i.category === 'TOP');
r = await api('PATCH', `/api/trips/${tripId}/items/${packTarget.id}`, A, { packed: true });
ok(r.status === 200 && r.json.item.packed === true, '勾選 packed');
r = await api('POST', `/api/trips/${tripId}/generate`, A);
const gen2 = r.json.items;
ok(gen2.some((i) => i.id === packTarget.id && i.packed), '重新產生保留已勾選項目（同 id）');
ok(gen2.some((i) => i.id === manualId), '重新產生保留手動項目');
ok(gen2.filter((i) => i.category === 'TOP').length === 5, '重新產生後上衣仍是 5 件（不重複累加）', gen2.filter((i) => i.category === 'TOP').length);
ok(gen2.filter((i) => i.name === '雨傘').length === 1, '雨傘不重複');
const idsSeen = gen2.filter((i) => i.clothingItemId).map((i) => i.clothingItemId);
ok(new Set(idsSeen).size === idsSeen.length, '同一件衣物不會出現兩次');

// 超過預報窗口
r = await api('POST', '/api/trips', A, { name: '長程旅行', destination: 'Tokyo', startDate: plus(13), endDate: plus(19) });
const longId = r.json.trip.id;
r = await api('POST', `/api/trips/${longId}/generate`, A);
ok(r.status === 200 && r.json.weather.unknownDates.length === 4, '前 3 天在 16 天窗口內、後 4 天超過窗口標無預報', r.json.weather.unknownDates);
ok(r.json.items.some((i) => /無預報/.test(i.reason || '') || /日有雨/.test(i.reason || '')), '保守規則 reason', r.json.items.map((i) => i.reason));
ok(r.json.warnings.some((w) => /無預報/.test(w)), 'warnings 提到無預報', r.json.warnings);
ok(r.json.items.filter((i) => i.category === 'TOP').length === 6 && r.json.warnings.some((w) => /上衣只有 6 件/.test(w)), '上衣不足時給警告（需要 7 件只有 6 件）', r.json.warnings);

// CRUD / 越權
r = await api('GET', `/api/trips/${tripId}`, A);
ok(r.status === 200 && r.json.items.length === gen2.length, 'GET trip 含清單與預報', r.json.weather.minTemp);
r = await api('GET', `/api/trips/${tripId}`, B);
ok(r.status === 404, 'B 看不到 A 的旅行');
r = await api('PATCH', `/api/trips/${tripId}/items/${manualId}`, B, { packed: true });
ok(r.status === 404, 'B 不能勾 A 的項目');
r = await api('POST', `/api/trips/${tripId}/items`, B, { customName: '亂入' });
ok(r.status === 404, 'B 不能對 A 的旅行加項目');
r = await api('POST', `/api/trips/${tripId}/generate`, B);
ok(r.status === 404, 'B 不能 generate A 的旅行');
r = await api('DELETE', `/api/trips/${tripId}`, B);
ok(r.status === 404, 'B 不能刪 A 的旅行');
r = await api('POST', `/api/trips`, B, { name: '乙的旅行', destination: '台中', startDate: tripStart, endDate: tripEnd });
const bTrip = r.json.trip.id;
r = await api('POST', `/api/trips/${bTrip}/items`, B, { clothingItemId: ids['白色短袖上衣'] });
ok(r.status === 400, 'B 把 A 的衣物放進清單被拒');
r = await api('POST', `/api/trips/${bTrip}/items`, B, { clothingItemId: idsB['乙的上衣'] });
ok(r.status === 201, 'B 加自己的衣物');
r = await api('POST', `/api/trips/${bTrip}/items`, B, { clothingItemId: idsB['乙的上衣'] });
ok(r.status === 409, '同件衣物重複加入 409');
r = await api('PATCH', `/api/trips/${tripId}`, A, { name: '東京五日改' });
ok(r.status === 200 && r.json.trip.name === '東京五日改', 'PATCH 旅行');
r = await api('DELETE', `/api/trips/${tripId}/items/${manualId}`, A);
ok(r.status === 200, '刪項目');
r = await api('GET', '/api/trips', A);
ok(r.json.trips.length === 2 && r.json.trips[0].itemCount !== undefined, 'GET trips 列表含 itemCount');
r = await api('DELETE', `/api/trips/${longId}`, A);
ok(r.status === 200, '刪旅行');

// ---- 依目標日期推算季節（行程在另一個季節時，不用「目前季節」篩衣物）----
{
  const C = await account('季節丙' + suffix);
  const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
  const seasonOfMonth = (m) => (m >= 3 && m <= 5 ? 'SPRING' : m >= 6 && m <= 8 ? 'SUMMER' : m >= 9 && m <= 11 ? 'AUTUMN' : 'WINTER');
  const todaySeason = seasonOfMonth(parseInt(today.slice(5, 7), 10));
  const farStart = plus(120), farEnd = plus(122); // 超過預報窗口，走「出發月份」季節
  const targetSeason = seasonOfMonth(parseInt(farStart.slice(5, 7), 10));
  const opposite = SEASONS[(SEASONS.indexOf(targetSeason) + 2) % 4];
  const names = {};
  const defs = [];
  for (const sea of SEASONS) {
    for (const cat of ['TOP', 'BOTTOM', 'OUTERWEAR']) {
      const nm = `${sea}限定${cat}`;
      names[nm] = sea;
      defs.push({ name: nm, category: cat, seasons: [sea] });
    }
  }
  const idsC = await seedItems(C, defs);
  const idToName = Object.fromEntries(Object.entries(idsC).map(([n, id]) => [id, n]));
  r = await api('POST', '/api/trips', C, { name: '遠行', destination: 'Tokyo', startDate: farStart, endDate: farEnd });
  const farId = r.json.trip.id;
  r = await api('POST', `/api/trips/${farId}/generate`, C);
  const picked = r.json.items.filter((i) => i.clothingItemId).map((i) => names[idToName[i.clothingItemId]]);
  ok(picked.includes(targetSeason), `出發月份 ${farStart.slice(5, 7)} 的旅行會選到 ${targetSeason} 季衣物`, picked);
  ok(!picked.includes(opposite), `不會選到對季 ${opposite} 的衣物`, picked);
  if (targetSeason !== todaySeason) ok(!picked.includes(todaySeason), `目前季節 ${todaySeason} 的衣物不會被誤選`, picked);
  // 自動排程：計畫日在遠期，同樣依該日季節
  r = await api('POST', `/api/plans/auto?from=${plus(14)}&to=${plus(14)}`, C);
  ok(r.status === 201, '自動排遠期日子成功', r.json);
  await api('DELETE', `/api/trips/${farId}`, C);
}

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail ? 1 : 0);
