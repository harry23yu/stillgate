import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  accessibilityHint?: string;
};

export function TextField({ label, value, onChangeText, placeholder, autoCapitalize, accessibilityHint }: TextFieldProps) {
  const theme = useTheme();
  const styles = useThemedStyles((c) => ({
    container: { gap: Spacing.one },
    input: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: Spacing.three,
      fontFamily: Fonts.sans,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.surface,
    },
  }));

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        style={styles.input}
      />
    </View>
  );
}
