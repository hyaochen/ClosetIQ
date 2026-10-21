import { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { useColors } from '@/lib/theme';
import { Txt, Serif, Eyebrow, Button, TextField, Hairline } from '@/components/ui';

export default function RegisterScreen() {
  const c = useColors();
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
      setSuccess('註冊成功，正在跳轉...');
      setTimeout(() => router.replace('/(tabs)'), 500);
    } catch (err: any) {
      setError(err.message || '註冊失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <View style={{ marginTop: 14 }}>
      <Txt size={12} tone="mute" letterSpacing={1.2}>{label}</Txt>
      <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>{node}</View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 40 }}>
          <Eyebrow>CREATE ACCOUNT</Eyebrow>
          <Serif size={36} letterSpacing={1.4} style={{ marginTop: 4, lineHeight: 42 }} accessibilityRole="header">建立帳號</Serif>
          <Txt tone="mute" style={{ marginTop: 6 }}>開始管理你的衣櫃</Txt>
          <Hairline tone="ink" style={{ marginTop: 18 }} />

          {error ? (
            <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: c.accent, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 }}>
              <Txt size={13} tone="accent">{error}</Txt>
            </View>
          ) : null}
          {success ? (
            <View accessibilityLiveRegion="polite" style={{ borderWidth: 1, borderColor: c.olive, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 }}>
              <Txt size={13}>{success}</Txt>
            </View>
          ) : null}

          {field('顯示名稱', <TextField value={displayName} onChangeText={(t) => { setDisplayName(t); clearError(); }} placeholder="你的名字" editable={!loading} accessibilityLabel="顯示名稱" />)}
          {field('帳號', <TextField value={email} onChangeText={(t) => { setEmail(t); clearError(); }} placeholder="輸入帳號" autoCapitalize="none" autoCorrect={false} editable={!loading} accessibilityLabel="帳號" />)}
          {field('密碼', <TextField value={password} onChangeText={(t) => { setPassword(t); clearError(); }} placeholder="設定你的密碼" secureTextEntry editable={!loading} accessibilityLabel="密碼" />)}
          {field('確認密碼', <TextField value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); clearError(); }} placeholder="再次輸入密碼" secureTextEntry editable={!loading} onSubmitEditing={handleRegister} accessibilityLabel="確認密碼" />)}
          {confirmPassword && password !== confirmPassword ? <Txt size={12} tone="accent" style={{ marginTop: 4 }}>密碼不一致</Txt> : null}

          <Button label="註冊" onPress={handleRegister} loading={loading} style={{ marginTop: 26 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 6 }}>
            <Txt tone="mute">已有帳號？</Txt>
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Txt bold style={{ textDecorationLine: 'underline' }}>登入</Txt>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
