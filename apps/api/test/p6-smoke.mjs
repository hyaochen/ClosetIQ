// P6 smoke test: IMG_DIR=<IMAGE_STORAGE_PATH> node apps/api/test/p6-smoke.mjs  (api on 127.0.0.1:3016, empty-ish DB)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const BASE = 'http://127.0.0.1:3016';
const IMG_DIR = process.env.IMG_DIR;

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function call(method, path, token, body, form) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let b;
  if (form) b = form;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers, body: b });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

async function register(email) {
  const r = await call('POST', '/api/auth/register', null, { email, password: 'test1234', displayName: '測試' });
  if (r.s !== 201 && r.s !== 200) { const l = await call('POST', '/api/auth/login', null, { email, password: 'test1234' }); return l.j.accessToken ?? l.j.token; }
  return r.j.accessToken ?? r.j.token;
}

const stamp = Date.now();
const A = await register(`p6a${stamp}`);
const B = await register(`p6b${stamp}`);
ok(!!A && !!B, 'register two users');

const ALL = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
const W = [
  // name, category, colorFamily, seasons, occasions, pattern, subcategory
  ['白色T恤', 'TOP', 'WHITE', ['SPRING', 'SUMMER', 'AUTUMN'], ['CASUAL'], 'SOLID'],
  ['黑色T恤', 'TOP', 'BLACK', ['SPRING', 'SUMMER', 'AUTUMN'], ['CASUAL'], 'SOLID'],
  ['灰色連帽上衣', 'TOP', 'GREY', ['AUTUMN', 'WINTER'], ['CASUAL', 'LOUNGE'], 'SOLID'],
  ['藍色牛津襯衫', 'TOP', 'BLUE', ['SPRING', 'AUTUMN'], ['WORK', 'CASUAL'], 'SOLID', '襯衫'],
  ['白色襯衫', 'TOP', 'WHITE', ALL, ['WORK', 'FORMAL'], 'SOLID', '襯衫'],
  ['條紋長袖', 'TOP', 'WHITE', ['SPRING', 'AUTUMN'], ['CASUAL'], 'STRIPED'],
  ['橄欖綠休閒襯衫', 'TOP', 'GREEN', ['SPRING', 'AUTUMN'], ['CASUAL'], 'SOLID', '襯衫'],
  ['苔綠格紋襯衫', 'TOP', 'GREEN', ['SPRING', 'AUTUMN'], ['CASUAL'], 'PLAID', '襯衫'],
  ['米色針織毛衣', 'TOP', 'BEIGE', ['AUTUMN', 'WINTER'], ['CASUAL', 'WORK'], 'SOLID'],
  ['運動排汗衫', 'TOP', 'BLACK', ALL, ['SPORT'], 'SOLID'],
  ['深藍牛仔褲', 'BOTTOM', 'BLUE', ALL, ['CASUAL'], 'SOLID'],
  ['黑色西裝褲', 'BOTTOM', 'BLACK', ALL, ['WORK', 'FORMAL'], 'SOLID'],
  ['卡其休閒褲', 'BOTTOM', 'BEIGE', ['SPRING', 'SUMMER', 'AUTUMN'], ['CASUAL', 'WORK'], 'SOLID'],
  ['亮綠長褲', 'BOTTOM', 'GREEN', ['SUMMER'], ['CASUAL'], 'SOLID'],
  ['運動短褲', 'BOTTOM', 'BLACK', ['SPRING', 'SUMMER'], ['SPORT'], 'SOLID'],
  ['灰色居家棉褲', 'BOTTOM', 'GREY', ALL, ['LOUNGE'], 'SOLID'],
  ['黑色皮外套', 'OUTERWEAR', 'BLACK', ['AUTUMN', 'WINTER'], ['CASUAL'], 'SOLID'],
  ['米色風衣', 'OUTERWEAR', 'BEIGE', ['SPRING', 'AUTUMN'], ['CASUAL', 'WORK'], 'SOLID'],
  ['藍色丹寧外套', 'OUTERWEAR', 'BLUE', ['SPRING', 'AUTUMN'], ['CASUAL'], 'SOLID'],
  ['黑色小洋裝', 'DRESS', 'BLACK', ['SPRING', 'SUMMER'], ['FORMAL', 'WORK'], 'SOLID'],
  ['粉色碎花洋裝', 'DRESS', 'PINK', ['SUMMER'], ['CASUAL'], 'FLORAL'],
  ['白色球鞋', 'SHOES', 'WHITE', ALL, ['CASUAL'], 'SOLID'],
  ['黑色皮鞋', 'SHOES', 'BLACK', ALL, ['WORK'], 'SOLID'],
  ['運動慢跑鞋', 'SHOES', 'GREY', ALL, ['SPORT'], 'SOLID'],
  ['棕色涼鞋', 'SHOES', 'BROWN', ['SUMMER'], ['CASUAL'], 'SOLID'],
  ['黑色短靴', 'SHOES', 'BLACK', ['AUTUMN', 'WINTER'], ['CASUAL', 'WORK'], 'SOLID'],
  ['黑色托特包', 'BAG', 'BLACK', ALL, ['WORK', 'CASUAL'], 'SOLID'],
  ['帆布側背包', 'BAG', 'BEIGE', ALL, ['CASUAL'], 'SOLID'],
  ['灰色羊毛圍巾', 'ACCESSORY', 'GREY', ['WINTER'], ['CASUAL'], 'SOLID'],
  ['棕色皮帶', 'ACCESSORY', 'BROWN', ALL, ['WORK', 'CASUAL'], 'SOLID'],
  ['白色內衣', 'UNDERWEAR', 'WHITE', ALL, ['LOUNGE'], 'SOLID'],
];
const ids = {};
for (const [name, category, colorFamily, seasons, occasions, pattern, subcategory] of W) {
  const r = await call('POST', '/api/items', A, { name, category, colorFamily, colors: ['#888888'], seasons, occasions, pattern, subcategory });
  if (r.s !== 201) console.log('seed fail', name, r.s, JSON.stringify(r.j));
  ids[name] = r.j.item.id;
}
ok(Object.keys(ids).length === W.length, `seeded ${W.length} items`);

