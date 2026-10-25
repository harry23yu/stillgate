import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type PillVariant = 'success' | 'estimate' | 'neutral';

type PillProps = {
  children: string;
  variant?: PillVariant;
};

export function Pill({ children, variant = 'neutral' }: PillProps) {
  const theme = useTheme();
  const variantColors: Record<PillVariant, { background: string; text: string }> = {
    success: { background: theme.primaryLight, text: theme.primary },
    estimate: { background: theme.estimateFill, text: theme.estimateText },
    neutral: { background: theme.neutralFillAlt, text: theme.textSecondary },
  };
  const colors = variantColors[variant];

  return (
    <ThemedView style={[styles.pill, { backgroundColor: colors.background }]}>
      <ThemedText type="smallBold" style={{ color: colors.text }}>
        {children}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
