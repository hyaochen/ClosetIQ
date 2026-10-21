// P2 frontend support smoke: analyze/status, draft items, "use original" (SKIPPED), draft discard.
// usage: node apps/api/scripts/smoke-p2-addflow.mjs http://127.0.0.1:3021 <photo.jpg>
// Local only. Needs REMBG_URL set on the api for the cutout parts.
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:3021';
const PHOTO = process.argv[3];
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error('local only');
if (!PHOTO) throw new Error('photo path required');

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const email = `addflow-${Date.now()}@example.com`;
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'Test12345!', displayName: '加衣測試' }),
}).then((r) => r.json());
const H = { Authorization: `Bearer ${reg.accessToken}` };
const J = { ...H, 'Content-Type': 'application/json' };
const call = async (method, url, body) => {
  const r = await fetch(BASE + url, { method, headers: body ? J : H, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};

// 1. status
const st = await call('GET', '/api/items/analyze/status');
ok('analyze/status shape', st.status === 200 && typeof st.json.enabled === 'boolean' && typeof st.json.provider === 'string', JSON.stringify(st.json));
const noAuth = await fetch(`${BASE}/api/items/analyze/status`);
ok('analyze/status needs auth', noAuth.status === 401);

// 2. draft item is hidden
const draftBody = { draft: true, name: '未命名衣物', category: 'TOP', colors: ['#000000'], colorFamily: 'BLACK', seasons: ['SPRING'], occasions: ['CASUAL'] };
const d = await call('POST', '/api/items', draftBody);
ok('draft created', d.status === 201 && d.json.item.isActive === false);
const itemId = d.json.item.id;
const list1 = await call('GET', '/api/items?limit=50');
ok('draft hidden from list', !list1.json.items.some((i) => i.id === itemId));

// 3. upload + cutout PENDING
const buf = fs.readFileSync(PHOTO);
const up = async (id, primary) => {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'image/jpeg' }), path.basename(PHOTO));
  const r = await fetch(`${BASE}/api/items/${id}/images?primary=${primary}`, { method: 'POST', headers: H, body: fd });
  return { status: r.status, json: await r.json() };
};
const u = await up(itemId, true);
ok('upload 201', u.status === 201);
const imageId = u.json.image.id;
const enabled = u.json.image.cutoutStatus === 'PENDING';
console.log(`INFO  cutout enabled on this api: ${enabled}`);

if (enabled) {
  // 4. skip while pending: result must stay SKIPPED and the cutout files must not appear
  const del = await call('DELETE', `/api/images/${imageId}/cutout`);
  ok('use original -> SKIPPED', del.status === 200 && del.json.image.cutoutStatus === 'SKIPPED');
  await sleep(6000);
  const after = await call('GET', `/api/images/${imageId}/cutout`);
  ok('still SKIPPED after the job would have finished', after.json.image.cutoutStatus === 'SKIPPED' && !after.json.image.cutoutPath, JSON.stringify(after.json.image));
  const bf = await call('GET', '/api/images/cutout/backfill');
  ok('backfill does not count SKIPPED', bf.json.remaining === 0, `remaining=${bf.json.remaining}`);

  // 5. redo cutout from SKIPPED works
  const re = await fetch(`${BASE}/api/images/${imageId}/cutout?wait=true`, { method: 'POST', headers: H });
  const rej = await re.json();
  ok('re-cutout from SKIPPED -> DONE', rej.image?.cutoutStatus === 'DONE', rej.image?.cutoutStatus);

  // other user cannot skip
  const reg2 = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `other-${Date.now()}@example.com`, password: 'Test12345!', displayName: '別人' }),
  }).then((r) => r.json());
  const x = await fetch(`${BASE}/api/images/${imageId}/cutout`, { method: 'DELETE', headers: { Authorization: `Bearer ${reg2.accessToken}` } });
  ok("other user's DELETE cutout -> 404", x.status === 404);
}

// 4b. publish the draft
const pub = await call('PUT', `/api/items/${itemId}`, { name: '白色襯衫', category: 'TOP', colors: ['#EEEEEE'], colorFamily: 'WHITE', seasons: ['SPRING'], occasions: ['CASUAL'], draft: false });
ok('PUT draft=false publishes', pub.status === 200 && pub.json.item.isActive === true);
const list2 = await call('GET', '/api/items?limit=50');
ok('published item visible', list2.json.items.some((i) => i.id === itemId));

// 6. discard a draft: item and files are gone
const d2 = await call('POST', '/api/items', draftBody);
const u2 = await up(d2.json.item.id, true);
const files = fs.existsSync(process.env.IMAGE_STORAGE_PATH || '') ? true : null;
const del2 = await call('DELETE', `/api/items/${d2.json.item.id}?permanent=true`);
ok('discard draft 200', del2.status === 200);
const gone = await call('GET', `/api/items/${d2.json.item.id}`);
ok('discarded draft is gone', gone.status === 404);
if (process.env.IMAGE_STORAGE_PATH) {
  const orig = path.join(process.env.IMAGE_STORAGE_PATH, u2.json.image.originalPath);
  ok('discarded draft image file removed', !fs.existsSync(orig));
}

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
