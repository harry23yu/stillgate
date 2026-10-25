import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconSymbol } from '@/components/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { defaultProfile, getProfile, saveProfile } from '@/data/profile';
import type { Profile } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

type SensitivityLevel = NonNullable<Profile['noise']>;

const SENSITIVITY_OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'low', label: "Doesn't bother me" },
  { value: 'medium', label: 'Somewhat bothers me' },
  { value: 'high', label: 'Really bothers me' },
];

const HELP_OPTIONS = ['Headphones', 'Extra time', 'Quiet room', 'Written steps'];

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const theme = useTheme();

  useEffect(() => {
    getProfile().then((saved) => {
      setProfile(saved);
      setLoading(false);
    });
  }, []);

  function toggleHelp(help: string) {
    setProfile((current) => ({
      ...current,
      whatHelps: current.whatHelps.includes(help)
        ? current.whatHelps.filter((item) => item !== help)
        : [...current.whatHelps, help],
    }));
  }

  async function handleSave() {
    await saveProfile({ ...profile, detailLevel: profile.firstFlight ? 'detailed' : 'brief' });
    router.replace('/');
  }

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">Your sensory profile</ThemedText>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close sensory profile"
            hitSlop={12}
            style={styles.skipButton}>
            <IconSymbol name="xmark" size={20} color={theme.primary} />
          </Pressable>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.intro}>
          This stays on your device and helps Stillgate pick calmer routes and quieter spots for you.
        </ThemedText>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SensitivityQuestion
            label="Noise"
            value={profile.noise}
            onChange={(noise) => setProfile((current) => ({ ...current, noise }))}
          />
          <SensitivityQuestion
            label="Crowds"
            value={profile.crowds}
            onChange={(crowds) => setProfile((current) => ({ ...current, crowds }))}
          />
          <SensitivityQuestion
            label="Bright or flickering lights"
            value={profile.lighting}
            onChange={(lighting) => setProfile((current) => ({ ...current, lighting }))}
          />

          <View style={styles.section}>
            <ThemedText type="subtitle">What helps?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Choose as many as you like.
            </ThemedText>
            <View style={styles.chipRow}>
              {HELP_OPTIONS.map((help) => (
                <Chip
                  key={help}
                  label={help}
                  selected={profile.whatHelps.includes(help)}
                  onPress={() => toggleHelp(help)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="subtitle">Is this your first flight?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              We will show more detailed, step-by-step guidance.
            </ThemedText>
            <View style={styles.chipRow}>
              <Chip
                label="Yes"
                selected={profile.firstFlight}
                onPress={() => setProfile((current) => ({ ...current, firstFlight: true }))}
              />
              <Chip
                label="No"
                selected={!profile.firstFlight}
                onPress={() => setProfile((current) => ({ ...current, firstFlight: false }))}
              />
            </View>
          </View>

          <Button label="Save" onPress={handleSave} style={styles.saveButton} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SensitivityQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Profile['noise'];
  onChange: (value: SensitivityLevel) => void;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{label}</ThemedText>
      <View style={styles.chipRow}>
        {SENSITIVITY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  skipButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  intro: {
    marginTop: Spacing.one,
    maxWidth: 420,
  },
  content: {
    gap: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  section: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  saveButton: {
    marginTop: Spacing.two,
  },
});
