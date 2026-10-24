import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

type PillVariant = 'success' | 'estimate' | 'neutral';

type PillProps = {
  children: string;
  variant?: PillVariant;
};

const variantStyles: Record<PillVariant, { background: string; text: string }> = {
  success: { background: Colors.primaryLight, text: Colors.primary },
  estimate: { background: Colors.estimateFill, text: Colors.estimateText },
  neutral: { background: Colors.neutralFillAlt, text: Colors.textSecondary },
};

export function Pill({ children, variant = 'neutral' }: PillProps) {
  const colors = variantStyles[variant];

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
