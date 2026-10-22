// P4 canvas smoke (ported into the integration branch).
// Usage: BASE=http://127.0.0.1:3020 IMG_DIR=<api IMAGE_STORAGE_PATH> node apps/api/scripts/p4-smoke.mjs
// Test photos are generated with sharp (flat-gray background + coloured shape); nothing comes from real data.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const B = process.env.BASE || 'http://127.0.0.1:3020';
const IMG_DIR = process.env.IMG_DIR;
const COLORS = { jacket: '#a9825a', tee: '#b5483a', pants: '#203a6b', shoe: '#3f7f4f', bag: '#222222' };
const makePng = (k) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#d9d9d9"/><polygon points="220,180 340,140 460,140 580,180 720,320 630,390 580,340 580,820 220,820 220,340 170,390 80,320" fill="${COLORS[k]}" stroke="#111" stroke-width="4"/></svg>`)).png().toBuffer();
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); if (c) console.log('ok  ', m); };
async function api(method, path, tok, body) {
  const r = await fetch(B + path, { method, headers: { ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, ct, json: ct.includes('json') ? await r.json() : null, buf: ct.includes('json') ? null : Buffer.from(await r.arrayBuffer()), headers: r.headers };
}
const suffix = Date.now().toString(36);
async function reg(n) { return (await api('POST', '/api/auth/register', null, { email: `p4${n}${suffix}`, password: 'test1234', displayName: `測試${n}` })).json.accessToken; }
const A = await reg('甲'), Bt = await reg('乙');
const cats = { jacket: 'OUTERWEAR', tee: 'TOP', pants: 'BOTTOM', shoe: 'SHOES', bag: 'BAG' };
const names = { jacket: '駝色外套', tee: '紅色上衣', pants: '深藍長褲', shoe: '綠色球鞋', bag: '黑色包包' };
async function mkItem(tok, k) {
  const it = await api('POST', '/api/items', tok, { name: names[k], category: cats[k], colors: ['#000000'], colorFamily: 'BLACK', seasons: ['AUTUMN'], occasions: ['CASUAL'] });
  const fd = new FormData(); fd.append('file', new Blob([await makePng(k)], { type: 'image/png' }), k + '.png');
  const r = await fetch(B + `/api/items/${it.json.item.id}/images?primary=true`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd });
  const im = await r.json();
  return { itemId: it.json.item.id, imageId: im.image.id };
}
const mine = {}; for (const k of Object.keys(cats)) mine[k] = await mkItem(A, k);
const theirs = await mkItem(Bt, 'tee');
const o = await api('POST', '/api/outfits', A, { name: '秋日通勤', itemIds: Object.values(mine).map((m) => m.itemId) });
ok(o.status === 201, 'create outfit'); const oid = o.json.outfit.id;

{ const d = await api('GET', `/api/outfits/${oid}`, A); ok(d.status === 200 && typeof d.json.outfit?._count?.wearLogs === 'number', 'outfit detail returns _count.wearLogs'); }
ok((await api('POST', `/api/outfits/${oid}/render`, null)).status === 401, 'render without token -> 401');
ok((await api('POST', `/api/outfits/${oid}/render`, A)).status === 409, 'render before layout -> 409');

let r = await api('POST', `/api/outfits/${oid}/canvas/auto`, A, { background: 'card', render: true });
ok(r.status === 200 && r.json.layout.pieces.length === 5, 'auto layout 5 pieces + render');
ok(r.json.cover.coverUrl && r.json.cover.coverThumbUrl, 'auto returns cover urls');
let f = await api('GET', r.json.cover.coverUrl, null);
ok(f.status === 200 && f.ct.includes('webp'), 'cover file served (public)');

const L = (over = {}) => ({ v: 1, background: 'clay', width: 350, height: 392, pieces: [
  { ...mine.pants, x: 0.5, y: 0.6, scale: 0.7, rotate: 0, z: 0, flipX: false },
  { ...mine.tee, x: 0.35, y: 0.3, scale: 0.5, rotate: 30, z: 1, flipX: false },
  { ...mine.jacket, x: 0.68, y: 0.3, scale: 0.5, rotate: -20, z: 2, flipX: true },
  { ...mine.shoe, x: 0.1, y: 0.92, scale: 0.4, rotate: 90, z: 3, flipX: false },
  { ...mine.bag, x: 0.98, y: 0.05, scale: 0.4, rotate: 0, z: 4, flipX: false },
], ...over });
r = await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: L(), render: true });
ok(r.status === 200 && r.json.cover.coverUrl, 'PUT canvas + render');
const lo = r.json.outfit.items.map((i) => i.clothingItem.name);
ok(lo[0] === '深藍長褲' && lo[4] === '黑色包包', 'layerOrder follows z: ' + lo.join(','));
const e = await api('GET', `/api/outfits/${oid}/export.png`, A);
ok(e.status === 200 && e.ct === 'image/png' && /attachment/.test(e.headers.get('content-disposition')), 'export.png');

