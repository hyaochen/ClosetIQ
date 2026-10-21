import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** AI 建議的信心低於此值，該欄用虛線框標「待確認」（集中在這一個常數） */
export const AI_LOW_CONFIDENCE = 0.6;

export type AnalyzeStatus = { enabled: boolean; provider: string };

/** 前端只看這個狀態決定要不要顯示 AI 區塊，不寫死任何 provider。 */
export function useAnalyzeStatus() {
  return useQuery<AnalyzeStatus>({
    queryKey: ['analyze-status'],
    queryFn: () => api('/api/items/analyze/status'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

type Field<T> = { value: T; confidence: number } | null;
export type Suggestion = {
  category: Field<string>;
  subcategory: Field<string>;
  colorFamily: Field<string>;
  colors: Field<string[]>;
  pattern: Field<string>;
  material: Field<string>;
  seasons: Field<string[]>;
  occasions: Field<string[]>;
  nameSuggestion: Field<string>;
};

export async function analyzeImage(imageId: string): Promise<Suggestion> {
  const res = await api('/api/items/analyze', { method: 'POST', body: JSON.stringify({ imageId }) });
  return res.suggestion as Suggestion;
}

/** 測試用提供者可能在文字裡帶「（測試資料）」，不讓它進到使用者看得見的欄位。 */
export const cleanSuggestedText = (s: string) => s.replace(/[（(]\s*測試資料\s*[）)]/g, '').trim();
