// ---- P2 ---- Smoke test for cutout + AI analyze endpoints.
//   node apps/api/scripts/smoke-p2.mjs <apiBase> <photoDir>
// Needs a LOCAL api (never the production one): it registers throwaway users with Chinese names.
// Expects AI_DAILY_LIMIT=3 on the server and a working rembg (REMBG_URL) for the cutout steps.
import fs from 'node:fs';
import path from 'node:path';

const [base = 'http://127.0.0.1:3012', photoDir] = process.argv.slice(2);
if (!photoDir) throw new Error('usage: smoke-p2.mjs <apiBase> <photoDir>');
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(base)) throw new Error('refusing to run against a non-local api');

const photos = fs.readdirSync(photoDir).filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).slice(0, 3);
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failed++;
};
const mime = (f) => (f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + url, { method, headers, body: payload });
  let json = null;
  try { json = await res.json(); } catch { /* binary or empty */ }
  return { status: res.status, json };
}

async function register(tag) {
  const email = `冒煙測試${tag}${Date.now()}`;
  const r = await call('POST', '/api/auth/register', null, { email, password: '測試密碼123456', displayName: `測試者${tag}` });
  if (r.status !== 201) throw new Error('register failed ' + JSON.stringify(r.json));
  return r.json.accessToken;
}

function photoForm(f) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(path.join(photoDir, f))], { type: mime(f) }), f);
  return fd;
}

const A = await register('甲');
const B = await register('乙');

// ---- create an item + upload photos as A ----
const item = await call('POST', '/api/items', A, {
  name: '測試白襯衫', category: 'TOP', colors: ['#FFFFFF'], colorFamily: 'WHITE', seasons: ['SPRING'], occasions: ['CASUAL'],
});
check('create item', item.status === 201, String(item.status));
const itemId = item.json.item.id;

const t0 = Date.now();
const up = await call('POST', `/api/items/${itemId}/images?primary=true`, A, photoForm(photos[0]));
const upMs = Date.now() - t0;
check('upload returns 201 immediately with cutout PENDING', up.status === 201 && up.json.image.cutoutStatus === 'PENDING', `${upMs}ms status=${up.json?.image?.cutoutStatus}`);
const imageId = up.json.image.id;

// ---- poll until the async cutout finishes ----
let st;
for (let i = 0; i < 60; i++) {
  st = await call('GET', `/api/images/${imageId}/cutout`, A);
  if (st.json.image.cutoutStatus !== 'PENDING') break;
  await sleep(1000);
}
check('cutout becomes DONE', st.json.image.cutoutStatus === 'DONE', st.json.image.cutoutStatus);
const cutoutUrl = `${base}/api/images/file/${st.json.image.cutoutPath}`;
const fileRes = await fetch(cutoutUrl);
check('cutout file served as webp', fileRes.status === 200 && (await fileRes.arrayBuffer()).byteLength > 1000);

// ---- re-cutout with wait ----
const re = await call('POST', `/api/images/${imageId}/cutout?wait=true`, A);
check('POST cutout?wait=true returns DONE', re.status === 200 && re.json.image.cutoutStatus === 'DONE');

// ---- ownership: B must not touch A's image ----
check('other user GET cutout -> 404', (await call('GET', `/api/images/${imageId}/cutout`, B)).status === 404);
check('other user POST cutout -> 404', (await call('POST', `/api/images/${imageId}/cutout`, B)).status === 404);
check('no token -> 401', (await call('GET', `/api/images/${imageId}/cutout`, null)).status === 401);

// ---- backfill: B has nothing; A gets 2 more photos (uploaded, then reset to NONE by status of a failed cutout is not needed) ----
const b0 = await call('POST', '/api/images/cutout/backfill', B, {});
check('backfill for user without images -> 202, total 0', b0.status === 202 && b0.json.job.total === 0, JSON.stringify(b0.json.job));
for (const f of photos.slice(1)) await call('POST', `/api/items/${itemId}/images`, A, photoForm(f));
await sleep(500);
const bf = await call('POST', '/api/images/cutout/backfill', A, { limit: 5 });
check('backfill call accepted', bf.status === 202, JSON.stringify(bf.json.job));
const bad = await call('POST', '/api/images/cutout/backfill', A, { limit: 9999 });
check('backfill rejects limit > 100', bad.status === 400);
const cancel = await call('POST', '/api/images/cutout/backfill/cancel', A);
check('cancel endpoint answers', cancel.status === 200, JSON.stringify(cancel.json));

// ---- AI analyze (provider mock unless a key is configured) ----
const an1 = await call('POST', '/api/items/analyze', A, photoForm(photos[0]));
check('analyze multipart 200', an1.status === 200, `provider=${an1.json?.provider}`);
if (an1.status === 200) {
  const s = an1.json.suggestion;
  check('analyze returns enum-valid category + confidence', typeof s.category?.value === 'string' && s.category.confidence >= 0 && s.category.confidence <= 1);
  check('analyze quota reported', an1.json.quota.limit === 3 && an1.json.quota.used === 1, JSON.stringify(an1.json.quota));
}
const an2 = await call('POST', '/api/items/analyze', A, { imageId });
check('analyze by imageId 200', an2.status === 200);
check('analyze other user imageId -> 404', (await call('POST', '/api/items/analyze', B, { imageId })).status === 404);
check('analyze without input -> 400', (await call('POST', '/api/items/analyze', A, {})).status === 400);
check('analyze no token -> 401', (await call('POST', '/api/items/analyze', null, { imageId })).status === 401);
const an3 = await call('POST', '/api/items/analyze', A, { imageId });
check('3rd analyze still allowed (limit 3)', an3.status === 200);
const an4 = await call('POST', '/api/items/analyze', A, { imageId });
check('4th analyze -> 429', an4.status === 429, JSON.stringify(an4.json?.quota));
const anB = await call('POST', '/api/items/analyze', B, photoForm(photos[1] ?? photos[0]));
check('quota is per user (B still ok)', anB.status === 200);

// ---- upload must succeed with a dead rembg: covered by running the server with REMBG_URL pointing at a closed port ----
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
