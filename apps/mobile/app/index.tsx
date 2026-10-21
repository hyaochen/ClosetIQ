import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { useColors } from '@/lib/theme';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const c = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper }}>
        <ActivityIndicator size="large" color={c.ink} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
