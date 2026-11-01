// T-CL-022 smoke: POST /api/tryon through the host tryon-bridge (local api + throwaway DB only).
//   node apps/api/scripts/smoke-tryon.mjs <apiBase> <phase> <person.jpg> <garment.png> <stateFile> [outPng]
// phases (the driver restarts the api between them):
//   deny   api has AI_ALLOWED_USER_IDS empty       -> registers users A and B, expects status false / 403
//   allow  api has AI_ALLOWED_USER_IDS=<A id>, TRYON_DAILY_LIMIT=1
//          -> A: status true, SHOES 400, B's item 404, real try-on returns a PNG, second call 429 (quota); B 403
import fs from 'node:fs';

const [base, phase, person, garment, stateFile, outPng] = process.argv.slice(2);
if (!base || !phase || !person || !garment || !stateFile) throw new Error('usage: see header');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('refusing to run against a non-local api');

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed++;
};
const json = (method, url, body, token) =>
  fetch(base + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
const tryon = (token, itemId, file = person) => {
  const fd = new FormData();
  fd.append('itemId', itemId);
  fd.append('file', new Blob([fs.readFileSync(file)], { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' }), 'person.jpg');
  return fetch(base + '/api/tryon', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
};

let state = {};
if (phase === 'deny') {
  const suffix = Date.now().toString(36);
  const mk = async (tag) => {
    const email = `tryon-${tag}-${suffix}@example.test`;
    const r = await (await json('POST', '/api/auth/register', { email, password: 'abc12345', displayName: `試穿${tag}` })).json();
    const l = await (await json('POST', '/api/auth/login', { email, password: 'abc12345' })).json();
    return { id: r.user.id, token: l.accessToken };
  };
  const A = await mk('A');
  const B = await mk('B');
  const item = async (u, name, category) => {
    const r = await (await json('POST', '/api/items', { name, category, colors: ['#336699'], colorFamily: 'BLUE', seasons: ['SPRING'], occasions: ['CASUAL'] }, u.token)).json();
    return r.item.id;
  };
  const top = await item(A, '黑色短袖上衣', 'TOP');
  const shoes = await item(A, '白色球鞋', 'SHOES');
  const bItem = await item(B, '乙的上衣', 'TOP');
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(garment)], { type: 'image/png' }), '衣物.png');
  const up = await fetch(`${base}/api/items/${top}/images?primary=true`, { method: 'POST', headers: { Authorization: `Bearer ${A.token}` }, body: fd });
  ok('garment image uploaded', up.status === 201, `status=${up.status}`);
  state = { A, B, top, shoes, bItem };
  fs.writeFileSync(stateFile, JSON.stringify(state));
  ok('allowlist empty: status disabled for A', (await (await json('GET', '/api/tryon/status', null, A.token)).json()).enabled === false);
  ok('allowlist empty: POST /api/tryon 403', (await tryon(A.token, top)).status === 403);
  console.log(`A id for AI_ALLOWED_USER_IDS: ${A.id}`);
} else if (phase === 'allow') {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const { A, B, top, shoes, bItem } = state;
  ok('A status enabled', (await (await json('GET', '/api/tryon/status', null, A.token)).json()).enabled === true);
  ok('B status disabled (not in allowlist)', (await (await json('GET', '/api/tryon/status', null, B.token)).json()).enabled === false);
  ok('B POST 403', (await tryon(B.token, bItem)).status === 403);
  ok('no JWT -> 401', (await fetch(base + '/api/tryon/status')).status === 401);
  ok('SHOES -> 400', (await tryon(A.token, shoes)).status === 400);
  ok("someone else's item -> 404", (await tryon(A.token, bItem)).status === 404);
  const t0 = Date.now();
  const res = await tryon(A.token, top);
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  ok('real try-on returns a PNG', res.status === 200 && isPng, `status=${res.status} bytes=${buf.length} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (isPng && outPng) fs.writeFileSync(outPng, buf);
  const again = await tryon(A.token, top);
  ok('second call hits the daily limit (429, TRYON_DAILY_LIMIT=1)', again.status === 429);
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
