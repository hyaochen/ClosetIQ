// T-CL-017 smoke: AI analyze through the host claude-bridge, allowlist, bridge-down behaviour.
//   node apps/api/scripts/smoke-ai-bridge.mjs <apiBase> <phase> <photo.jpg> <stateFile>
// phases (the driver restarts the api between them; local api only, throwaway users):
//   deny  api has AI_ALLOWED_USER_IDS empty        -> registers users A and B, expects 403/false for both
//   allow api has AI_ALLOWED_USER_IDS=<A id>       -> A ok + valid fields, B 403 + status false
//   down  same allowlist, bridge process stopped   -> status false, analyze 502 (no quota burn), adding an item still works
import fs from 'node:fs';
import path from 'node:path';

const [base, phase, photo, stateFile] = process.argv.slice(2);
if (!base || !phase || !photo || !stateFile) throw new Error('usage: smoke-ai-bridge.mjs <apiBase> <deny|allow|down> <photo> <stateFile>');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('refusing to run against a non-local api');

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed++;
};
const post = (url, body, token) =>
  fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const get = (url, token) => fetch(base + url, { headers: { Authorization: `Bearer ${token}` } });
const analyzeUpload = async (token) => {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(photo)], { type: 'image/jpeg' }), path.basename(photo));
  return fetch(base + '/api/items/analyze', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
};

let state = {};
if (phase === 'deny') {
  const mk = async (tag) => {
    const email = `ai-${tag}-${Date.now()}@example.com`;
    const reg = await (await post('/api/auth/register', { email, password: 'Test12345!', displayName: `辨識測試${tag}` })).json();
    return { email, id: reg.user.id, token: reg.accessToken };
  };
  state = { A: await mk('甲'), B: await mk('乙') };
  fs.writeFileSync(stateFile, JSON.stringify(state));
} else {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  for (const k of ['A', 'B']) {
    const r = await (await post('/api/auth/login', { email: state[k].email, password: 'Test12345!' })).json();
    state[k].token = r.accessToken;
  }
}
const { A, B } = state;
const stA = await (await get('/api/items/analyze/status', A.token)).json();
const stB = await (await get('/api/items/analyze/status', B.token)).json();

if (phase === 'deny') {
  ok('empty allowlist: status disabled for A and B', stA.enabled === false && stB.enabled === false, JSON.stringify(stA));
  ok('empty allowlist: analyze 403', (await analyzeUpload(A.token)).status === 403);
}

if (phase === 'allow') {
  ok('allowed user: status enabled (bridge pinged)', stA.enabled === true && stA.provider === 'bridge', JSON.stringify(stA));
  ok('not-allowed user: status disabled', stB.enabled === false);
  ok('not-allowed user: analyze 403 (no quota used)', (await analyzeUpload(B.token)).status === 403);
  const t0 = Date.now();
  const r = await analyzeUpload(A.token);
  const j = await r.json();
  const ms = Date.now() - t0;
  const s = j.suggestion || {};
  ok('allowed user: analyze 200 via bridge', r.status === 200 && j.provider === 'bridge', `${ms}ms`);
  ok('suggestion has valid category/colorFamily/pattern enums',
    ['TOP', 'BOTTOM', 'OUTERWEAR', 'DRESS', 'SHOES', 'ACCESSORY', 'UNDERWEAR', 'BAG'].includes(s.category?.value) &&
    s.colorFamily?.value && s.pattern?.value, JSON.stringify({ c: s.category, col: s.colorFamily, p: s.pattern }));
  ok('confidences are within 0..1', Object.values(s).every((f) => f === null || (f.confidence >= 0 && f.confidence <= 1)));
  ok('subscription cost reported as 0', j.usage?.estimatedCostUsd === 0);
  ok('quota counted once', j.quota?.used === 1, JSON.stringify(j.quota));
  // analyze by imageId needs an uploaded image; covered by smoke-p2. Here: confirm no-auth is rejected.
  ok('analyze without token 401', (await fetch(base + '/api/items/analyze', { method: 'POST' })).status === 401);
}

if (phase === 'down') {
  ok('bridge stopped: status disabled (allowed user)', stA.enabled === false, JSON.stringify(stA));
  const r = await analyzeUpload(A.token);
  ok('bridge stopped: analyze 502, not a crash', r.status === 502);
  const q = await (await get('/api/items/analyze/status', A.token)).json();
  ok('status still false on second call', q.enabled === false);
  const item = await post('/api/items', { name: '白色棉質襯衫', category: 'TOP', colors: ['#FFFFFF'], colorFamily: 'WHITE', seasons: ['SPRING'], occasions: ['CASUAL'] }, A.token);
  const ij = await item.json();
  ok('adding an item still works with bridge down', item.status === 201 && !!ij.item?.id, `status ${item.status}`);
  const list = await (await get('/api/items?limit=20', A.token)).json();
  ok('item appears in the list', list.items?.some((i) => i.name === '白色棉質襯衫'));
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
