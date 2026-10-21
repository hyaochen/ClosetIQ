export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export function imageUrl(path: string): string {
  return `${API_BASE}/api/images/file/${path}`;
}
