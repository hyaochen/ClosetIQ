// ---- P2 ---- Fixed-value provider used when no ANTHROPIC_API_KEY is configured
import type { AnalyzeProvider, ProviderResult } from './types.js';

export class MockProvider implements AnalyzeProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-fixed-v1';

  async analyze(_imageJpeg: Buffer): Promise<ProviderResult> {
    return {
      raw: {
        category: { value: 'TOP', confidence: 0.9 },
        subcategory: { value: '襯衫', confidence: 0.8 },
        colorFamily: { value: 'WHITE', confidence: 0.85 },
        colors: { value: ['#F5F5F0'], confidence: 0.8 },
        pattern: { value: 'SOLID', confidence: 0.9 },
        material: { value: '棉', confidence: 0.35 },
        seasons: { value: ['SPRING', 'AUTUMN'], confidence: 0.6 },
        occasions: { value: ['CASUAL', 'WORK'], confidence: 0.6 },
        nameSuggestion: { value: '白色襯衫（測試資料）', confidence: 0.7 },
      },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
