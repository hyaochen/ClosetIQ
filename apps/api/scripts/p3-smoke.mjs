// P3 smoke test. Needs: api on 127.0.0.1:3013, IMAGE_STORAGE_PATH env (same as the api), docker container closet-p3-db (psql used to backdate createdAt).
// Usage: IMAGE_STORAGE_PATH=/tmp/p3img node apps/api/scripts/p3-smoke.mjs   (makes ~100 requests: stay under the 100/min rate limit)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const BASE = process.env.BASE || 'http://127.0.0.1:3013';
const STORE = process.env.IMAGE_STORAGE_PATH;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const j = async (method, path, token, body, form) => {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let b;
  if (form) b = form; else if (body) { headers['content-type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers, body: b });
  let data = null; try { data = await r.json(); } catch {}
  return { s: r.status, d: data };
};
const photo = async (w, h, orient) => {
  let s = sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 90 } } }).jpeg();
  if (orient) s = s.withMetadata({ orientation: orient });
  return await s.toBuffer();
};
const form = (buf, name = 'ootd.jpg', type = 'image/jpeg') => { const f = new FormData(); f.append('file', new Blob([buf], { type }), name); return f; };
const sql = (q) => execSync('docker exec ' + (process.env.DB_CONTAINER || 'closet-p3-db') + ' psql -U closet -d closet -c "' + q.replace(/"/g, '\\"') + '"').toString();
const countFiles = (dir) => { try { return fs.readdirSync(dir).length; } catch { return 0; } };

const reg = async (n) => (await j('POST', '/api/auth/register', null, { email: n + '@test.local', password: 'Test1234!x', displayName: n })).d;
const stamp = Date.now();
const A = await reg('小美' + stamp), B = await reg('小明' + stamp);
console.log('register', !!A?.accessToken, !!B?.accessToken);
const ta = A.accessToken, tb = B.accessToken, uidA = A.user.id;
const item = async (name, cat) => (await j('POST', '/api/items', ta, { name, category: cat, colors: ['#ffffff'], colorFamily: 'WHITE', seasons: ['SPRING'], occasions: ['CASUAL'] })).d.item;
const tee = await item('白色T恤', 'TOP'), pants = await item('深藍直筒褲', 'BOTTOM'), coat = await item('黑色外套', 'OUTERWEAR'),
  shoe = await item('白色球鞋', 'SHOES'), oldShirt = await item('舊襯衫', 'TOP'), hatA = await item('十一月帽子', 'ACCESSORY'), hatB = await item('十月底帽子', 'ACCESSORY');
const up = await j('POST', `/api/items/${tee.id}/images?primary=true`, ta, null, form(await photo(500, 500)));
ok(up.s === 201, 'item image upload');
// control createdAt around the Taipei month end
sql(`UPDATE "ClothingItem" SET "createdAt"='2026-08-15T00:00:00Z' WHERE "userId"='${uidA}'`);
sql(`UPDATE "ClothingItem" SET "createdAt"='2026-10-31T18:00:00Z' WHERE id='${hatA.id}'`); // Nov 1 02:00 Taipei
sql(`UPDATE "ClothingItem" SET "createdAt"='2026-10-31T15:59:59Z' WHERE id='${hatB.id}'`); // Oct 31 23:59:59 Taipei
sql(`UPDATE "ClothingItem" SET "isActive"=false, "declutteredAt"='2026-10-05T04:00:00Z' WHERE id='${oldShirt.id}'`);

const wl = async (date, ids) => (await j('POST', '/api/wear-logs', ta, { date, itemIds: ids })).d.log;
await wl('2026-09-15', [oldShirt.id, pants.id]);
await wl('2026-09-30', [tee.id, pants.id]);
await wl('2026-10-01', [tee.id, pants.id, shoe.id]);
const l31a = await wl('2026-10-31', [tee.id, pants.id]);
const l31b = await wl('2026-10-31', [coat.id]);
await wl('2026-11-01', [tee.id]);

let r = await j('GET', '/api/wear-logs', ta);
ok(r.s === 200 && r.d.logs.length === 6 && r.d.pagination.total === 6, 'legacy GET /api/wear-logs unchanged');
r = await j('GET', '/api/wear-logs?from=2026-10-01&to=2026-10-31', ta);
ok(r.s === 200 && r.d.logs.length === 3, 'legacy from/to unchanged');
r = await j('GET', '/api/wear-logs?month=2026-10', ta);
ok(r.s === 200 && r.d.days.map((d) => d.date).join() === '2026-10-01,2026-10-31', 'month view day keys (10-01, 10-31): ' + r.d.days.map((d) => d.date));
ok(r.d.days[1].logCount === 2, 'two logs on 10-31 grouped');
ok(r.d.days[0].logs[0].items.some((i) => i.thumbnailPath), 'item thumbnail in month view');
r = await j('GET', '/api/wear-logs?month=2026-9', ta); ok(r.s === 400, 'bad month 400');
r = await j('GET', '/api/wear-logs?month=2026-10'); ok(r.s === 401, 'unauth 401');

r = await j('GET', '/api/stats/monthly-recap?month=2026-10', ta);
console.log(JSON.stringify(r.d));
ok(r.d.daysLogged === 2 && r.d.wearLogCount === 3, 'Oct days=2 logs=3');
ok(r.d.itemsWorn === 4 && r.d.wardrobeSize === 5 && r.d.usageRate === 0.8, 'Oct usage 4/5 (hatB in, hatA out, oldShirt out)');
ok(r.d.topItems[0].count === 2 && r.d.topItems.length === 3, 'top3 items');
ok(r.d.topPairs[0].count === 2 && r.d.topPairs[0].items.map((i) => i.name).sort().join() === ['深藍直筒褲', '白色T恤'].sort().join(), 'top pair tee+pants x2');
ok(r.d.previous.month === '2026-09' && r.d.previous.usageRate === 0.6 && r.d.usageRateDelta === 0.2, 'prev month 0.6, delta 0.2');
r = await j('GET', '/api/stats/monthly-recap?month=2026-11', ta);
ok(r.d.daysLogged === 1 && r.d.itemsWorn === 1, 'Nov only has the 11-01 log');
r = await j('GET', '/api/stats/monthly-recap?month=2025-12', ta); ok(r.s === 200 && r.d.previous.month === '2025-11' && r.d.usageRate === 0, 'empty month zeros');
r = await j('GET', '/api/stats/monthly-recap?month=2026-01', ta); ok(r.d.previous.month === '2025-12', 'year rollover previous month');
r = await j('GET', '/api/stats/monthly-recap?month=bad', ta); ok(r.s === 400, 'recap bad month 400');
r = await j('GET', '/api/stats/yearly-recap?year=2026', ta);
ok(r.s === 200 && r.d.monthlyDaysLogged.length === 12 && r.d.monthlyDaysLogged[8] === 2 && r.d.monthlyDaysLogged[9] === 2 && r.d.monthlyDaysLogged[10] === 1 && r.d.daysLogged === 5, 'yearly month days array ' + r.d.monthlyDaysLogged);
r = await j('GET', '/api/stats/yearly-recap?year=26', ta); ok(r.s === 400, 'yearly bad year 400');

const dirThumb = `${STORE}/${uidA}/ootd/thumbnail`;
r = await j('POST', '/api/wear-logs/photo?date=2026-10-20', ta, null, form(await photo(600, 800, 6)));
ok(r.s === 201 && r.d.created === true && r.d.log.items.length === 0 && r.d.log.photoThumbnailPath?.includes('/ootd/thumbnail/'), 'photo-first creates empty log under ootd/');
const l20 = r.d.log;
const meta = await sharp(fs.readFileSync(`${STORE}/${l20.photoDisplayPath}`)).metadata();
ok(meta.width > meta.height && meta.format === 'webp', `EXIF rotated (display ${meta.width}x${meta.height}, ${meta.format})`);
const tm = await sharp(fs.readFileSync(`${STORE}/${l20.photoThumbnailPath}`)).metadata();
ok(tm.width === 300 && tm.height === 400, 'ootd thumbnail 300x400');
r = await j('POST', '/api/wear-logs/photo?date=2026-10-20', ta, null, form(await photo(600, 800)));
ok(r.s === 200 && r.d.created === false && r.d.log.id === l20.id, 'retake same day reuses the log');
ok(countFiles(dirThumb) === 1, 'old photo files deleted on replace (thumbnail dir count=' + countFiles(dirThumb) + ')');
r = await j('PATCH', `/api/wear-logs/${l20.id}`, ta, { itemIds: [tee.id, pants.id], occasion: 'CASUAL', notes: '補選衣物' });
ok(r.s === 200 && r.d.log.items.length === 2 && r.d.log.photoDisplayPath, 'PATCH fills items, photo kept');
r = await j('GET', '/api/wear-logs?month=2026-10', ta);
const d20 = r.d.days.find((d) => d.date === '2026-10-20');
ok(d20 && d20.photoThumbnailPath && d20.logs[0].items.length === 2, 'month view shows photo + items for 10-20');
const th = await fetch(BASE + '/api/images/file/' + d20.photoThumbnailPath);
ok(th.status === 200 && th.headers.get('content-type') === 'image/webp', 'thumbnail servable');

r = await j('POST', '/api/wear-logs/photo?date=2026-10-31', ta, null, form(await photo(600, 800)));
ok(r.s === 200 && r.d.created === false && r.d.log.id === l31a.id, 'multi-log day: photo goes to earliest log');
r = await j('POST', `/api/wear-logs/${l31b.id}/photo`, ta, null, form(await photo(600, 800)));
ok(r.s === 200 && r.d.log.id === l31b.id && r.d.log.photoThumbnailPath, 'explicit log photo upload');
r = await j('POST', '/api/wear-logs/photo?date=2026-10-31', ta, null, form(await photo(600, 800)));
ok(r.d.log.id === l31a.id, 'retake prefers earliest log that already has a photo');
r = await j('GET', '/api/wear-logs?month=2026-10', ta);
const d31 = r.d.days.find((d) => d.date === '2026-10-31');
ok(d31.photoThumbnailPath === d31.logs[0].photoThumbnailPath && d31.logs[1].photoThumbnailPath, 'day photo = first log with photo');

r = await j('POST', '/api/wear-logs/photo?date=2026-10-19', ta, null, form(Buffer.from('not an image'), 'x.txt', 'text/plain'));
ok(r.s === 400, 'bad mime 400');
r = await j('POST', '/api/wear-logs/photo?date=2026-10-19', ta, null, form(Buffer.from('not an image'), 'x.jpg', 'image/jpeg'));
ok(r.s === 400, 'corrupt jpeg 400 (status ' + r.s + ')');
r = await j('GET', '/api/wear-logs?month=2026-10', ta);
ok(!r.d.days.find((d) => d.date === '2026-10-19'), 'rejected upload leaves no empty log');
r = await j('POST', '/api/wear-logs/photo?date=2026-13-40', ta, null, form(await photo(10, 10))); ok(r.s === 400, 'bad date 400');
r = await j('POST', '/api/wear-logs/photo', ta, null, new FormData()); ok(r.s === 400, 'no file 400 (status ' + r.s + ')');
r = await j('POST', '/api/wear-logs/photo?date=2026-10-19', null, null, form(await photo(10, 10))); ok(r.s === 401, 'photo unauth 401');
r = await j('POST', '/api/wear-logs/photo', ta, null, form(await photo(300, 400)));
console.log('default date (Taipei today) log =', r.d.log.date, '| UTC today =', new Date().toISOString().slice(0, 10));

r = await j('POST', `/api/wear-logs/${l20.id}/photo`, tb, null, form(await photo(10, 10))); ok(r.s === 404, 'B upload to A log 404');
r = await j('DELETE', `/api/wear-logs/${l20.id}/photo`, tb); ok(r.s === 404, 'B delete A photo 404');
r = await j('PATCH', `/api/wear-logs/${l20.id}`, tb, { notes: 'x' }); ok(r.s === 404, 'B patch A log 404');
const bItem = (await j('POST', '/api/items', tb, { name: '小明的衣服', category: 'TOP', colors: ['#000000'], colorFamily: 'BLACK', seasons: ['SPRING'], occasions: ['CASUAL'] })).d.item;
r = await j('PATCH', `/api/wear-logs/${l20.id}`, ta, { itemIds: [bItem.id] }); ok(r.s === 400, 'A patch with B item rejected');
r = await j('GET', '/api/wear-logs?month=2026-10', tb); ok(r.d.days.length === 0, 'B month view empty');
r = await j('GET', '/api/stats/monthly-recap?month=2026-10', tb); ok(r.d.daysLogged === 0 && r.d.usageRate === 0, 'B recap zero');

const before = countFiles(dirThumb);
r = await j('DELETE', `/api/wear-logs/${l31b.id}/photo`, ta);
ok(r.s === 200 && r.d.log.photoThumbnailPath === null && countFiles(dirThumb) === before - 1, 'DELETE photo clears columns and file');
const before2 = countFiles(dirThumb);
r = await j('DELETE', `/api/wear-logs/${l20.id}`, ta);
ok(r.s === 200 && countFiles(dirThumb) === before2 - 1, 'DELETE wear log removes photo files');
console.log(fails ? `FAILURES: ${fails}` : 'ALL PASS');
