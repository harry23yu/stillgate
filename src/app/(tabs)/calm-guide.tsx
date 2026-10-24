import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getAirport } from '@/data/client';
import type { Airport } from '@/data/types';
import { STEP_PHASE_LABEL } from '@/lib/format';

const NEED_A_MINUTE_PHRASE =
  "I'm overwhelmed right now and need a quiet moment. Could you help me find a calm place nearby?";

export default function CalmGuideScreen() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const listeningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAirport('SFO').then(setAirport);
  }, []);

  useEffect(() => {
    return () => {
      if (listeningTimeout.current) clearTimeout(listeningTimeout.current);
    };
  }, []);

  if (!airport) {
    return <ThemedView style={styles.container} />;
  }

  const steps = airport.steps;
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function handleListen() {
    if (listeningTimeout.current) clearTimeout(listeningTimeout.current);
    setListening(true);
    listeningTimeout.current = setTimeout(() => setListening(false), 1800);
  }

  function handleBack() {
    setListening(false);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  function handleNext() {
    setListening(false);
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Calm Guide
            </ThemedText>
            <Pill>{`Step ${stepIndex + 1} of ${steps.length}`}</Pill>
          </View>

          <ThemedText type="title">{STEP_PHASE_LABEL[step.phase]}</ThemedText>

          <Card>
            <ThemedText type="subtitle">{step.text}</ThemedText>
          </Card>

          <Pressable
            onPress={handleListen}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Playing this step' : 'Listen to this step'}
            style={({ pressed }) => [styles.listenButton, pressed && styles.listenButtonPressed]}>
            <IconSymbol
              name={listening ? 'waveform' : 'play.fill'}
              size={32}
              color={Colors.surface}
            />
            <ThemedText type="subtitle" style={styles.listenLabel}>
              {listening ? 'Playing…' : 'Listen'}
            </ThemedText>
          </Pressable>
          {!step.audioUrl && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.listenNote}>
              Spoken audio for this step is coming soon — this button is a placeholder for now.
            </ThemedText>
          )}

          <View style={styles.navRow}>
            <Button
              label="Back"
              variant="secondary"
              onPress={handleBack}
              style={[styles.navButton, isFirst && styles.navButtonDisabled]}
            />
            <View style={styles.navGap} />
            <Button label={isLast ? 'Done' : 'Next'} onPress={handleNext} style={styles.navButton} />
          </View>

          <Card style={styles.needAMinuteCard}>
            <View style={styles.rowCenter}>
              <IconSymbol name="hand.raised.fill" size={18} color={Colors.estimateText} />
              <ThemedText type="smallBold" themeColor="textSecondary">
                Need a minute?
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.needAMinutePhrase}>
              {NEED_A_MINUTE_PHRASE}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Show this to airport staff if it helps.
            </ThemedText>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  listenButton: {
    minHeight: 120,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  listenButtonPressed: {
    opacity: 0.85,
  },
  listenLabel: {
    color: Colors.surface,
  },
  listenNote: {
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
  },
  navGap: {
    width: Spacing.two,
  },
  navButton: {
    flex: 1,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  needAMinuteCard: {
    backgroundColor: Colors.estimateFill,
    gap: Spacing.two,
  },
  needAMinutePhrase: {
    color: Colors.estimateText,
  },
});
