// P3 frontend seed: creates a test account, ~20 Chinese-named items with generated images, wear logs across
// Sep and Oct 2026 (incl. month-end boundary) and generated OOTD photos (colour-block figures).
// Usage: BASE=http://127.0.0.1:3022 node apps/api/scripts/p3-fe-seed.mjs   (prints the login e-mail; password is fixed test value)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const BASE = process.env.BASE || 'http://127.0.0.1:3022';
const EMAIL = process.env.SEED_EMAIL || 'p3show@test.local';
const PASSWORD = 'Test1234!x';

const j = async (method, path, token, body, form) => {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let b;
  if (form) b = form;
  else if (body) { headers['content-type'] = 'application/json'; b = JSON.stringify(body); }
  let r = await fetch(BASE + path, { method, headers, body: b });
  // global rate limit is 100 req/min: back off and retry
  while (r.status === 429) {
    await new Promise((res) => setTimeout(res, 8000));
    r = await fetch(BASE + path, { method, headers, body: b });
  }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data)}`);
  return data;
};
const form = (buf, name = 'a.png', type = 'image/png') => { const f = new FormData(); f.append('file', new Blob([buf], { type }), name); return f; };

// garment picture: simple shape on warm background
const garmentPng = (cat, color) => {
  const shapes = {
    TOP: `<path d="M150 90 L210 70 Q250 100 290 70 L350 90 L400 170 L350 195 L340 160 L340 400 L160 400 L160 160 L150 195 L100 170 Z" fill="${color}" stroke="#1A1917" stroke-width="3"/>`,
    BOTTOM: `<path d="M160 70 L340 70 L360 420 L275 420 L250 190 L225 420 L140 420 Z" fill="${color}" stroke="#1A1917" stroke-width="3"/>`,
    OUTERWEAR: `<path d="M140 80 L220 60 L250 110 L280 60 L360 80 L410 200 L370 400 L270 400 L250 130 L230 400 L130 400 L90 200 Z" fill="${color}" stroke="#1A1917" stroke-width="3"/>`,
    SHOES: `<path d="M90 300 L220 290 L250 330 L420 340 Q440 380 400 390 L100 390 Q80 350 90 300 Z" fill="${color}" stroke="#1A1917" stroke-width="3"/>`,
    ACCESSORY: `<ellipse cx="250" cy="260" rx="150" ry="60" fill="${color}" stroke="#1A1917" stroke-width="3"/><ellipse cx="250" cy="220" rx="90" ry="70" fill="${color}" stroke="#1A1917" stroke-width="3"/>`,
    BAG: `<rect x="130" y="190" width="240" height="190" fill="${color}" stroke="#1A1917" stroke-width="3"/><path d="M190 190 Q250 90 310 190" fill="none" stroke="#1A1917" stroke-width="8"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="#E9E2D4"/>${shapes[cat] || shapes.TOP}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

// OOTD photo: head + top + bottom blocks, 3:4 portrait
const ootdJpg = (top, bot, bg) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${bg}"/>
  <circle cx="300" cy="150" r="52" fill="#8C7A68"/>
  <path d="M190 230 L410 230 L440 470 L160 470 Z" fill="${top}" stroke="#1A1917" stroke-width="4"/>
  <path d="M190 470 L410 470 L380 760 L315 760 L300 540 L285 760 L220 760 Z" fill="${bot}" stroke="#1A1917" stroke-width="4"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
};

let auth;
try { auth = await j('POST', '/api/auth/register', null, { email: EMAIL, password: PASSWORD, displayName: '測試用戶' }); }
catch { auth = await j('POST', '/api/auth/login', null, { email: EMAIL, password: PASSWORD }); }
const token = auth.accessToken;