// wear logs: 近 90 天內橄欖綠襯衫、苔綠襯衫各穿 1 次；其他衣物穿多次
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const logs = [
  [5, ['白色T恤', '深藍牛仔褲', '白色球鞋']], [8, ['白色T恤', '卡其休閒褲', '白色球鞋']],
  [12, ['黑色T恤', '深藍牛仔褲', '白色球鞋']], [20, ['藍色牛津襯衫', '黑色西裝褲', '黑色皮鞋', '黑色托特包']],
  [26, ['白色襯衫', '黑色西裝褲', '黑色皮鞋']], [33, ['橄欖綠休閒襯衫', '深藍牛仔褲', '白色球鞋']],
  [41, ['苔綠格紋襯衫', '卡其休閒褲', '白色球鞋']], [47, ['白色T恤', '深藍牛仔褲', '白色球鞋']],
  [55, ['黑色T恤', '深藍牛仔褲', '白色球鞋']], [62, ['藍色牛津襯衫', '卡其休閒褲', '黑色皮鞋']],
  [70, ['白色T恤', '深藍牛仔褲', '白色球鞋']], [95, ['橄欖綠休閒襯衫', '卡其休閒褲', '白色球鞋']],
  [110, ['白色T恤', '深藍牛仔褲', '白色球鞋']],
];
for (const [d, names] of logs) {
  const r = await call('POST', '/api/wear-logs', A, { itemIds: names.map((n) => ids[n]), date: day(d) });
  if (r.s !== 201) console.log('wearlog fail', d, r.s, JSON.stringify(r.j));
}

// ---------- 權限 ----------
ok((await call('GET', '/api/wishlist', null)).s === 401, 'no token -> 401 (list)');
ok((await call('GET', '/api/stats/wardrobe-gaps', null)).s === 401, 'no token -> 401 (gaps)');

// ---------- CRUD + 驗證 ----------
const bad = await call('POST', '/api/wishlist', A, { name: 'x', category: 'TOP', colorFamily: 'GREEN', url: 'javascript:alert(1)' });
ok(bad.s === 400, 'javascript: url rejected');
ok((await call('POST', '/api/wishlist', A, { name: 'x', category: 'TOP', colorFamily: 'GREEN', url: 'ftp://a.b/c' })).s === 400, 'ftp url rejected');
ok((await call('POST', '/api/wishlist', A, { name: '', category: 'TOP', colorFamily: 'GREEN' })).s === 400, 'empty name rejected');
ok((await call('POST', '/api/wishlist', A, { name: 'x', category: 'NOPE', colorFamily: 'GREEN' })).s === 400, 'bad category rejected');

