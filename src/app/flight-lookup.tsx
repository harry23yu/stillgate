import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFlightStatus, getSupportedAirportCode, prefetchAirport } from '@/data/client';
import { lookupFlight, type FlightLookupResult } from '@/data/flight-provider';
import { sampleChsFlight, sampleDcaFlight, sampleFlight } from '@/data/mock/flight';
import { clearSavedFlight, getSavedFlights, saveFlight, type SavedFlight } from '@/data/saved-flight';
import type { FlightLookup } from '@/data/types';
import { formatTime } from '@/lib/format';
import { goBackOrHome } from '@/lib/navigation';
import { confirmAction } from '@/lib/notify';

const DEMO_FLIGHTS = [sampleFlight, sampleChsFlight, sampleDcaFlight];

function todayIsoDate(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function FlightLookupScreen() {
  const { mode, flightNumber: flightParam, originCode: originParam, date: dateParam } = useLocalSearchParams<{
    mode?: string;
    flightNumber?: string;
    originCode?: string;
    date?: string;
  }>();
  const addingFlight = mode === 'add';
  const [flightNumber, setFlightNumber] = useState('');
  const [originCode, setOriginCode] = useState('');
  const [date, setDate] = useState('');
  const [lookupResult, setLookupResult] = useState<FlightLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSavedFlight, setHasSavedFlight] = useState(false);
  const [selectedSavedFlight, setSelectedSavedFlight] = useState<SavedFlight | null>(null);
  const theme = useTheme();

  useEffect(() => {
    let active = true;
    async function loadSavedFlight() {
      try {
        const savedFlights = addingFlight ? [] : await getSavedFlights();
        const saved = flightParam && dateParam
          ? savedFlights.find((item) => item.flightNumber === flightParam && item.date === dateParam && (!originParam || item.originCode === originParam))
          : savedFlights[0];
        if (!saved || !active) return;
        const flight = saved.lookup ?? await getFlightStatus(saved.flightNumber, saved.date, saved.originCode);
        if (!active) return;
        setHasSavedFlight(true);
        setSelectedSavedFlight(saved);
        setFlightNumber(saved.flightNumber);
        setOriginCode(saved.originCode ?? flight?.origin.code ?? '');
        setDate(saved.date);
        if (flight) setLookupResult({ kind: 'found', flight });
      } catch {
        if (active) setError('We couldn’t load your saved flight from this device.');
      }
    }
    void loadSavedFlight();
    return () => {
      active = false;
    };
  }, [addingFlight, dateParam, flightParam, originParam]);

  async function handleSearch() {
    const normalizedFlight = flightNumber.trim().toUpperCase().replace(/\s+/g, ' ');
    const normalizedOrigin = originCode.trim().toUpperCase();
    const normalizedDate = date.trim();
    if (!normalizedFlight || !normalizedDate || !normalizedOrigin) {
      setError('Enter a flight number, departure airport, and date.');
      setLookupResult(null);
      return;
    }
    if (!/^[A-Z]{3}$/.test(normalizedOrigin)) {
      setError('Enter the 3-letter airport code, like SFO or CHS.');
      setLookupResult(null);
      return;
    }
    if (!isValidIsoDate(normalizedDate)) {
      setError('Enter a valid date in YYYY-MM-DD format.');
      setLookupResult(null);
      return;
    }

    setError(null);
    setLookupResult(null);
    setSearching(true);
    try {
      const result = await lookupFlight({
        airportCode: normalizedOrigin,
        flightNumber: normalizedFlight,
        date: normalizedDate,
      });
      setLookupResult(result);
      if (result.kind === 'found') {
        setFlightNumber(result.flight.flight);
        setOriginCode(result.flight.origin.code);
        setDate(result.flight.scheduledDeparture.slice(0, 10));
      }
    } catch {
      setError('We couldn’t check this flight right now. Please try again.');
      setLookupResult({ kind: 'unavailable', message: 'Flight lookup is temporarily unavailable.' });
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    if (lookupResult?.kind !== 'found') return;
    const flight = lookupResult.flight;
    try {
      await saveFlight({
        flightNumber: flight.flight,
        date: flight.scheduledDeparture.slice(0, 10),
        originCode: flight.origin.code,
        lookup: flight,
      });
      // Save both airports' reviewed places now, while Wi-Fi is likely good,
      // so the map works offline at the airport. Fire-and-forget.
      for (const code of [flight.origin.code, flight.destination?.code]) {
        const supported = getSupportedAirportCode(code);
        if (supported) void prefetchAirport(supported);
      }
      setHasSavedFlight(true);
      goBackOrHome();
    } catch {
      setError('We couldn’t save this flight on your device. Please try again.');
    }
  }

  function confirmRemoveFlight() {
    confirmAction({
      title: 'Remove saved flight?',
      message: 'Your flight details will be removed from this device.',
      cancelLabel: 'Keep flight',
      confirmLabel: 'Remove flight',
      destructive: true,
      onConfirm: () => void removeSavedFlight(),
    });
  }

  async function removeSavedFlight() {
    try {
      await clearSavedFlight(selectedSavedFlight ?? undefined);
      setHasSavedFlight(false);
      setSelectedSavedFlight(null);
      setFlightNumber('');
      setOriginCode('');
      setDate('');
      setLookupResult(null);
      goBackOrHome();
    } catch {
      setError('We couldn’t remove the saved flight. Please try again.');
    }
  }

  function fillDemoFlight(flight: FlightLookup) {
    setFlightNumber(flight.flight);
    setOriginCode(flight.origin.code);
    setDate(flight.scheduledDeparture.slice(0, 10));
    setLookupResult(null);
    setError(null);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title">{addingFlight ? 'Add a flight' : 'Your flight'}</ThemedText>
            <Pressable
              onPress={goBackOrHome}
              accessibilityRole="button"
              accessibilityLabel="Skip for now"
              hitSlop={12}
              style={styles.skipButton}>
              <ThemedText type="smallBold" themeColor="primary">Skip for now</ThemedText>
            </Pressable>
          </View>

          <ThemedText themeColor="textSecondary" style={styles.intro}>
            Search by flight number, departure airport, and date.
          </ThemedText>

          <View style={styles.form}>
            <TextField
              label="Flight number"
              value={flightNumber}
              onChangeText={(value) => { setFlightNumber(value); setLookupResult(null); setError(null); }}
              placeholder="e.g. UA 1"
              autoCapitalize="characters"
              accessibilityHint="Include the airline code and flight number."
            />
            <TextField
              label="Departure airport"
              value={originCode}
              onChangeText={(value) => { setOriginCode(value); setLookupResult(null); setError(null); }}
              placeholder="3-letter code, e.g. SFO"
              autoCapitalize="characters"
              accessibilityHint="The airport you are departing from."
            />
            <View>
              <TextField
                label="Departure date"
                value={date}
                onChangeText={(value) => { setDate(value); setLookupResult(null); setError(null); }}
                placeholder="YYYY-MM-DD"
                accessibilityHint="Year dash month dash day, for example 2026-10-24."
              />
              <Pressable
                onPress={() => { setDate(todayIsoDate()); setLookupResult(null); setError(null); }}
                accessibilityRole="button"
                accessibilityLabel="Use today's date"
                style={styles.todayButton}>
                <ThemedText type="small" themeColor="primary">Today</ThemedText>
              </Pressable>
            </View>

            {DEMO_FLIGHTS.map((demoFlight) => (
              <Button
                key={`${demoFlight.origin.code}-${demoFlight.flight}`}
                label={`${demoFlight.origin.code} example · ${demoFlight.flight}`}
                variant="secondary"
                onPress={() => fillDemoFlight(demoFlight)}
              />
            ))}
          </View>

          {searching && (
            <Card>
              <ThemedText type="smallBold">Checking flight details…</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Looking up the latest status for your flight.</ThemedText>
            </Card>
          )}

          {lookupResult?.kind === 'found' && <FlightResult flight={lookupResult.flight} />}
          {lookupResult?.kind === 'not-found' && (
            <Card>
              <Pill variant="estimate">No match found</Pill>
              <ThemedText type="smallBold">Check the flight details</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                We couldn’t find a flight for this airport and date. Double-check the flight number, airport, and date.
              </ThemedText>
            </Card>
          )}
          {lookupResult?.kind === 'unavailable' && (
            <Card>
              <Pill variant="estimate">Can’t verify right now</Pill>
              <ThemedText type="small" themeColor="textSecondary">{lookupResult.message}</ThemedText>
            </Card>
          )}
          {error && <ThemedText type="small" themeColor="textSecondary" style={{ color: theme.estimateText }}>{error}</ThemedText>}

          <Button label={searching ? 'Checking…' : 'Find flight'} onPress={() => void handleSearch()} disabled={searching} />
          {lookupResult?.kind === 'found' && (
            <Button label={addingFlight ? 'Add to my trip' : hasSavedFlight ? 'Update saved flight' : 'Save this flight'} onPress={() => void handleSave()} />
          )}
          {hasSavedFlight && (
            <Button label="Remove saved flight" variant="secondary" onPress={confirmRemoveFlight} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FlightResult({ flight }: { flight: FlightLookup }) {
  return (
    <Card>
      <View style={styles.resultHeading}>
        <ThemedText type="subtitle">{flight.flight}</ThemedText>
        <Pill variant="success">Live</Pill>
      </View>
      <ThemedText type="smallBold">
        {flight.origin.code} {flight.destination ? `to ${flight.destination.code}` : 'departure'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatTime(flight.scheduledDeparture)} · Gate {flight.gate ?? 'not posted'} · {flight.terminal ?? 'Terminal not posted'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Updated {formatTime(flight.retrievedAt)}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  intro: { maxWidth: 440 },
  form: { gap: Spacing.three },
  todayButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.one },
  resultHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
