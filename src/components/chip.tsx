import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  accessibilityLabel?: string;
};

export function Chip({ label, selected, onPress, accessibilityHint, accessibilityLabel }: ChipProps) {
  const styles = useThemedStyles((c) => ({
    chip: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: { backgroundColor: c.primaryLight, borderColor: c.primary },
    chipUnselected: { backgroundColor: 'transparent', borderColor: c.border },
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      hitSlop={4}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}>
      <ThemedText type="smallBold" themeColor={selected ? 'primary' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