const mkWish = async (b) => (await call('POST', '/api/wishlist', A, b)).j.item;
const olive = await mkWish({ name: '橄欖綠工裝襯衫', category: 'TOP', subcategory: '襯衫', colorFamily: 'GREEN', colors: ['#6b7a3a'], seasons: ['SPRING', 'AUTUMN'], occasions: ['CASUAL'], price: 1680, url: 'https://shop.example.com/p/123', note: '想買' });
ok(!!olive?.id && olive.status === 'WANT' && olive.price === 1680, 'create wishlist (status WANT, price number)');
const whiteTee = await mkWish({ name: '白色圓領T恤', category: 'TOP', colorFamily: 'WHITE', colors: ['#ffffff'], seasons: [], occasions: [] });
const redJacket = await mkWish({ name: '亮紅外套', category: 'OUTERWEAR', colorFamily: 'RED', colors: ['#ff0000'], seasons: ['SPRING', 'AUTUMN'], occasions: ['CASUAL'] });
const formalShoes = await mkWish({ name: '正式黑色牛津鞋', category: 'SHOES', colorFamily: 'BLACK', colors: ['#111111'], seasons: [], occasions: ['FORMAL', 'WORK'] });
const downCoat = await mkWish({ name: '灰色羽絨外套', category: 'OUTERWEAR', colorFamily: 'GREY', colors: ['#888888'], seasons: ['WINTER'], occasions: ['CASUAL'] });
const dupBlue = await mkWish({ name: '又一件白T', category: 'TOP', colorFamily: 'WHITE', colors: ['#ffffff'], seasons: ['SUMMER'], occasions: ['CASUAL'] });

const list = await call('GET', '/api/wishlist?status=WANT', A);
ok(list.s === 200 && list.j.items.length === 6, 'list WANT returns 6');
ok((await call('GET', `/api/wishlist/${olive.id}`, A)).j.item.name === '橄欖綠工裝襯衫', 'get one');
const up = await call('PUT', `/api/wishlist/${olive.id}`, A, { note: '更新備註', price: 1580 });
ok(up.s === 200 && up.j.item.note === '更新備註' && up.j.item.price === 1580, 'update');
ok((await call('PUT', `/api/wishlist/${olive.id}`, A, { status: 'BOUGHT' })).s === 400, 'cannot set BOUGHT via PUT');
ok((await call('PUT', `/api/wishlist/${olive.id}`, A, { url: null })).j.item.url === null, 'clear url with null');
await call('PUT', `/api/wishlist/${olive.id}`, A, { url: 'https://shop.example.com/p/123' });

// ---------- 他人帳號存取應被拒 ----------
const deny = [
  ['GET', `/api/wishlist/${olive.id}`], ['PUT', `/api/wishlist/${olive.id}`, { note: 'hack' }],
  ['DELETE', `/api/wishlist/${olive.id}`], ['GET', `/api/wishlist/${olive.id}/analysis`],
  ['POST', `/api/wishlist/${olive.id}/purchase`, {}], ['POST', `/api/wishlist/${olive.id}/drop`],
];
for (const [m, p, b] of deny) {
  const r = await call(m, p, B, b);
  ok(r.s === 404, `other user ${m} ${p.replace(olive.id, ':id')} -> ${r.s}`);
}
{
  const fd = new FormData(); fd.append('file', new Blob([Buffer.from('x')], { type: 'image/png' }), 'a.png');
  ok((await call('POST', `/api/wishlist/${olive.id}/image`, B, undefined, fd)).s === 404, 'other user image upload -> 404');
}
ok((await call('GET', '/api/wishlist', B)).j.items.length === 0, 'other user sees empty list');
ok((await call('GET', `/api/stats/wardrobe-gaps`, B)).j.length > 0 && (await call('GET', `/api/stats/wardrobe-gaps`, B)).j.every((g) => g.count === 0), 'other user gaps computed from own (empty) wardrobe');

// ---------- 圖片 ----------
const png = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#6b7a3a' } }).png().toBuffer();
{
  const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'olive.png');
  const r = await call('POST', `/api/wishlist/${olive.id}/image`, A, undefined, fd);
  ok(r.s === 201 && /wishlist\/thumbnail\//.test(r.j.item.imageThumbnailPath), `image upload -> ${r.j?.item?.imageThumbnailPath}`);
  const f = await fetch(`${BASE}/api/images/file/${r.j.item.imageThumbnailPath}`);
  ok(f.status === 200, 'image file served');
  const bad = new FormData(); bad.append('file', new Blob([Buffer.from('notimage')], { type: 'text/plain' }), 'a.txt');
  ok((await call('POST', `/api/wishlist/${olive.id}/image`, A, undefined, bad)).s === 400, 'non-image rejected');
}

// ---------- 分析 ----------
const show = async (label, w) => {
  const r = await call('GET', `/api/wishlist/${w.id}/analysis`, A);
  console.log(`\n=== analysis: ${label} ===`);
  console.log(JSON.stringify(r.j, null, 1));
  return r.j;
};
const aOlive = await show('橄欖綠工裝襯衫', olive);
const aTee = await show('白色圓領T恤', whiteTee);
const aRed = await show('亮紅外套', redJacket);
const aShoe = await show('正式黑色牛津鞋', formalShoes);
const aDown = await show('灰色羽絨外套', downCoat);
const aDup = await show('又一件白T(夏季休閒)', dupBlue);

