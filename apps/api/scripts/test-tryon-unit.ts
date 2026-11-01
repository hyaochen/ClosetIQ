// T-CL-022 unit checks (no DB, no GPU: a throwaway local fake bridge stands in for tools/tryon-bridge).
//   npx tsx apps/api/scripts/test-tryon-unit.ts
import http from 'node:http';
import {
  mapCategory,
  isTryonUserAllowed,
  tryonStatus,
  runTryon,
  resetTryonPingCache,
  tryonDailyLimit,
  TryonError,
} from '../src/services/tryon.service.js';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failed++;
};
const setEnv = (e: Record<string, string | undefined>) => {
  for (const k of ['TRYON_BRIDGE_TOKEN', 'TRYON_BRIDGE_URL', 'AI_ALLOWED_USER_IDS', 'TRYON_DAILY_LIMIT']) delete process.env[k];
  for (const [k, v] of Object.entries(e)) if (v !== undefined) process.env[k] = v;
};

// ---- category mapping ----
check('TOP/OUTERWEAR -> tops', mapCategory('TOP') === 'tops' && mapCategory('OUTERWEAR') === 'tops');
check('BOTTOM -> bottoms, DRESS -> one-pieces', mapCategory('BOTTOM') === 'bottoms' && mapCategory('DRESS') === 'one-pieces');
check('unsupported categories -> null', ['SHOES', 'ACCESSORY', 'UNDERWEAR', 'BAG', 'nope'].every((c) => mapCategory(c) === null));

// ---- allowlist + daily limit ----
setEnv({ AI_ALLOWED_USER_IDS: '' });
check('empty allowlist -> nobody', !isTryonUserAllowed('u1'));
setEnv({ AI_ALLOWED_USER_IDS: ' u1 , u2 ' });
check('allowlist trims and matches', isTryonUserAllowed('u1') && isTryonUserAllowed('u2') && !isTryonUserAllowed('u3'));
check('default daily limit 20', tryonDailyLimit() === 20);
setEnv({ TRYON_DAILY_LIMIT: '3' });
check('daily limit from env', tryonDailyLimit() === 3);
setEnv({ TRYON_DAILY_LIMIT: 'abc' });
check('bad daily limit falls back to 20', tryonDailyLimit() === 20);

// ---- fake bridge ----
const TOKEN = 'y'.repeat(40);
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
let health = 0;
let mode: 'ok' | 'busy' | 'badreq' | 'down' = 'ok';
let lastBody: any = null;
const fake = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401).end(); return; }
  if (req.url === '/health') { health++; res.writeHead(mode === 'down' ? 503 : 200).end('{}'); return; }
  if (req.url === '/tryon' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      lastBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (mode === 'busy') { res.writeHead(429).end('{}'); return; }
      if (mode === 'badreq') { res.writeHead(400).end('{}'); return; }
      res.writeHead(200, { 'content-type': 'image/png' }).end(PNG);
    });
    return;
  }
  res.writeHead(404).end();
});
await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()));
const port = (fake.address() as { port: number }).port;
const base = { TRYON_BRIDGE_TOKEN: TOKEN, AI_ALLOWED_USER_IDS: 'u1', TRYON_BRIDGE_URL: `http://127.0.0.1:${port}` };

setEnv({ ...base });
resetTryonPingCache();
check('status enabled: token + allowed user + bridge up', (await tryonStatus('u1')).enabled === true);
await tryonStatus('u1');
check('ping cached (1 health hit)', health === 1, `hits=${health}`);
check('status disabled for user not in allowlist', (await tryonStatus('u9')).enabled === false);
setEnv({ ...base, TRYON_BRIDGE_TOKEN: undefined });
check('status disabled without token', (await tryonStatus('u1')).enabled === false);
setEnv({ ...base });

// ---- runTryon ----
const out = await runTryon(Buffer.from('person'), Buffer.from('garment'), 'tops');
check('runTryon returns the PNG bytes', out.equals(PNG));
check('request carries base64 images + category', lastBody.category === 'tops' && Buffer.from(lastBody.person, 'base64').toString() === 'person' && Buffer.from(lastBody.garment, 'base64').toString() === 'garment');
mode = 'busy';
let busy: unknown = null;
try { await runTryon(Buffer.from('p'), Buffer.from('g'), 'bottoms'); } catch (e) { busy = e; }
check('bridge 429 -> TryonError(429)', busy instanceof TryonError && busy.status === 429);
mode = 'badreq';
let bad: unknown = null;
try { await runTryon(Buffer.from('p'), Buffer.from('g'), 'bottoms'); } catch (e) { bad = e; }
check('bridge 400 -> TryonError(400)', bad instanceof TryonError && bad.status === 400);

mode = 'down';
resetTryonPingCache();
check('bridge answering 503 -> status disabled', (await tryonStatus('u1')).enabled === false);
fake.close();
resetTryonPingCache();
const t0 = Date.now();
check('bridge down -> status disabled quickly', (await tryonStatus('u1')).enabled === false && Date.now() - t0 < 3000, `${Date.now() - t0}ms`);
let netErr = false;
try { await runTryon(Buffer.from('x'), Buffer.from('y'), 'tops'); } catch { netErr = true; }
check('bridge down -> runTryon throws (route returns 502 and refunds)', netErr);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
