// Final-review seed: one account that looks like a wardrobe in real use (30 items with real rembg cutouts,
// ~5 weeks of wear logs with OOTD photos, outfits with canvas covers, week plans, a trip, a wishlist).
// All names are Chinese and all pictures are generated with sharp; nothing comes from real data.
// Usage: BASE=http://127.0.0.1:3030 node apps/api/scripts/final-seed.mjs   (needs rembg for cutouts; prints the login e-mail)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const BASE = process.env.BASE || 'http://127.0.0.1:3030';
const EMAIL = process.env.SEED_EMAIL || 'review@test.local';
const PASSWORD = 'Test1234!x';

const j = async (method, path, token, body, form) => {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let b;
  if (form) b = form;
  else if (body) { headers['content-type'] = 'application/json'; b = JSON.stringify(body); }
  let r = await fetch(BASE + path, { method, headers, body: b });
  while (r.status === 429) {
    await new Promise((res) => setTimeout(res, 8000));
    r = await fetch(BASE + path, { method, headers, body: b });
  }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data)}`);
  return data;
};
const form = (buf, name = 'a.png', type = 'image/png') => { const f = new FormData(); f.append('file', new Blob([buf], { type }), name); return f; };

const S = '#1A1917';
const shapes = {
  TOP: (c) => `<path d="M150 90 L210 70 Q250 100 290 70 L350 90 L400 170 L350 195 L340 160 L340 400 L160 400 L160 160 L150 195 L100 170 Z" fill="${c}" stroke="${S}" stroke-width="3"/>`,
  BOTTOM: (c) => `<path d="M160 70 L340 70 L360 440 L275 440 L250 200 L225 440 L140 440 Z" fill="${c}" stroke="${S}" stroke-width="3"/>`,
  SKIRT: (c) => `<path d="M170 110 L330 110 L400 420 L100 420 Z" fill="${c}" stroke="${S}" stroke-width="3"/>`,
  OUTERWEAR: (c) => `<path d="M140 80 L220 60 L250 110 L280 60 L360 80 L420 220 L380 420 L270 420 L250 130 L230 420 L120 420 L80 220 Z" fill="${c}" stroke="${S}" stroke-width="3"/>`,
  DRESS: (c) => `<path d="M190 60 L240 60 L250 110 L260 60 L310 60 L330 190 L420 450 L80 450 L170 190 Z" fill="${c}" stroke="${S}" stroke-width="3"/>`,
  SHOES: (c) => `<path d="M80 300 L220 290 L250 330 L420 340 Q450 390 400 410 L100 410 Q70 360 80 300 Z" fill="${c}" stroke="${S}" stroke-width="3"/>`,
  ACCESSORY: (c) => `<ellipse cx="250" cy="280" rx="170" ry="60" fill="${c}" stroke="${S}" stroke-width="3"/><ellipse cx="250" cy="230" rx="100" ry="80" fill="${c}" stroke="${S}" stroke-width="3"/>`,
  BAG: (c) => `<rect x="120" y="200" width="260" height="200" fill="${c}" stroke="${S}" stroke-width="3"/><path d="M190 200 Q250 90 310 200" fill="none" stroke="${S}" stroke-width="9"/>`,
};
// flat background that contrasts with the garment so rembg gets a clean silhouette (light garment -> dark bg and vice versa)
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)); };
const garmentJpg = (shape, color) => sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="${lum(color) > 150 ? '#34495E' : '#E6E6E6'}"/>${shapes[shape](color)}</svg>`)).jpeg({ quality: 90 }).toBuffer();
const ootdJpg = (top, bot, bg) => sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${bg}"/>
  <circle cx="300" cy="150" r="52" fill="#8C7A68"/>
  <path d="M190 230 L410 230 L440 470 L160 470 Z" fill="${top}" stroke="${S}" stroke-width="4"/>
  <path d="M190 470 L410 470 L380 760 L315 760 L300 540 L285 760 L220 760 Z" fill="${bot}" stroke="${S}" stroke-width="4"/></svg>`)).jpeg({ quality: 85 }).toBuffer();

let auth;
try { auth = await j('POST', '/api/auth/register', null, { email: EMAIL, password: PASSWORD, displayName: '林小晴' }); }
catch { auth = await j('POST', '/api/auth/login', null, { email: EMAIL, password: PASSWORD }); }
const token = auth.accessToken;

const tw = new Date(Date.now() + 8 * 3600e3);
const ymd = (offset) => new Date(tw.getTime() + offset * 86400e3).toISOString().slice(0, 10);
await j('PATCH', '/api/auth/settings', token, { currentSeason: 'AUTUMN' }).catch(() => {});

const loc = {};
for (const [name, off] of [['衣櫃上層', false], ['衣櫃抽屜', false], ['床下收納箱', true], ['老家衣櫃', true]]) {
  loc[name] = (await j('POST', '/api/storage-locations', token, { name, isOffSeason: off })).location.id;
}

// name, category, shape, color, colorFamily, seasons, brand, price, location, subcategory
const A = ['SPRING', 'AUTUMN'], AW = ['AUTUMN', 'WINTER'], SS = ['SPRING', 'SUMMER'], ALL = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
const DEFS = [
  ['白色棉質T恤', 'TOP', 'TOP', '#F3F1EC', 'WHITE', ALL, 'UNIQLO', 390, '衣櫃抽屜', 'T恤'],
  ['黑色圓領上衣', 'TOP', 'TOP', '#262421', 'BLACK', A, 'MUJI', 590, '衣櫃抽屜', 'T恤'],
  ['淺藍牛津襯衫', 'TOP', 'TOP', '#A9BDD3', 'BLUE', A, 'UNIQLO', 790, '衣櫃上層', '襯衫'],
  ['米色針織衫', 'TOP', 'TOP', '#D7C6A3', 'BEIGE', AW, 'COS', 1890, '衣櫃上層', '針織'],
  ['灰色連帽衛衣', 'TOP', 'TOP', '#8B8E92', 'GREY', AW, 'Champion', 1580, '衣櫃抽屜', '衛衣'],
  ['藍白條紋長袖衫', 'TOP', 'TOP', '#5B7595', 'BLUE', A, 'Muji', 690, '衣櫃抽屜', '長袖'],
  ['酒紅高領毛衣', 'TOP', 'TOP', '#7A2E3A', 'RED', AW, 'ZARA', 1290, '衣櫃上層', '針織'],
  ['亞麻短袖襯衫', 'TOP', 'TOP', '#E4DCC8', 'BEIGE', SS, 'MUJI', 990, '床下收納箱', '襯衫'],
  ['深藍直筒牛仔褲', 'BOTTOM', 'BOTTOM', '#2E3C58', 'BLUE', ALL, "Levi's", 2480, '衣櫃抽屜', '牛仔褲'],
  ['卡其休閒褲', 'BOTTOM', 'BOTTOM', '#B38D60', 'BROWN', A, 'UNIQLO', 990, '衣櫃抽屜', '長褲'],
  ['黑色西裝褲', 'BOTTOM', 'BOTTOM', '#262421', 'BLACK', ALL, 'ZARA', 1490, '衣櫃上層', '西裝褲'],
  ['橄欖綠工作褲', 'BOTTOM', 'BOTTOM', '#505C3B', 'GREEN', A, 'Dickies', 1680, '衣櫃抽屜', '工作褲'],
  ['米白百褶長裙', 'BOTTOM', 'SKIRT', '#E7DFD0', 'BEIGE', A, 'COS', 2190, '衣櫃上層', '長裙'],
  ['白色寬版短褲', 'BOTTOM', 'BOTTOM', '#F3F1EC', 'WHITE', ['SUMMER'], 'MUJI', 790, '衣櫃抽屜', '短褲'],
  ['黑色羊毛大衣', 'OUTERWEAR', 'OUTERWEAR', '#242220', 'BLACK', ['WINTER'], 'COS', 6900, '老家衣櫃', '大衣'],
  ['駝色風衣', 'OUTERWEAR', 'OUTERWEAR', '#B38D60', 'BROWN', A, 'UNIQLO', 2990, '衣櫃上層', '風衣'],
  ['牛仔夾克', 'OUTERWEAR', 'OUTERWEAR', '#5B7595', 'BLUE', A, "Levi's", 3280, '衣櫃上層', '夾克'],
  ['灰色羽絨外套', 'OUTERWEAR', 'OUTERWEAR', '#7C7F84', 'GREY', ['WINTER'], 'UNIQLO', 3990, '老家衣櫃', '羽絨'],
  ['黑色連身洋裝', 'DRESS', 'DRESS', '#1F1D1B', 'BLACK', ALL, 'ZARA', 1990, '衣櫃上層', '洋裝'],
  ['碎花長洋裝', 'DRESS', 'DRESS', '#C97A6A', 'PINK', SS, 'Lowrys Farm', 2490, '衣櫃上層', '洋裝'],
  ['白色球鞋', 'SHOES', 'SHOES', '#F3F1EC', 'WHITE', ALL, 'adidas', 2790, '衣櫃抽屜', '球鞋'],
  ['棕色牛津皮鞋', 'SHOES', 'SHOES', '#6B4A32', 'BROWN', ALL, 'Clarks', 4200, '衣櫃抽屜', '皮鞋'],
  ['黑色短靴', 'SHOES', 'SHOES', '#242220', 'BLACK', AW, 'Dr. Martens', 5800, '衣櫃抽屜', '靴'],
  ['黑色漁夫帽', 'ACCESSORY', 'ACCESSORY', '#262421', 'BLACK', ALL, 'MUJI', 590, '衣櫃抽屜', '帽'],
  ['紅色格紋圍巾', 'ACCESSORY', 'ACCESSORY', '#A8472A', 'RED', AW, 'Burberry', 890, '床下收納箱', '圍巾'],
  ['帆布托特包', 'BAG', 'BAG', '#E3D9C9', 'BEIGE', ALL, 'MUJI', 790, '衣櫃抽屜', '托特包'],
  ['黑色皮革肩背包', 'BAG', 'BAG', '#262421', 'BLACK', ALL, 'Longchamp', 6800, '衣櫃上層', '肩背包'],
  ['墨綠針織背心', 'TOP', 'TOP', '#2F4A3C', 'GREEN', AW, 'COS', 1390, '衣櫃上層', '背心'],
  ['淡粉短袖T恤', 'TOP', 'TOP', '#E8C7C0', 'PINK', SS, 'UNIQLO', 390, '床下收納箱', 'T恤'],
  ['黑色運動褲', 'BOTTOM', 'BOTTOM', '#2A2826', 'BLACK', ALL, 'Nike', 1280, '衣櫃抽屜', '運動褲'],
];
const occasionsFor = (name) => {
  if (/西裝褲|牛津|襯衫|皮鞋|洋裝|針織衫|風衣|大衣|肩背包/.test(name)) return ['CASUAL', 'WORK', 'FORMAL'];
  if (/衛衣|運動褲|球鞋|漁夫帽/.test(name)) return ['CASUAL', 'SPORT'];
  if (/T恤|工作褲|短褲/.test(name)) return ['CASUAL', 'LOUNGE'];
  return ['CASUAL'];
};
const items = [];
for (const [name, category, shape, color, colorFamily, seasons, brand, price, location, subcategory] of DEFS) {
  const { item } = await j('POST', '/api/items', token, {
    name, category, subcategory, colors: [color], colorFamily, seasons, occasions: occasionsFor(name), brand, purchasePrice: price,
    purchaseDate: '2026-03-10', storageLocationId: loc[location], size: 'M',
  });
  await j('POST', `/api/items/${item.id}/images?primary=true`, token, null, form(await garmentJpg(shape, color), 'p.jpg', 'image/jpeg'));
  items.push({ ...item, color });
}
const by = (n) => items.find((i) => i.name === n);

// wait for cutouts
for (let i = 0; i < 90; i++) {
  const r = await j('GET', '/api/items?limit=100', token);
  const pend = r.items.filter((it) => it.images?.some((im) => im.cutoutStatus === 'PENDING')).length;
  const done = r.items.filter((it) => it.images?.some((im) => im.cutoutStatus === 'DONE')).length;
  console.log('cutout pending', pend, 'done', done);
  if (pend === 0) break;
  await new Promise((res) => setTimeout(res, 5000));
}

const OUTFITS = [
  ['週末休閒', ['白色棉質T恤', '深藍直筒牛仔褲', '白色球鞋', '牛仔夾克']],
  ['通勤日常', ['淺藍牛津襯衫', '黑色西裝褲', '棕色牛津皮鞋', '黑色皮革肩背包']],
  ['秋日散步', ['米色針織衫', '米白百褶長裙', '白色球鞋', '帆布托特包']],
  ['風衣配靴', ['黑色圓領上衣', '卡其休閒褲', '黑色短靴', '駝色風衣']],
  ['一件洋裝', ['黑色連身洋裝', '黑色短靴', '黑色皮革肩背包']],
  ['運動小旅行', ['灰色連帽衛衣', '黑色運動褲', '白色球鞋', '黑色漁夫帽']],
];
const outfitIds = [];
for (const [name, names] of OUTFITS) {
  const { outfit } = await j('POST', '/api/outfits', token, { name, itemIds: names.map((n) => by(n).id), occasions: ['CASUAL'], seasons: ['AUTUMN'], rating: 4 });
  await j('POST', `/api/outfits/${outfit.id}/canvas/auto`, token, { background: 'card', render: true });
  outfitIds.push(outfit.id);
}

// ~5 weeks of wear logs ending yesterday; photo on most days
const BG = ['#E3D9C9', '#D9CFC0', '#E9E2D4', '#DDD3C3', '#E6DDCE'];
const pattern = [0, 1, 2, 3, 1, 5, 0, 2, 4, 1, 3, 0, 5, 2, 1, 4, 3, 0, 2, 1, 5, 3, 0, 4, 1, 2, 3, 5, 0, 1, 4, 2, 3, 0, 1];
let k = 0;
for (let off = -34; off <= 0; off++) {
  if ([-30, -27, -22, -15, -9].includes(off)) continue; // some days without a record
  const oi = pattern[k++ % pattern.length];
  const names = OUTFITS[oi][1];
  const { log } = await j('POST', '/api/wear-logs', token, { date: ymd(off), itemIds: names.map((n) => by(n).id), outfitId: outfitIds[oi] });
  if (off % 5 !== 0 || off === 0) {
    await j('POST', `/api/wear-logs/${log.id}/photo`, token, null, form(await ootdJpg(by(names[0]).color, by(names[1]).color, BG[Math.abs(off) % 5]), 'ootd.jpg', 'image/jpeg'));
  }
}
// older months for the yearly recap
for (const [m, days] of [['03', [3, 10, 17, 24]], ['05', [2, 9]], ['06', [14, 15, 16]], ['07', [5, 6, 20, 21, 22]], ['08', [8, 15, 29]]]) {
  for (const d of days) {
    const names = OUTFITS[d % 6][1];
    await j('POST', '/api/wear-logs', token, { date: `2026-${m}-${String(d).padStart(2, '0')}`, itemIds: names.map((n) => by(n).id) });
  }
}

// plans for the coming days
for (const [off, oi] of [[0, 3], [1, 1], [2, 2], [4, 0]]) {
  await j('PUT', `/api/plans/${ymd(off)}`, token, { outfitId: outfitIds[oi] });
}
// trip
const trip = (await j('POST', '/api/trips', token, { name: '首爾四天三夜', destination: 'Seoul', startDate: ymd(12), endDate: ymd(15) })).trip;
await j('POST', `/api/trips/${trip.id}/generate`, token, {});

// wishlist
const W = [
  { name: '深灰羊毛長版大衣', category: 'OUTERWEAR', colorFamily: 'GREY', colors: ['#6D7075'], seasons: ['WINTER'], occasions: ['CASUAL'], price: 5990, url: 'https://shop.example.com/p/coat', note: '冬天通勤用' },
  { name: '白色寬版牛仔褲', category: 'BOTTOM', colorFamily: 'WHITE', colors: ['#F3F1EC'], seasons: A, occasions: ['CASUAL'], price: 1980 },
  { name: '黑色樂福鞋', category: 'SHOES', colorFamily: 'BLACK', colors: ['#242220'], seasons: [], occasions: ['WORK'], price: 3600 },
  { name: '藍白條紋襯衫', category: 'TOP', colorFamily: 'BLUE', colors: ['#5B7595'], seasons: A, occasions: ['CASUAL'], price: 1290 },
  { name: '米色長版針織外套', category: 'OUTERWEAR', colorFamily: 'BEIGE', colors: ['#D7C6A3'], seasons: AW, occasions: ['CASUAL'], price: 2480 },
  { name: '酒紅色小包', category: 'BAG', colorFamily: 'RED', colors: ['#7A2E3A'], seasons: [], occasions: [], price: 2200 },
];
const wishImgShape = { OUTERWEAR: 'OUTERWEAR', BOTTOM: 'BOTTOM', SHOES: 'SHOES', TOP: 'TOP', BAG: 'BAG' };
for (const w of W) {
  const { item } = await j('POST', '/api/wishlist', token, w);
  await j('POST', `/api/wishlist/${item.id}/image`, token, null, form(await garmentJpg(wishImgShape[w.category], w.colors[0]), 'w.jpg', 'image/jpeg'));
}
await j('POST', '/api/wishlist', token, { name: '螢光橘雨衣', category: 'OUTERWEAR', colorFamily: 'ORANGE', colors: ['#E8742C'], seasons: [], occasions: [], price: 1500 }).then((r) => j('POST', `/api/wishlist/${r.item.id}/drop`, token, {}));

// two items at the laundry
for (const n of ['黑色漁夫帽', '牛仔夾克']) await j('PUT', `/api/items/${by(n).id}`, token, { laundryStatus: 'CLEANING' });
console.log('seeded', EMAIL, items.length, 'items');
