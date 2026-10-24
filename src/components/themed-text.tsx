import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'eyebrow' | 'small' | 'smallBold';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    lineHeight: 28,
  },
  eyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  small: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    lineHeight: 20,
  },
});
