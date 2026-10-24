import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint?: string;
};

export function Chip({ label, selected, onPress, accessibilityHint }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={4}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}>
      <ThemedText type="smallBold" themeColor={selected ? 'primary' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
});
