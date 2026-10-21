import { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { useColors } from '@/lib/theme';
import { Txt, Serif, Numeral, Eyebrow, Button, TextField, Hairline } from '@/components/ui';

export default function LoginScreen() {
  const c = useColors();
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 40 }}>
          <Eyebrow>CLOSETIQ</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <Serif size={40} letterSpacing={1.6} style={{ lineHeight: 46 }} accessibilityRole="header">電子衣櫃</Serif>
            <Numeral size={20} tone="mute">Editorial</Numeral>
          </View>
          <Txt tone="mute" style={{ marginTop: 6 }}>智慧管理你的衣物</Txt>
          <Hairline tone="ink" style={{ marginTop: 18, marginBottom: 8 }} />

          {error ? (
            <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: c.accent, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 }}>
              <Txt size={13} tone="accent">{error}</Txt>
            </View>
          ) : null}

          <View style={{ marginTop: 10 }}>
            <Txt size={12} tone="mute" letterSpacing={1.2}>帳號</Txt>
            <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>
              <TextField
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                placeholder="輸入帳號"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                accessibilityLabel="帳號"
              />
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <Txt size={12} tone="mute" letterSpacing={1.2}>密碼</Txt>
            <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>
              <TextField
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder="請輸入密碼"
                secureTextEntry
                editable={!loading}
                onSubmitEditing={handleLogin}
                accessibilityLabel="密碼"
              />
            </View>
          </View>

          <Button label="登入" onPress={handleLogin} loading={loading} style={{ marginTop: 26 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 6 }}>
            <Txt tone="mute">還沒有帳號？</Txt>
            <Link href="/(auth)/register" asChild>
              <Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Txt bold style={{ textDecorationLine: 'underline' }}>註冊</Txt>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
