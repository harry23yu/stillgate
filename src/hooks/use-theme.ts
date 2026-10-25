import { useColorScheme } from 'react-native';

import { Colors, ColorsDark, type Palette } from '@/constants/theme';
import { useSettings } from '@/contexts/settings';

/** Returns the active palette based on the theme preference and the OS scheme. */
export function useTheme(): Palette {
  const { settings } = useSettings();
  const system = useColorScheme();
  const scheme = settings.theme === 'system' ? system ?? 'light' : settings.theme;
  return scheme === 'dark' ? ColorsDark : Colors;
}
