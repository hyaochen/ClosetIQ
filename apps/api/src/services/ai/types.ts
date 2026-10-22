// ---- P2 ---- AI analyze provider contract
import type { ItemSuggestion } from '@closet/shared';

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

/** What a provider returns: untrusted JSON-ish data. sanitizeSuggestion() validates it. */
export interface ProviderResult {
  raw: unknown;
  usage: ProviderUsage;
}

export interface AnalyzeProvider {
  readonly name: 'claude' | 'bridge' | 'mock';
  readonly model: string;
  /** imageJpeg: already resized to a long edge <= 1024 */
  analyze(imageJpeg: Buffer): Promise<ProviderResult>;
}

export type { ItemSuggestion };
