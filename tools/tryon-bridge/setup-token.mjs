// Creates a high-entropy shared secret and stores it in two gitignored places:
//   tools/tryon-bridge/bridge.config.json   (read by server.py)
//   <repo>/.env.ai                           (read by docker compose env_file for the api container)
// The secret is never printed. Re-running keeps the existing secret unless --rotate is given.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = path.join(here, 'bridge.config.json');
const envPath = path.join(here, '..', '..', '.env.ai');
const rotate = process.argv.includes('--rotate');

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { /* new */ }
if (!cfg.token || rotate) cfg.token = crypto.randomBytes(32).toString('hex');
cfg.port = cfg.port || 8766;
cfg.host = '127.0.0.1';
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });

let env = '';
try { env = fs.readFileSync(envPath, 'utf8'); } catch { /* new */ }
const lines = env.split(/\r?\n/).filter((l) => l && !l.startsWith('TRYON_BRIDGE_TOKEN='));
lines.push(`TRYON_BRIDGE_TOKEN=${cfg.token}`);
fs.writeFileSync(envPath, lines.join('\n') + '\n', { mode: 0o600 });
console.log('token written to bridge.config.json and .env.ai (value not shown)');
