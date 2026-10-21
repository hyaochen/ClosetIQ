import { View, Pressable, Modal } from 'react-native';
import { useAlertStore } from '@/lib/alert';
import { useColors } from '@/lib/theme';
import { Txt, Serif } from '@/components/ui/Text';

/** 提示 / 確認對話框：直角、1px 墨線、無陰影；取消在左、確認在右 */
export function AlertModal() {
  const { visible, title, message, buttons, hide } = useAlertStore();
  const c = useColors();

  const handlePress = (onPress?: () => void) => {
    hide();
    onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <Pressable
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}
        onPress={hide}
      >
        <Pressable
          accessibilityRole="alert"
          onPress={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 360, backgroundColor: c.paper, borderWidth: 1, borderColor: c.ink }}
        >
          <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 }}>
            <Serif size={19} style={{ textAlign: 'center' }}>{title}</Serif>
            {message ? (
              <Txt size={14} tone="mute" style={{ textAlign: 'center', marginTop: 8 }}>{message}</Txt>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.ink }}>
            {buttons.map((btn, i) => {
              const destructive = btn.style === 'destructive';
              const cancel = btn.style === 'cancel';
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  onPress={() => handlePress(btn.onPress)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeftWidth: i > 0 ? 1 : 0,
                    borderLeftColor: c.ink,
                    backgroundColor: cancel ? (pressed ? c.card : 'transparent') : pressed ? c.mute : c.ink,
                  })}
                >
                  <Txt
                    size={15}
                    style={{
                      fontWeight: '500',
                      letterSpacing: 1.2,
                      color: cancel ? c.mute : destructive ? c.paper : c.onInk,
                    }}
                  >
                    {btn.text}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
