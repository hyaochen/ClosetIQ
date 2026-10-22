// ---- T-CL-017 ---- Provider that calls the host claude-bridge (the account holder's Claude subscription)
//
// The bridge (tools/claude-bridge) holds the fixed recognition prompt and runs `claude -p`
// with no tools. This side only sends the already-resized JPEG and gets back the model's text.
import type { AnalyzeProvider, ProviderResult } from './types.js';
import { extractJson } from './claude.provider.js';

export const bridgeUrl = () => (process.env.CLAUDE_BRIDGE_URL || 'http://host.docker.internal:8765').replace(/\/+$/, '');
const authHeader = () => ({ Authorization: `Bearer ${process.env.CLAUDE_BRIDGE_TOKEN || ''}` });

// ---- availability ping, cached 60 s so the add-item screen never waits on a dead bridge ----
const PING_TTL_MS = 60_000;
const PING_TIMEOUT_MS = 1_500;
let bridgeUpCache = { at: 0, up: false };
let inflight: Promise<boolean> | null = null;

export async function pingBridgeCached(now = Date.now()): Promise<boolean> {
  if (now - bridgeUpCache.at < PING_TTL_MS) return bridgeUpCache.up;
  if (!inflight) {
    inflight = (async () => {
      let up = false;
      try {
        const r = await fetch(`${bridgeUrl()}/health`, { headers: authHeader(), signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
        up = r.ok;
      } catch {
        up = false;
      }
      bridgeUpCache = { at: Date.now(), up };
      return up;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** test hook */
export function resetBridgePingCache() {
  bridgeUpCache = { at: 0, up: false };
}

export class SubscriptionBridgeProvider implements AnalyzeProvider {
  readonly name = 'bridge' as const;
  readonly model = 'claude-subscription';

  async analyze(imageJpeg: Buffer): Promise<ProviderResult> {
    let res: Response;
    try {
      res = await fetch(`${bridgeUrl()}/analyze`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageJpeg.toString('base64') }),
        signal: AbortSignal.timeout(100_000), // the bridge itself times out at 90 s
      });
    } catch (err) {
      resetBridgePingCache(); // force a re-ping so status flips to disabled quickly
      throw err;
    }
    if (!res.ok) throw new Error(`bridge HTTP ${res.status}`);
    const body = (await res.json()) as { text?: string; usage?: { inputTokens?: number; outputTokens?: number } };
    return {
      raw: extractJson(String(body.text ?? '')),
      usage: { inputTokens: body.usage?.inputTokens ?? 0, outputTokens: body.usage?.outputTokens ?? 0 },
    };
  }
}
