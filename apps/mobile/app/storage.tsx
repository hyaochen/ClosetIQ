import { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { useStorageLocations, invalidateWardrobe, type StorageLocation } from '@/lib/queries';
import { showAlert, showConfirm } from '@/lib/alert';
import { Screen, TopBar, Txt, Serif, Numeral, Button, Hairline, TextField, Chip, SectionHeader } from '@/components/ui';

export default function StorageScreen() {
  const c = useColors();
  const { data, isLoading } = useStorageLocations();
  const [name, setName] = useState('');
  const [offSeason, setOffSeason] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const locations = data?.locations ?? [];

  const run = async (fn: () => Promise<any>, failTitle: string) => {
    try {
      await fn();
      invalidateWardrobe();
    } catch (err: any) {
      showAlert(failTitle, err.message);
    }
  };

  const add = async () => {
    if (!name.trim()) {
      showAlert('提示', '請輸入位置名稱');
      return;
    }
    setAdding(true);
    await run(async () => {
      await api('/api/storage-locations', { method: 'POST', body: JSON.stringify({ name: name.trim(), isOffSeason: offSeason }) });
      setName('');
      setOffSeason(false);
    }, '新增失敗');
    setAdding(false);
  };

  const saveRename = async (l: StorageLocation) => {
    if (!editName.trim()) return;
    await run(() => api(`/api/storage-locations/${l.id}`, { method: 'PUT', body: JSON.stringify({ name: editName.trim() }) }), '改名失敗');
    setEditingId(null);
  };

  const toggleOff = (l: StorageLocation) =>
    run(() => api(`/api/storage-locations/${l.id}`, { method: 'PUT', body: JSON.stringify({ isOffSeason: !l.isOffSeason }) }), '更新失敗');

  const remove = async (l: StorageLocation) => {
    const ok = await showConfirm('刪除收納位置', l.itemCount > 0 ? `「${l.name}」裡的 ${l.itemCount} 件衣物不會被刪除，只會變成未指定位置。` : `確定刪除「${l.name}」嗎？`);
    if (ok) run(() => api(`/api/storage-locations/${l.id}`, { method: 'DELETE' }), '刪除失敗');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="STORAGE" title="收納位置" />
      <Screen>
        <Serif size={26} accessibilityRole="header">管理收納位置</Serif>
        <Txt size={13} tone="mute" style={{ marginTop: 4 }}>衣櫃、收納箱、老家…標成「換季收納處」後，換季整理會把季外衣物移到那裡。</Txt>

        {/* 新增 */}
        <SectionHeader title="新增位置" style={{ marginTop: 20 }} />
        <View style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="例：床下收納箱"
            accessibilityLabel="位置名稱"
            maxLength={30}
            onSubmitEditing={add}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
          <Chip label="換季收納處" selected={offSeason} onPress={() => setOffSeason((v) => !v)} icon={offSeason ? 'checkmark' : undefined} />
          <Button label="新增" icon="add" height={44} onPress={add} loading={adding} />
        </View>

        {/* 清單 */}
        <SectionHeader title={`全部位置 ${locations.length}`} style={{ marginTop: 24 }} />
        {isLoading ? (
          <ActivityIndicator color={c.ink} style={{ marginTop: 24 }} />
        ) : locations.length === 0 ? (
          <Txt tone="mute" style={{ paddingVertical: 16 }}>還沒有收納位置，從上面新增第一個。</Txt>
        ) : (
          locations.map((l) => {
            const editing = editingId === l.id;
            return (
              <View key={l.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {editing ? (
                    <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: c.ink }}>
                      <TextField value={editName} onChangeText={setEditName} autoFocus maxLength={30} accessibilityLabel="新的位置名稱" onSubmitEditing={() => saveRename(l)} />
                    </View>
                  ) : (
                    <View style={{ flex: 1 }}>
                      <Serif size={16} medium numberOfLines={1}>{l.name}</Serif>
                      <Txt size={12} tone="mute">{`${l.itemCount} 件${l.isOffSeason ? ' · 換季收納處' : ''}`}</Txt>
                    </View>
                  )}
                  <Numeral size={22} tone="mute">{String(l.itemCount)}</Numeral>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {editing ? (
                    <>
                      <Chip label="儲存" selected onPress={() => saveRename(l)} />
                      <Chip label="取消" onPress={() => setEditingId(null)} />
                    </>
                  ) : (
                    <>
                      <Chip label="改名" icon="create-outline" onPress={() => { setEditingId(l.id); setEditName(l.name); }} />
                      <Chip label={l.isOffSeason ? '換季收納處（開）' : '設為換季收納處'} selected={l.isOffSeason} onPress={() => toggleOff(l)} />
                      <Chip label="刪除" icon="trash-outline" onPress={() => remove(l)} />
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
        {(data?.unassignedCount ?? 0) > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
            <Txt size={13} tone="mute">未指定位置</Txt>
            <Txt size={13}>{`${data?.unassignedCount} 件`}</Txt>
          </View>
        ) : null}
        <Hairline />
      </Screen>
    </View>
  );
}
