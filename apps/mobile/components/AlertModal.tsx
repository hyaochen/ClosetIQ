import { View, Text, Pressable, Modal } from 'react-native';
import { useAlertStore } from '@/lib/alert';
import { useThemeStore } from '@/lib/theme-store';

export function AlertModal() {
  const { visible, title, message, buttons, hide } = useAlertStore();
  const { isDark } = useThemeStore();

  const handlePress = (onPress?: () => void) => {
    hide();
    onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <Pressable
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={hide}
      >
        <Pressable
          className="mx-8 w-[85%] max-w-sm rounded-2xl overflow-hidden"
          style={{ backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="px-6 pt-6 pb-4">
            <Text className="text-lg font-bold text-center text-gray-900 dark:text-gray-50">
              {title}
            </Text>
            {message ? (
              <Text className="text-sm text-center text-gray-600 dark:text-gray-400 mt-2">
                {message}
              </Text>
            ) : null}
          </View>

          <View
            className="flex-row border-t border-gray-200 dark:border-gray-700"
          >
            {buttons.map((btn, i) => (
              <Pressable
                key={i}
                className={`flex-1 py-3.5 items-center active:bg-gray-100 dark:active:bg-gray-700 ${
                  i > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''
                }`}
                onPress={() => handlePress(btn.onPress)}
              >
                <Text
                  className={`text-base font-semibold ${
                    btn.style === 'cancel'
                      ? 'text-gray-500 dark:text-gray-400'
                      : btn.style === 'destructive'
                        ? 'text-red-500'
                        : 'text-primary-600 dark:text-primary-400'
                  }`}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
