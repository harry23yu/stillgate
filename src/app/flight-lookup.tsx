import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { sampleFlight } from '@/data/mock/flight';
import { clearSavedFlight, getSavedFlight, saveFlight } from '@/data/saved-flight';

const DEMO_FLIGHT_NUMBER = sampleFlight.flight;
const DEMO_FLIGHT_DATE = sampleFlight.scheduledDeparture.slice(0, 10);

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FlightLookupScreen() {
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasSavedFlight, setHasSavedFlight] = useState(false);

  useEffect(() => {
    getSavedFlight().then((saved) => {
      if (saved) {
        setHasSavedFlight(true);
        setFlightNumber(saved.flightNumber);
        setDate(saved.date);
      }
    });
  }, []);

  async function handleSave() {
    const trimmedFlightNumber = flightNumber.trim().toUpperCase();
    const trimmedDate = date.trim();
    if (!trimmedFlightNumber || !trimmedDate) {
      setError('Enter both a flight number and a date — SFO looks up flights by both together.');
      return;
    }
    if (!isValidIsoDate(trimmedDate)) {
      setError('Enter a valid date in YYYY-MM-DD format.');
      return;
    }
    setError(null);
    await saveFlight({ flightNumber: trimmedFlightNumber, date: trimmedDate });
    setHasSavedFlight(true);
    router.back();
  }

  function confirmRemoveFlight() {
    Alert.alert(
      'Remove saved flight?',
      'Your flight details will be removed from this device.',
      [
        { text: 'Keep flight', style: 'cancel' },
        {
          text: 'Remove flight',
          style: 'destructive',
          onPress: () => void removeSavedFlight(),
        },
      ],
    );
  }

  async function removeSavedFlight() {
    try {
      await clearSavedFlight();
      setHasSavedFlight(false);
      setFlightNumber('');
      setDate('');
      router.back();
    } catch {
      setError('We couldn’t remove the saved flight. Please try again.');
    }
  }

  function fillDemoFlight() {
    setFlightNumber(DEMO_FLIGHT_NUMBER);
    setDate(DEMO_FLIGHT_DATE);
    setError(null);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">Your flight</ThemedText>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
            hitSlop={12}
            style={styles.skipButton}>
            <ThemedText type="smallBold" themeColor="primary">
              Skip for now
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText themeColor="textSecondary" style={styles.intro}>
          Flights are looked up by flight number and date together — a flight number alone
          isn&apos;t enough to find a specific flight. This demo only recognizes one sample flight; a
          real lookup against the SFO flight data API isn&apos;t wired up yet.
        </ThemedText>

        <View style={styles.form}>
          <TextField
            label="Flight number"
            value={flightNumber}
            onChangeText={setFlightNumber}
            placeholder="e.g. AA 1623"
            autoCapitalize="characters"
            accessibilityHint="For example, A A space 1623"
          />

          <View>
            <TextField
              label="Departure date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              accessibilityHint="Year dash month dash day, for example 2026-10-23"
            />
            <Pressable
              onPress={() => setDate(todayIsoDate())}
              accessibilityRole="button"
              accessibilityLabel="Use today's date"
              style={styles.todayButton}>
              <ThemedText type="small" themeColor="primary">
                Today
              </ThemedText>
            </Pressable>
          </View>

          <Button
            label={`Use demo flight (${DEMO_FLIGHT_NUMBER} on ${DEMO_FLIGHT_DATE})`}
            variant="secondary"
            onPress={fillDemoFlight}
          />

          {error && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.error}>
              {error}
            </ThemedText>
          )}
        </View>

        {hasSavedFlight && (
          <Button
            label="Remove saved flight"
            variant="secondary"
            onPress={confirmRemoveFlight}
          />
        )}
        <Button label={hasSavedFlight ? 'Update flight' : 'Save flight'} onPress={handleSave} style={styles.saveButton} />
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
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
    maxWidth: 420,
  },
  form: {
    gap: Spacing.three,
  },
  todayButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  error: {
    color: Colors.estimateBorder,
  },
  saveButton: {
    marginTop: 'auto',
    marginBottom: Spacing.four,
  },
});

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
