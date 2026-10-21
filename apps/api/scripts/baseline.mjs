import { account, seedItems, api } from './p5-seed.mjs';
const t = await account('基準測試');
await seedItems(t, [
  { name: '基準白上衣', category: 'TOP' }, { name: '基準黑長褲', category: 'BOTTOM' },
  { name: '基準洋裝', category: 'DRESS' }, { name: '基準布鞋', category: 'SHOES' },
]);
const r = await api('GET', '/api/suggestions/outfit', t);
const norm = (r.json.suggestions || []).map(s => ({ n: s.items.map(i => i.name).sort().join(','), score: Math.round(s.score * 100) / 100 })).sort((a, b) => a.n.localeCompare(b.n));
console.log(JSON.stringify({ status: r.status, weather: r.json.weather, norm }));
