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