const DEFS = [
  ['白色棉質T恤', 'TOP', '#FBFAF7', 'WHITE'], ['黑色圓領上衣', 'TOP', '#23211F', 'BLACK'], ['淺藍牛津襯衫', 'TOP', '#B9C8D8', 'BLUE'],
  ['米色針織衫', 'TOP', '#D9C9A8', 'BEIGE'], ['灰色連帽衛衣', 'TOP', '#8A8D91', 'GREY'], ['條紋長袖衫', 'TOP', '#5A7290', 'BLUE'],
  ['深藍直筒牛仔褲', 'BOTTOM', '#2F3B52', 'BLUE'], ['卡其休閒褲', 'BOTTOM', '#B08A5E', 'BROWN'], ['黑色西裝褲', 'BOTTOM', '#23211F', 'BLACK'],
  ['橄欖綠工作褲', 'BOTTOM', '#4F5B3A', 'GREEN'], ['米白百褶長裙', 'BOTTOM', '#E6DDCE', 'BEIGE'],
  ['黑色羊毛外套', 'OUTERWEAR', '#23211F', 'BLACK'], ['駝色風衣', 'OUTERWEAR', '#B08A5E', 'BROWN'], ['牛仔夾克', 'OUTERWEAR', '#5A7290', 'BLUE'],
  ['白色球鞋', 'SHOES', '#FBFAF7', 'WHITE'], ['棕色皮鞋', 'SHOES', '#6B4A32', 'BROWN'], ['黑色短靴', 'SHOES', '#23211F', 'BLACK'],
  ['黑色漁夫帽', 'ACCESSORY', '#23211F', 'BLACK'], ['格紋圍巾', 'ACCESSORY', '#A8472A', 'RED'], ['帆布托特包', 'BAG', '#E3D9C9', 'BEIGE'],
];
const items = [];
for (const [name, category, color, colorFamily] of DEFS) {
  const { item } = await j('POST', '/api/items', token, { name, category, colors: [color], colorFamily, seasons: ['SPRING', 'AUTUMN'], occasions: ['CASUAL'] });
  await j('POST', `/api/items/${item.id}/images?primary=true`, token, null, form(await garmentPng(category, color)));
  items.push({ ...item, color });
}
const by = (n) => items.find((i) => i.name === n);
const OUTFITS = [
  ['白色棉質T恤', '深藍直筒牛仔褲', '白色球鞋'],
  ['黑色圓領上衣', '卡其休閒褲', '黑色短靴', '黑色羊毛外套'],
  ['淺藍牛津襯衫', '黑色西裝褲', '棕色皮鞋'],
  ['米色針織衫', '米白百褶長裙', '白色球鞋', '帆布托特包'],
  ['灰色連帽衛衣', '橄欖綠工作褲', '白色球鞋', '黑色漁夫帽'],
  ['條紋長袖衫', '深藍直筒牛仔褲', '白色球鞋', '牛仔夾克'],
];
const BG = ['#E3D9C9', '#D9CFC0', '#E9E2D4', '#DDD3C3', '#E6DDCE'];
// day -> outfit index ; photoDays get OOTD photos
const OCT = { 1: 0, 2: 1, 3: 0, 5: 2, 6: 3, 7: 1, 8: 4, 9: 0, 12: 5, 13: 2, 14: 3, 15: 4, 16: 1, 18: 0, 19: 5, 20: 2, 21: 3, 31: 0 };
const OCT_FUTURE_OK = new Set([31]); // 10/31 is "future" on 10/21 -- skip it unless SEED_TODAY says otherwise
const SEP = { 2: 0, 4: 1, 9: 2, 11: 3, 16: 4, 22: 5, 27: 0, 30: 2 };
const photoOn = new Set([1, 2, 3, 5, 6, 8, 12, 13, 14, 15, 16, 19, 20, 21]); // October photo days (some without photo: 7, 9, 18)
const mk = async (date, oi, withPhoto) => {
  const ids = OUTFITS[oi].map((n) => by(n).id);
  const { log } = await j('POST', '/api/wear-logs', token, { date, itemIds: ids });
  if (withPhoto) {
    const [top, bot] = [by(OUTFITS[oi][0]).color, by(OUTFITS[oi][1]).color];
    await j('POST', `/api/wear-logs/${log.id}/photo`, token, null, form(await ootdJpg(top, bot, BG[Number(date.slice(8)) % 5]), 'ootd.jpg', 'image/jpeg'));
  }
};
const todayStr = process.env.SEED_TODAY || '2026-10-21';
for (const [d, oi] of Object.entries(OCT)) {
  const date = `2026-10-${String(d).padStart(2, '0')}`;
  if (date > todayStr && !process.env.SEED_FUTURE) continue;
  await mk(date, oi, photoOn.has(Number(d)));
}
for (const [d, oi] of Object.entries(SEP)) await mk(`2026-09-${String(d).padStart(2, '0')}`, oi, Number(d) % 2 === 0);
// a few older months for the yearly recap
for (const [m, days] of [['03', [3, 10, 17]], ['06', []], ['07', [5, 6, 20, 21, 22]], ['08', [8, 15]]]) {
  for (const d of days) await mk(`2026-${m}-${String(d).padStart(2, '0')}`, d % 6, false);
}
// a photo-first day with no items yet (today's second log is not created; 10/17 = photo only)
{
  const f = form(await ootdJpg('#A8472A', '#23211F', '#DDD3C3'), 'ootd.jpg', 'image/jpeg');
  await j('POST', '/api/wear-logs/photo?date=2026-10-17', token, null, f);
}
console.log('seeded', EMAIL, items.length, 'items');
