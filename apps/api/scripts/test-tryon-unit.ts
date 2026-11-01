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
  submitTryonJob,
  getTryonJob,
  getTryonResult,
  sweepTryonJobs,
  resetTryonJobs,
  reserveTryonQuota,
  refundTryonQuota,
} from '../src/services/tryon.service.js';
import { prisma } from '../src/lib/prisma.js';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failed++;
};
const setEnv = (e: Record<string, string | undefined>) => {
  for (const k of ['TRYON_BRIDGE_TOKEN', 'TRYON_BRIDGE_URL', 'AI_ALLOWED_USER_IDS', 'TRYON_DAILY_LIMIT', 'TRYON_JOB_TTL_MS', 'TRYON_JOB_TIMEOUT_MS', 'TRYON_MAX_QUEUED', 'TRYON_MAX_JOBS']) delete process.env[k];
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
let mode: 'ok' | 'busy' | 'badreq' | 'down' | 'err' = 'ok';
// gate: while held, /tryon answers only after release() (lets tests observe queued/running states)
let release: () => void = () => {};
let gate: Promise<void> = Promise.resolve();
const hold = () => { gate = new Promise<void>((r) => { release = r; }); };
let tryonCalls = 0;
let lastBody: any = null;
const fake = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401).end(); return; }
  if (req.url === '/health') { health++; res.writeHead(mode === 'down' ? 503 : 200).end('{}'); return; }
  if (req.url === '/tryon' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      lastBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      tryonCalls++;
      await gate;
      if (mode === 'err') { res.writeHead(500).end('{}'); return; }
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

// ---- T-CL-023 submit + poll ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn: () => boolean, ms = 3000) => { const t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(15); return fn(); };
const P = Buffer.from('p'), G = Buffer.from('g');
mode = 'ok';
resetTryonJobs();

// queued -> running -> done, ownership, one in flight per user
hold();
let refunds = 0;
const calls0 = tryonCalls;
const j1 = submitTryonJob('u1', P, G, 'tops', () => { refunds++; });
check('submit returns a job id at once', typeof j1 === 'string' && j1.length > 10);
check('first job is running (not done) while the bridge is busy', getTryonJob('u1', j1)?.status === 'running');
check('result not ready while running', getTryonResult('u1', j1) === 'notready');
let conflict: unknown = null;
try { submitTryonJob('u1', P, G, 'tops'); } catch (e) { conflict = e; }
check('second submit by same user -> 409', conflict instanceof TryonError && conflict.status === 409);
const j2 = submitTryonJob('u2', P, G, 'bottoms');
const v2 = getTryonJob('u2', j2);
check('other user queues behind (queued, position 1)', v2?.status === 'queued' && v2.queuePosition === 1, JSON.stringify(v2));
check("someone else's job -> null (route answers 404)", getTryonJob('u2', j1) === null && getTryonResult('u2', j1) === null);
check('unknown job id -> null', getTryonJob('u1', 'nope') === null);
await sleep(80);
check('bridge saw exactly one call while gated (jobs run serially)', tryonCalls - calls0 === 1, `calls=${tryonCalls - calls0}`);
release();
check('job 1 becomes done', await waitFor(() => getTryonJob('u1', j1)?.status === 'done'));
check('done job has no error and a PNG', getTryonJob('u1', j1)?.error === undefined && (getTryonResult('u1', j1) as Buffer).equals(PNG));
check('job 2 then runs and finishes', await waitFor(() => getTryonJob('u2', j2)?.status === 'done'));
check('failure hook not called on success', refunds === 0);
let again: unknown = null;
try { submitTryonJob('u1', P, G, 'tops'); } catch (e) { again = e; }
check('user can submit again once the previous job finished', again === null);
await sleep(100);
resetTryonJobs();

// bridge failure -> failed + onFail once
mode = 'err';
let refunds2 = 0;
const jf = submitTryonJob('u1', P, G, 'tops', () => { refunds2++; });
check('bridge 500 -> job failed with message', await waitFor(() => getTryonJob('u1', jf)?.status === 'failed') && !!getTryonJob('u1', jf)?.error);
check('onFail (quota refund) ran exactly once', refunds2 === 1);
check('failed job has no result', getTryonResult('u1', jf) === 'notready');
mode = 'busy';
const jb = submitTryonJob('u1', P, G, 'tops');
await waitFor(() => getTryonJob('u1', jb)?.status === 'failed');
check('bridge 429 -> failed with the busy message', getTryonJob('u1', jb)?.error?.includes('忙碌') === true);
mode = 'ok';
resetTryonJobs();

// timeout -> failed (the bridge keeps working but the api stops waiting)
hold();
setEnv({ ...base, TRYON_JOB_TIMEOUT_MS: '250' });
const jt = submitTryonJob('u1', P, G, 'tops');
check('slow bridge past TRYON_JOB_TIMEOUT_MS -> failed with the timeout message', await waitFor(() => getTryonJob('u1', jt)?.status === 'failed', 3000) && getTryonJob('u1', jt)?.error?.includes('逾時') === true);
release();
await sleep(50);
setEnv({ ...base });
resetTryonJobs();

// queue cap
hold();
setEnv({ ...base, TRYON_MAX_QUEUED: '1' });
submitTryonJob('a', P, G, 'tops');
submitTryonJob('b', P, G, 'tops');
let full: unknown = null;
try { submitTryonJob('c', P, G, 'tops'); } catch (e) { full = e; }
check('queue full -> 503', full instanceof TryonError && full.status === 503);
release();
await sleep(300);
setEnv({ ...base });
resetTryonJobs();

// TTL
setEnv({ ...base, TRYON_JOB_TTL_MS: '100' });
const jx = submitTryonJob('u1', P, G, 'tops');
await waitFor(() => getTryonJob('u1', jx)?.status === 'done');
check('done job readable before TTL', getTryonJob('u1', jx)?.status === 'done');
sweepTryonJobs(Date.now() + 500);
check('after TTL the job and its PNG are gone', getTryonJob('u1', jx) === null && getTryonResult('u1', jx) === null);
setEnv({ ...base });
resetTryonJobs();

// daily quota (prisma stubbed with an in-memory counter; the real DB path is covered by smoke-tryon.mjs)
const counts = new Map<string, number>();
(prisma.aiUsage as any).upsert = async ({ where }: any) => { const k = JSON.stringify(where); counts.set(k, (counts.get(k) ?? 0) + 1); return { count: counts.get(k) }; };
(prisma.aiUsage as any).update = async ({ where, data }: any) => { const k = JSON.stringify(where); counts.set(k, (counts.get(k) ?? 0) + (data.count.decrement ? -1 : 0)); return {}; };
setEnv({ ...base, TRYON_DAILY_LIMIT: '2' });
const q1 = await reserveTryonQuota('qq'), q2 = await reserveTryonQuota('qq'), q3 = await reserveTryonQuota('qq');
check('daily limit: 1st and 2nd reserve ok, 3rd null', q1 === 1 && q2 === 2 && q3 === null);
await refundTryonQuota('qq');
check('refund frees one slot', (await reserveTryonQuota('qq')) === 2);
setEnv({ ...base });

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
