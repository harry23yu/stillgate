import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stillgate.settings';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  /** Phase 2 acts on this; Phase 1 leaves it at 'system'. */
  theme: ThemePreference;
  /** Font-size multiplier: 1 (default) | 1.15 | 1.3. */
  textScale: number;
  reducedMotion: boolean;
}

export const defaultAppSettings: AppSettings = {
  theme: 'system',
  textScale: 1,
  reducedMotion: false,
};

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultAppSettings;
  try {
    return { ...defaultAppSettings, ...JSON.parse(raw) };
  } catch {
    return defaultAppSettings;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
