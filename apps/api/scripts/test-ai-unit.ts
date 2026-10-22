// T-CL-017 unit checks (no DB, no network except a throwaway local fake bridge).
//   npx tsx apps/api/scripts/test-ai-unit.ts
import http from 'node:http';
import { sanitizeSuggestion, getProvider, isUserAllowed, analyzeStatus } from '../src/services/ai/index.js';
import { SubscriptionBridgeProvider, resetBridgePingCache } from '../src/services/ai/bridge.provider.js';
import { extractJson } from '../src/services/ai/claude.provider.js';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failed++;
};

// ---- sanitize: bad / partial output from any provider ----
const s1 = sanitizeSuggestion({
  category: { value: 'top', confidence: 1.4 }, // lower case accepted, confidence clamped
  subcategory: { value: '襯衫' }, // no confidence -> rule 0.5
  colorFamily: 'TEAL', // bare + not in enum -> dropped
  pattern: 'STRIPED', // bare valid -> rule 0.6
  material: { value: '棉', confidence: 'abc' }, // unusable confidence -> rule 0.35
  seasons: { value: ['WINTER', 'MONSOON', 'winter'], confidence: 0.7 }, // invalid dropped, deduped
  occasions: { value: [], confidence: 0.9 }, // empty -> null
  colors: { value: ['#112233', 'red'], confidence: 0.8 },
  nameSuggestion: 12345, // wrong type -> null
});
check('category clamped + uppercased', s1.category?.value === 'TOP' && s1.category.confidence === 1);
check('missing confidence uses rule', s1.subcategory?.confidence === 0.5 && s1.pattern?.confidence === 0.6 && s1.material?.confidence === 0.35);
check('non-enum value dropped', s1.colorFamily === null);
check('array filtered and deduped', JSON.stringify(s1.seasons?.value) === '["WINTER"]');
check('empty list becomes null', s1.occasions === null);
check('only hex colors kept', JSON.stringify(s1.colors?.value) === '["#112233"]');
check('wrong type dropped', s1.nameSuggestion === null);
const s2 = sanitizeSuggestion('totally not an object');
check('garbage input gives all-null suggestion', Object.values(s2).every((v) => v === null));
let threw = false;
try { extractJson('sorry, I cannot do that'); } catch { threw = true; }
check('text without JSON throws (route turns it into 502 + quota refund)', threw);
check('JSON inside code fence is extracted', (extractJson('```json\n{"a":1}\n```') as { a: number }).a === 1);

// ---- provider selection + allowlist ----
const setEnv = (e: Record<string, string | undefined>) => {
  for (const k of ['AI_PROVIDER', 'ANTHROPIC_API_KEY', 'CLAUDE_BRIDGE_TOKEN', 'AI_ALLOWED_USER_IDS', 'CLAUDE_BRIDGE_URL']) delete process.env[k];
  Object.assign(process.env, e);
  for (const k of Object.keys(process.env)) if (process.env[k] === undefined) delete process.env[k];
};
const TOKEN = 'x'.repeat(40);
setEnv({ AI_PROVIDER: 'bridge' });
check('bridge mode without token -> no provider', getProvider() === null);
setEnv({ AI_PROVIDER: 'bridge', CLAUDE_BRIDGE_TOKEN: TOKEN });
check('bridge mode with token -> bridge', getProvider()?.name === 'bridge');
setEnv({ CLAUDE_BRIDGE_TOKEN: TOKEN });
check('auto + token only -> bridge', getProvider()?.name === 'bridge');
setEnv({ CLAUDE_BRIDGE_TOKEN: TOKEN, ANTHROPIC_API_KEY: 'sk-test-key' });
check('auto + api key -> claude wins', getProvider()?.name === 'claude');
setEnv({});
check('auto + nothing -> mock reported disabled', getProvider()?.name === 'mock' && !(await analyzeStatus('u1')).enabled);

const bridge = new SubscriptionBridgeProvider();
setEnv({ AI_ALLOWED_USER_IDS: '' });
check('empty allowlist -> nobody', !isUserAllowed(bridge, 'u1'));
setEnv({ AI_ALLOWED_USER_IDS: ' u1 , u2 ' });
check('allowlist trims and matches', isUserAllowed(bridge, 'u1') && isUserAllowed(bridge, 'u2') && !isUserAllowed(bridge, 'u3'));

// ---- status: pings the bridge, never throws, cached ----
let hits = 0;
let healthy = true;
const fake = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401).end(); return; }
  if (req.url === '/health') { hits++; res.writeHead(healthy ? 200 : 503).end('{}'); return; }
  if (req.url === '/analyze') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ text: 'Here you go: {"category":{"value":"DRESS","confidence":0.9},"pattern":"WRONG"}', usage: { inputTokens: 5, outputTokens: 7 } }));
    return;
  }
  res.writeHead(404).end();
});
await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()));
const port = (fake.address() as { port: number }).port;
setEnv({ AI_PROVIDER: 'bridge', CLAUDE_BRIDGE_TOKEN: TOKEN, AI_ALLOWED_USER_IDS: 'u1', CLAUDE_BRIDGE_URL: `http://127.0.0.1:${port}` });
resetBridgePingCache();
check('status enabled when bridge up + user allowed', (await analyzeStatus('u1')).enabled === true);
await analyzeStatus('u1');
check('ping result cached (1 health hit)', hits === 1, `hits=${hits}`);
check('status disabled for user not in allowlist', (await analyzeStatus('u9')).enabled === false);
const r = await bridge.analyze(Buffer.from('jpegbytes'));
const sug = sanitizeSuggestion(r.raw);
check('bridge analyze -> filtered suggestion (text around JSON tolerated, bad pattern dropped)', sug.category?.value === 'DRESS' && sug.pattern === null && r.usage.outputTokens === 7);

healthy = false;
resetBridgePingCache();
check('bridge answering 503 -> status disabled', (await analyzeStatus('u1')).enabled === false);
fake.close();
resetBridgePingCache();
const t0 = Date.now();
check('bridge down -> status disabled quickly', (await analyzeStatus('u1')).enabled === false && Date.now() - t0 < 3000, `${Date.now() - t0}ms`);
let netErr = false;
try { await bridge.analyze(Buffer.from('x')); } catch { netErr = true; }
check('bridge down -> analyze throws (route returns 502 and refunds)', netErr);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
