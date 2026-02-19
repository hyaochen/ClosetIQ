import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('請輸入帳號和密碼');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || '登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-950"
    >
      <View className="flex-1 justify-center px-8">
        {/* Header */}
        <View className="mb-12 items-center">
          <Text className="text-4xl font-bold text-primary-700 dark:text-primary-400 mb-2">
            電子衣櫃
          </Text>
          <Text className="text-base text-gray-500 dark:text-gray-400">
            智慧管理你的衣物
          </Text>
        </View>

        {/* Error message */}
        {error ? (
          <View className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-600 dark:text-red-400 text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">帳號</Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50"
              placeholder="輸入帳號"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密碼</Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50"
              placeholder="請輸入密碼"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
              editable={!loading}
              onSubmitEditing={handleLogin}
            />
          </View>

          <Pressable
            className={`rounded-xl py-4 items-center mt-4 flex-row justify-center ${
              loading ? 'bg-primary-400' : 'bg-primary-600 active:bg-primary-700'
            }`}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white text-base font-semibold ml-2">
                  登入中...
                </Text>
              </>
            ) : (
              <Text className="text-white text-base font-semibold">
                登入
              </Text>
            )}
          </Pressable>
        </View>

        {/* Register link */}
        <View className="flex-row justify-center mt-8">
          <Text className="text-gray-500 dark:text-gray-400">還沒有帳號？</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text className="text-primary-600 dark:text-primary-400 font-semibold ml-1">註冊</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
