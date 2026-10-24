import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSettings } from '@/contexts/settings';
import { useTheme } from '@/hooks/use-theme';

const TEXT_SIZES = [
  { label: 'A', value: 1, a11y: 'Default text size' },
  { label: 'A+', value: 1.15, a11y: 'Large text size' },
  { label: 'A++', value: 1.3, a11y: 'Larger text size' },
];

const THEMES = [
  { label: 'System', value: 'system' as const, a11y: 'Match system theme' },
  { label: 'Light', value: 'light' as const, a11y: 'Light theme' },
  { label: 'Dark', value: 'dark' as const, a11y: 'Dark theme' },
];

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            hitSlop={12}
            style={styles.close}>
            <ThemedText type="smallBold" themeColor="primary">Done</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <ThemedText type="subtitle">Theme</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Choose a light or low-light look.</ThemedText>
            <View style={styles.chipRow}>
              {THEMES.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  accessibilityLabel={option.a11y}
                  selected={settings.theme === option.value}
                  onPress={() => updateSettings({ theme: option.value })}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="subtitle">Text size</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Make text larger across the app.</ThemedText>
            <View style={styles.chipRow}>
              {TEXT_SIZES.map((size) => (
                <Chip
                  key={size.label}
                  label={size.label}
                  accessibilityLabel={size.a11y}
                  selected={settings.textScale === size.value}
                  onPress={() => updateSettings({ textScale: size.value })}
                />
              ))}
            </View>
            <ThemedText type="small">Preview: a calmer way through the airport.</ThemedText>
          </View>

          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCopy}>
                <ThemedText type="subtitle">Reduce motion</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Minimize animations and movement.</ThemedText>
              </View>
              <Switch
                value={settings.reducedMotion}
                onValueChange={(reducedMotion) => updateSettings({ reducedMotion })}
                accessibilityLabel="Reduce motion"
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  content: { gap: Spacing.four, paddingBottom: Spacing.six },
  section: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowCopy: { flex: 1, gap: 2, paddingRight: Spacing.three },
});
