import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import type { Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Builds a StyleSheet from the active palette and rebuilds it when the palette
 * changes. The factory must depend only on the palette (not on props/state).
 */
export function useThemedStyles<T extends NamedStyles<T>>(factory: (c: Palette) => T): T {
  const theme = useTheme();
  // `factory` is intentionally omitted: it must be a pure palette -> styles
  // function, so the styles only need to rebuild when the palette changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
}