const l2 = L(); l2.pieces[4].z = 0; l2.pieces[0].z = 5;
r = await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: l2 });
ok(r.json.outfit.items[0].clothingItem.name === '黑色包包', 'z change reorders layerOrder');

const list = await api('GET', '/api/outfits', A);
ok(list.json.outfits[0].coverPath && list.json.outfits[0].coverThumbPath && list.json.outfits[0].canvasLayout, 'list has coverPath/canvasLayout');
const det = await api('GET', `/api/outfits/${oid}`, A);
ok(det.json.outfit.coverPath && det.json.outfit.canvasLayout.v === 1, 'detail has coverPath/canvasLayout');

const old = det.json.outfit.coverPath;
r = await api('POST', `/api/outfits/${oid}/render`, A);
ok(r.status === 200 && r.json.coverPath !== old, 'rerender new filename');
ok((await api('GET', '/api/images/file/' + old, null)).status === 404, 'old cover file removed');

ok((await api('PUT', `/api/outfits/${oid}/canvas`, Bt, { layout: L() })).status === 404, 'B PUT A outfit -> 404');
ok((await api('POST', `/api/outfits/${oid}/canvas/auto`, Bt, {})).status === 404, 'B auto A outfit -> 404');
ok((await api('POST', `/api/outfits/${oid}/render`, Bt)).status === 404, 'B render A outfit -> 404');
ok((await api('GET', `/api/outfits/${oid}/export.png`, Bt)).status === 404, 'B export A outfit -> 404');
let bad = L(); bad.pieces[1] = { ...theirs, x: 0.5, y: 0.5, scale: 0.4, rotate: 0, z: 1, flipX: false };
r = await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: bad, syncItems: true });
ok(r.status === 400, "A uses B's item (even syncItems) -> 400");
const o2 = await api('POST', '/api/outfits', A, { name: '只有兩件', itemIds: [mine.tee.itemId, mine.pants.itemId] });
const oid2 = o2.json.outfit.id;
r = await api('PUT', `/api/outfits/${oid2}/canvas`, A, { layout: L() });
ok(r.status === 400, 'piece not in outfit -> 400');
bad = L(); bad.pieces[0] = { ...bad.pieces[0], imageId: mine.tee.imageId };
ok((await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: bad })).status === 400, 'imageId of another item -> 400');
bad = L(); bad.pieces[0] = { ...bad.pieces[0], imageId: theirs.imageId };
ok((await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: bad })).status === 400, "imageId of B's item -> 400");
bad = L(); bad.pieces.push({ ...mine.tee, x: 0.5, y: 0.5, scale: 0.2, rotate: 0, z: 9, flipX: false });
ok((await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: bad })).status === 400, 'duplicate itemId -> 400');
bad = L({ v: 2 }); ok((await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: bad })).status === 400, 'v=2 -> 400');
bad = L({ background: 'neon' }); ok((await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: bad })).status === 400, 'bad background -> 400');
bad = L(); bad.pieces[0].scale = 99; ok((await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: bad })).status === 400, 'scale out of range -> 400');

