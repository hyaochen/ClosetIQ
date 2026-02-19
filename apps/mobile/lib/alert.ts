import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert that works on both Web and Native.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Cross-platform confirm dialog.
 * Returns true if user confirms, false if cancelled.
 */
export function showConfirm(title: string, message?: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const result = window.confirm(message ? `${title}\n\n${message}` : title);
    return Promise.resolve(result);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '確定', onPress: () => resolve(true) },
    ]);
  });
}
