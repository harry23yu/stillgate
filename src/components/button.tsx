import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', accessibilityHint, disabled = false, style }: ButtonProps) {
  const styles = useThemedStyles((c) => ({
    base: {
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
    },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.55 },
    primaryLabel: { color: c.surface },
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: c.primaryLight },
    ghost: { backgroundColor: 'transparent' },
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <ThemedText
        type="smallBold"
        themeColor={variant === 'primary' ? undefined : 'primary'}
        style={variant === 'primary' && styles.primaryLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
