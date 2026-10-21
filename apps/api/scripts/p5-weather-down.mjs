// 天氣上游掛掉時的降級測試：api 要以 OPEN_METEO_BASE_URL / OPEN_METEO_GEOCODING_URL 指向一個關閉的 port 啟動。
// 預期：forecast available=false，今日推薦、週計畫、自動排、旅行打包全部照常回應不崩。
import { account, seedItems, api } from './p5-seed.mjs';
const t = await account('無金鑰' + Date.now().toString(36));
await seedItems(t, [{ name: '白T', category: 'TOP' }, { name: '牛仔褲', category: 'BOTTOM' }]);
const ymd = (n) => new Date(Date.now() + 8 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const f = await api('GET', '/api/weather/forecast?lat=25&lon=121', t);
console.log('forecast', f.status, f.json.available, f.json.days.length);
const w = await api('GET', '/api/plans/week', t);
console.log('week', w.status, w.json.days.length, w.json.days[0].forecast);
const a = await api('POST', `/api/plans/auto?from=${ymd(0)}&to=${ymd(2)}`, t);
console.log('auto', a.status, a.json.created.length);
const tr = (await api('POST', '/api/trips', t, { name: '台中', destination: '台中', startDate: ymd(1), endDate: ymd(2) })).json.trip;
const g = await api('POST', `/api/trips/${tr.id}/generate`, t);
console.log('gen', g.status, JSON.stringify(g.json.items.map((i) => [i.name, i.reason])), g.json.warnings);
const sg = await api('GET', '/api/suggestions/outfit?lat=25&lon=121', t);
console.log('suggest', sg.status, 'weather=', JSON.stringify(sg.json.weather), 'suggestions=', sg.json.suggestions && sg.json.suggestions.length);
const cur = await api('GET', '/api/weather/current?lat=25&lon=121', t);
console.log('current', cur.status, cur.json.available);
