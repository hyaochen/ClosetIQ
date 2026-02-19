import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const register = useAuthStore((s) => s.register);

  const clearError = () => setError('');

  const handleRegister = async () => {
    setError('');
    setSuccess('');

    if (!displayName.trim()) { setError('請輸入顯示名稱'); return; }
    if (!email.trim()) { setError('請輸入帳號'); return; }
    if (!password) { setError('請輸入密碼'); return; }
    if (password !== confirmPassword) { setError('兩次輸入的密碼不一致'); return; }

    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim());
      setSuccess('註冊成功！正在跳轉...');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } catch (err: any) {
      setError(err.message || '註冊失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-8 py-8">
          {/* Header */}
          <View className="mb-10 items-center">
            <Text className="text-4xl font-bold text-primary-700 dark:text-primary-400 mb-2">
              建立帳號
            </Text>
            <Text className="text-base text-gray-500 dark:text-gray-400">
              開始管理你的衣櫃
            </Text>
          </View>

          {/* Error message */}
          {error ? (
            <View className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-600 dark:text-red-400 text-sm text-center">{error}</Text>
            </View>
          ) : null}

          {/* Success message */}
          {success ? (
            <View className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-4">
              <Text className="text-green-600 dark:text-green-400 text-sm text-center">{success}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">顯示名稱</Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                placeholder="你的名字"
                placeholderTextColor="#9ca3af"
                value={displayName}
                onChangeText={(t) => { setDisplayName(t); clearError(); }}
                editable={!loading}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">帳號</Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                placeholder="輸入帳號"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={(t) => { setEmail(t); clearError(); }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密碼</Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                placeholder="設定你的密碼"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={(t) => { setPassword(t); clearError(); }}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">確認密碼</Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                placeholder="再次輸入密碼"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); clearError(); }}
                secureTextEntry
                editable={!loading}
                onSubmitEditing={handleRegister}
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text className="text-xs text-red-500 mt-1">密碼不一致</Text>
              )}
            </View>

            <Pressable
              className={`rounded-xl py-4 items-center mt-4 flex-row justify-center ${
                loading ? 'bg-primary-400' : 'bg-primary-600 active:bg-primary-700'
              }`}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="white" size="small" />
                  <Text className="text-white text-base font-semibold ml-2">
                    註冊中...
                  </Text>
                </>
              ) : (
                <Text className="text-white text-base font-semibold">
                  註冊
                </Text>
              )}
            </Pressable>
          </View>

          {/* Login link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-gray-500 dark:text-gray-400">已有帳號？</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-primary-600 dark:text-primary-400 font-semibold ml-1">登入</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
