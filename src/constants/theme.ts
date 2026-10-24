import '@/global.css';

import { Platform } from 'react-native';

/**
 * Stillgate uses one fixed, high-contrast palette (not light/dark variants).
 * Values match CLAUDE.md §4 design tokens.
 */
export const Colors = {
  background: '#F6F3EC',
  surface: '#FFFFFF',
  text: '#1F2A2E',
  textSecondary: '#3B4A4E',
  primary: '#2F6B5F',
  primaryLight: '#DCE9E3',
  border: '#7D7765',
  neutralFill: '#D8D0BD',
  neutralFillAlt: '#EAE4D6',
  estimateFill: '#F2D3B3',
  estimateText: '#6B3205',
  estimateBorder: '#B4540A',
  youMarker: '#1D4FA8',
} as const;

export type ThemeColor = keyof typeof Colors;

export const Fonts = Platform.select({
  default: {
    sans: 'AtkinsonHyperlegible-Regular',
    sansBold: 'AtkinsonHyperlegible-Bold',
    mono: Platform.select({ ios: 'ui-monospace', android: 'monospace' }) ?? 'monospace',
  },
  web: {
    sans: 'Atkinson Hyperlegible, system-ui, sans-serif',
    sansBold: 'Atkinson Hyperlegible, system-ui, sans-serif',
    mono: 'ui-monospace, monospace',
  },
})!;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
