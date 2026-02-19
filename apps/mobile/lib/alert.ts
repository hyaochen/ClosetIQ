import { create } from 'zustand';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertState = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
  hide: () => void;
};

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: undefined,
  buttons: [],
  show: (title, message, buttons) =>
    set({ visible: true, title, message, buttons: buttons || [{ text: '確定' }] }),
  hide: () => set({ visible: false, title: '', message: undefined, buttons: [] }),
}));

/**
 * Cross-platform alert that works on both Web and Native (including mobile browsers).
 */
export function showAlert(title: string, message?: string) {
  useAlertStore.getState().show(title, message, [{ text: '確定' }]);
}

/**
 * Cross-platform confirm dialog.
 * Returns true if user confirms, false if cancelled.
 */
export function showConfirm(title: string, message?: string): Promise<boolean> {
  return new Promise((resolve) => {
    useAlertStore.getState().show(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '確定', style: 'default', onPress: () => resolve(true) },
    ]);
  });
}
