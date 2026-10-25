import { Alert, Platform } from 'react-native';

/**
 * One-button message that also works on web, where React Native's
 * Alert.alert is a no-op (the review screen is often used in a browser).
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Cancel / confirm question that also works on web (window.confirm there).
 * `onConfirm` runs only if the person chooses `confirmLabel`.
 */
export function confirmAction({
  title,
  message,
  cancelLabel,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