const catOf = (a, c) => a.byCategory.find((x) => x.category === c);
const strongO = aOlive.similarItems.filter((s) => s.matchType === 'COLOR');
ok(strongO.length === 2 && strongO.every((s) => s.recentWearCount === 1), 'olive: 2 same-color similar, each worn once in 90d');
ok(aOlive.reasons.some((r) => r.includes('近 90 天各只穿 1 次')), 'olive reason mentions underused');
ok(catOf(aTee, 'BOTTOM').compatible >= catOf(aTee, 'BOTTOM').total - 1, `white tee compatible with nearly all bottoms (${catOf(aTee, 'BOTTOM').compatible}/${catOf(aTee, 'BOTTOM').total})`);
ok(catOf(aTee, 'BOTTOM').compatible === 6, 'white tee x all 6 bottoms (season/occasion open)');
ok(catOf(aRed, 'BOTTOM').compatible < catOf(aRed, 'BOTTOM').total, 'red jacket not compatible with all bottoms');
ok(aDown.score > aOlive.score, `down coat (fills winter gap) scores above olive duplicate: ${aDown.score} > ${aOlive.score}`);
ok(aShoe.filledGaps.includes('正式場合的鞋'), 'formal shoes fill formal-shoe gap');
ok(aDup.score < aTee.score, `duplicate white tee scores below fresh: ${aDup.score} < ${aTee.score}`);
for (const a of [aOlive, aTee, aRed, aShoe, aDown, aDup]) ok(a.score >= 0 && a.score <= 100, 'score in 0..100');

// ---------- 缺口 ----------
const gaps = await call('GET', '/api/stats/wardrobe-gaps', A);
console.log('\n=== wardrobe-gaps ===');
console.log(JSON.stringify(gaps.j, null, 1));
ok(gaps.s === 200 && Array.isArray(gaps.j), 'gaps returns array');
ok(gaps.j.some((g) => g.label === '正式場合的鞋'), 'gap: formal shoes');
ok(gaps.j.some((g) => g.label === '冬季外套' && g.count === 1), 'gap: winter outerwear only 1');

// ---------- purchase ----------
const pr = await call('POST', `/api/wishlist/${olive.id}/purchase`, A, { brand: '測試品牌', purchaseLocation: '台北門市' });
ok(pr.s === 201 && pr.j.wishlistItem.status === 'BOUGHT' && pr.j.wishlistItem.boughtItemId === pr.j.item.id, 'purchase -> BOUGHT + boughtItemId');
ok(pr.j.item.name === '橄欖綠工裝襯衫' && Number(pr.j.item.purchasePrice) === 1580 && pr.j.item.images.length === 1 && pr.j.item.images[0].isPrimary, 'purchase copied fields + primary image');
if (IMG_DIR) {
  const p = pr.j.item.images[0].thumbnailPath;
  ok(fs.existsSync(`${IMG_DIR}/${p}`), 'copied image file exists under normal user dir: ' + p);
  ok(!p.includes('wishlist'), 'clothing image path independent of wishlist dir');
}
ok((await call('POST', `/api/wishlist/${olive.id}/purchase`, A, {})).s === 409, 'second purchase -> 409');
ok((await call('POST', `/api/wishlist/${olive.id}/drop`, A)).s === 409, 'drop after bought -> 409');
ok((await call('PUT', `/api/wishlist/${olive.id}`, A, { note: 'x' })).s === 409, 'edit after bought -> 409');
const itemGet = await call('GET', `/api/items/${pr.j.item.id}`, A);
ok(itemGet.s === 200 && itemGet.j.item.images.length === 1, 'new clothing item visible via /api/items');
// 刪願望清單後衣物圖片仍存在
await call('DELETE', `/api/wishlist/${olive.id}`, A);
if (IMG_DIR) ok(fs.existsSync(`${IMG_DIR}/${pr.j.item.images[0].thumbnailPath}`), 'clothing image survives wishlist delete');
// 購買後缺口/分析反映新衣
const aTee2 = await call('GET', `/api/wishlist/${whiteTee.id}/analysis`, A);
ok(aTee2.j.totalConsidered > aTee.totalConsidered - 1, 'wardrobe grew after purchase');

// ---------- drop ----------
const dr = await call('POST', `/api/wishlist/${redJacket.id}/drop`, A);
ok(dr.s === 200 && dr.j.item.status === 'DROPPED', 'drop -> DROPPED (kept)');
ok((await call('GET', '/api/wishlist?status=DROPPED', A)).j.items.length === 1, 'DROPPED still listed');
ok((await call('POST', `/api/wishlist/${redJacket.id}/purchase`, A, {})).s === 409, 'purchase DROPPED -> 409');
ok((await call('PUT', `/api/wishlist/${redJacket.id}`, A, { status: 'WANT' })).j.item.status === 'WANT', 'revive DROPPED -> WANT via PUT');

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
