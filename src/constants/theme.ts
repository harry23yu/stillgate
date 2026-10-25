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

/**
 * Low-light palette, same keys as Colors. Candidate values — verify ≥ 4.5:1
 * body-text contrast on device and tune. See
 * docs/superpowers/specs/2026-10-24-settings-design.md §7.1.
 */
export const ColorsDark = {
  background: '#14191B',
  surface: '#1E2528',
  text: '#F2EFE8',
  textSecondary: '#C3CCCE',
  primary: '#6FB8A8',
  primaryLight: '#24413B',
  border: '#8A8475',
  neutralFill: '#2A3134',
  neutralFillAlt: '#232A2D',
  estimateFill: '#4A2E14',
  estimateText: '#F2C79A',
  estimateBorder: '#E08A3C',
  youMarker: '#7FA8E8',
} as const;

export type ThemeColor = keyof typeof Colors;

/** The shape shared by both palettes: the same keys, with string values. */
export type Palette = { readonly [K in ThemeColor]: string };

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
