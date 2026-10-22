// ---- P2 ---- Claude vision provider (JSON output + Zod validation downstream)
//
// claude-sonnet-5-5 rejects tool_choice type "tool" / "any" (HTTP 400, verified in the checkin
// project 2026-10-03), so structured output is done with a strict prompt + sanitizeSuggestion().
import Anthropic from '@anthropic-ai/sdk';
import type { AnalyzeProvider, ProviderResult } from './types.js';

export const CLAUDE_MODEL = () => process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

// Official Sonnet 5.5 price, USD per 1M tokens (platform.claude.com pricing). Update with the model.
export const CLAUDE_PRICING = { inputUsdPerMTok: 2, outputUsdPerMTok: 10 } as const;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * CLAUDE_PRICING.inputUsdPerMTok) / 1_000_000 +
    (outputTokens * CLAUDE_PRICING.outputUsdPerMTok) / 1_000_000
  );
}

const SYSTEM_PROMPT = `你是衣櫃管理 App 的服飾辨識助手。使用者會給你一張單件衣物的照片（平拍或穿著皆可），請辨識並只輸出一個 JSON 物件，不要任何其他文字、不要 markdown 程式碼框。

欄位（每個欄位都是 {"value": ..., "confidence": 0 到 1 的小數}；看不出來就把整個欄位設為 null，不要亂猜）：
- category: 只能是 TOP, BOTTOM, OUTERWEAR, DRESS, SHOES, ACCESSORY, UNDERWEAR, BAG 其中之一
- subcategory: 繁體中文細分類，最多 10 字，例如「襯衫」「T 恤」「牛仔褲」「針織外套」
- colorFamily: 只能是 RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE, PINK, BLACK, WHITE, GREY, BROWN, BEIGE, MULTI 其中之一
- colors: 主要顏色的 hex 字串陣列，1 到 3 個，格式 "#RRGGBB"，依面積由大到小
- pattern: 只能是 SOLID, STRIPED, PLAID, FLORAL, POLKA_DOT, GRAPHIC, OTHER 其中之一
- material: 繁體中文材質，例如「棉」「牛仔」「針織」「羊毛」「聚酯纖維」；照片看不出材質時信心值要低（0.4 以下）
- seasons: SPRING, SUMMER, AUTUMN, WINTER 的陣列（適穿季節）
- occasions: CASUAL, WORK, FORMAL, SPORT, LOUNGE 的陣列（適合場合）
- nameSuggestion: 繁體中文名稱，最多 20 字，格式像「白色寬版襯衫」

信心值是你對該欄位的把握：看得很清楚 0.9 以上，需要推測 0.5 左右，幾乎在猜 0.3 以下。`;

export class ClaudeVisionProvider implements AnalyzeProvider {
  readonly name = 'claude' as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.model = CLAUDE_MODEL();
    this.client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  }

  async analyze(imageJpeg: Buffer): Promise<ProviderResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageJpeg.toString('base64') },
            },
            { type: 'text', text: '請辨識這件衣物，只輸出 JSON。' },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return {
      raw: extractJson(text),
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}

/** Model might wrap the JSON in a code fence or add a sentence; take the outermost {...}. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型回應中找不到 JSON');
  return JSON.parse(text.slice(start, end + 1));
}
