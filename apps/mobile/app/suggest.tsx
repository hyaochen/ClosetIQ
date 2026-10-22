import { Redirect } from 'expo-router';

// 「推薦」分頁已併入「今日」；保留舊路徑避免書籤與連結失效
export default function SuggestRedirect() {
  return <Redirect href="/(tabs)" />;
}