const l3 = L(); l3.pieces = [l3.pieces[1], l3.pieces[2]];
r = await api('PUT', `/api/outfits/${oid2}/canvas`, A, { layout: l3, syncItems: true });
ok(r.status === 200 && r.json.outfit.items.length === 2 && r.json.outfit.items.some((i) => i.clothingItem.name === '駝色外套') && !r.json.outfit.items.some((i) => i.clothingItem.name === '深藍長褲'), 'syncItems adds jacket, removes pants');
const l4 = L(); l4.pieces = [l4.pieces[1]];
r = await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: l4 });
ok(r.status === 200 && r.json.unplaced.length === 4 && r.json.outfit.items.length === 5, 'no sync keeps unplaced items and reports them');

const noimg = await api('POST', '/api/items', A, { name: '無照片帽子', category: 'ACCESSORY', colors: ['#111111'], colorFamily: 'BLACK', seasons: ['WINTER'], occasions: ['CASUAL'] });
const o3 = await api('POST', '/api/outfits', A, { name: '含無照片', itemIds: [mine.tee.itemId, noimg.json.item.id] });
r = await api('POST', `/api/outfits/${o3.json.outfit.id}/canvas/auto`, A, { render: true });
ok(r.status === 200 && r.json.layout.pieces.length === 1 && r.json.skippedNoImage.length === 1, 'auto skips item without image');

await api('PUT', `/api/outfits/${oid}/canvas`, A, { layout: L() });
await api('DELETE', `/api/images/${mine.bag.imageId}`, A);
r = await api('POST', `/api/outfits/${oid}/render`, A);
ok(r.status === 200 && r.json.skipped.length === 1 && r.json.skipped[0] === mine.bag.itemId, 'render skips piece whose image was deleted: ' + JSON.stringify(r.json?.skipped));
// ---- integration: render default true, cutout preferred, cover cleanup on outfit delete ----
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const waitCutout = async (tok, imageId) => {
  for (let i = 0; i < 40; i++) {
    const s = await api('GET', `/api/images/${imageId}/cutout`, tok);
    if (s.json?.image?.cutoutStatus === 'DONE') return true;
    if (s.json?.image?.cutoutStatus === 'FAILED') return false;
    await sleep(1500);
  }
  return false;
};
const grayFraction = async (buf) => {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let g = 0;
  for (let i = 0; i < data.length; i += 3) if (Math.abs(data[i] - 217) <= 3 && Math.abs(data[i + 1] - 217) <= 3 && Math.abs(data[i + 2] - 217) <= 3) g++;
  return g / (info.width * info.height);
};
const fresh = await mkItem(A, 'tee');
const o4 = await api('POST', '/api/outfits', A, { name: '去背畫布', itemIds: [fresh.itemId] });
const oid4 = o4.json.outfit.id;
const lay = { v: 1, background: 'clay', width: 350, height: 438, pieces: [{ ...fresh, x: 0.5, y: 0.5, scale: 0.9, rotate: 0, z: 0, flipX: false }] };
r = await api('PUT', `/api/outfits/${oid4}/canvas`, A, { layout: lay });
ok(r.status === 200 && r.json.cover && r.json.cover.coverUrl, 'PUT canvas without render flag now renders the cover (default true)');
const cutoutDone = await waitCutout(A, fresh.imageId);
if (!cutoutDone) console.log('SKIP cutout check (rembg unavailable or FAILED)');
else {
  const e4 = await api('GET', `/api/outfits/${oid4}/export.png`, A);
  const gf = await grayFraction(e4.buf);
  ok(gf < 0.01, 'canvas export uses the P2 cutout (original gray background gone), gray fraction ' + gf.toFixed(4));
}
r = await api('POST', `/api/outfits/${oid4}/render`, A);
const stored = (await api('GET', `/api/outfits/${oid4}`, A)).json.outfit.coverPath;
if (stored && IMG_DIR) {
  ok(fs.existsSync(`${IMG_DIR}/${stored}`), 'cover file exists on disk before delete');
  const d = await api('DELETE', `/api/outfits/${oid4}`, A);
  ok(d.status === 200, 'delete outfit 200');
  ok(!fs.existsSync(`${IMG_DIR}/${stored}`), 'cover file removed from disk after outfit delete');
} else console.log('SKIP disk cleanup check (set IMG_DIR)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
