import { Redirect } from 'expo-router';

// 穿著紀錄已改為「日記」分頁；保留舊路徑避免書籤與連結失效
export default function WearHistoryRedirect() {
  return <Redirect href="/(tabs)/journal" />;
}
