import { Redirect } from 'expo-router';

// 舊的「我的」路徑 /profile 已改為 /(tabs)/me
export default function ProfileRedirect() {
  return <Redirect href="/(tabs)/me" />;
}
