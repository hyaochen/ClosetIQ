import { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { invalidateWishlist, uploadWishlistImage } from '@/lib/wishlist';
import { Txt, Serif, Button } from '@/components/ui';
import { WishlistFields, useWishlistForm } from '@/components/wishlist/WishlistForm';

export default function AddWishlistScreen() {
  const c = useColors();
  const form = useWishlistForm();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const err = form.validate();
    if (err) return showAlert('提示', err);
    setLoading(true);
    try {
      const { item } = await api('/api/wishlist', { method: 'POST', body: JSON.stringify(form.createPayload()) });
      if (form.image) {
        try {
          await uploadWishlistImage(item.id, form.image);
        } catch (e: any) {
          showAlert('圖片上傳失敗', `項目已建立，可到編輯頁再補照片。${e.message ? '\n' + e.message : ''}`);
        }
      }
      invalidateWishlist();
      // 直接看購前分析
      router.replace(`/wishlist/${item.id}`);
    } catch (e: any) {
      showAlert('新增失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <View style={{ height: 54, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/wardrobe'))}
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Txt size={14}>取消</Txt>
          </Pressable>
          <Serif size={17} accessibilityRole="header">新增願望清單</Serif>
          <View style={{ width: 52 }} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
          <WishlistFields form={form} />
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
          <Button label="加入願望清單" onPress={submit} loading={loading} />
        </View>
      </View>
    </View>
  );
}
