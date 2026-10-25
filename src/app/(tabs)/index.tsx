import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFlightStatus, getSupportedAirportCode } from '@/data/client';
import { clearSavedFlight, getSavedFlights, type SavedFlight } from '@/data/saved-flight';
import type { FlightLookup } from '@/data/types';
import { FLIGHT_STATUS_LABEL, formatDateHeader, formatTime } from '@/lib/format';

export default function HomeScreen() {
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [savedFlights, setSavedFlights] = useState<SavedFlight[]>([]);
  const airportCode = getSupportedAirportCode(flight?.origin.code ?? 'SFO');
  const airportLabel = flight?.origin.code ?? 'SFO';
  const [flightDate, setFlightDate] = useState<string | null>(null);
  const [unmatchedFlightNumber, setUnmatchedFlightNumber] = useState<string | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const loadFlights = useCallback(async () => {
    const savedFlightsResult = await getSavedFlights();
    setSavedFlights(savedFlightsResult);
    const saved = savedFlightsResult[0];
    if (!saved) {
      setFlight(null);
      setFlightDate(null);
      setUnmatchedFlightNumber(null);
      return;
    }
    const result = saved.lookup ?? await getFlightStatus(saved.flightNumber, saved.date, saved.originCode);
    if (result) {
      setFlight(result);
      setFlightDate(saved.date);
      setUnmatchedFlightNumber(null);
    } else {
      setFlight(null);
      setFlightDate(null);
      setUnmatchedFlightNumber(saved.flightNumber);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadFlights(); }, [loadFlights]));

  const removeFlight = useCallback(async (saved: SavedFlight) => {
    await clearSavedFlight(saved);
    await loadFlights();
  }, [loadFlights]);

  const confirmRemoveFlight = useCallback((saved: SavedFlight) => {
    const label = saved.lookup?.flight ?? saved.flightNumber;
    Alert.alert(
      `Remove ${label}?`,
      'This flight will be removed from this device.',
      [
        { text: 'Keep flight', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => { void removeFlight(saved); } },
      ],
    );
  }, [removeFlight]);

  const primarySaved = savedFlights[0];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                {formatDateHeader(new Date())}
              </ThemedText>
              <ThemedText type="title">Good morning.</ThemedText>
            </View>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={8}
              style={styles.avatarButton}>
              <IconSymbol name="gearshape.fill" size={20} color={theme.primary} />
            </Pressable>
          </View>

          {flight && primarySaved ? (
            <FlightCard
              saved={primarySaved}
              lookup={flight}
              onEdit={() => router.push('/flight-lookup')}
              onRemove={() => confirmRemoveFlight(primarySaved)}
              onSimulate={() =>
                router.push({
                  pathname: '/gate-change',
                  params: { flight: flight.flight, date: flightDate ?? undefined },
                })
              }
            />
          ) : (
            <Card>
              {unmatchedFlightNumber ? (
                <>
                  <ThemedText type="smallBold">We couldn&apos;t find {unmatchedFlightNumber}</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    This demo recognizes the SFO and Charleston sample flights. Try editing your flight or
                    choose one of those examples.
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="smallBold">Add your flight</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    Enter your flight number to see its status here.
                  </ThemedText>
                </>
              )}
              <Button
                label={unmatchedFlightNumber ? 'Edit flight' : 'Add your flight'}
                onPress={() => router.push('/flight-lookup')}
              />
            </Card>
          )}

          {savedFlights.length > 1 && (
            <View style={styles.legsSection}>
              <ThemedText type="subtitle">Layover flights</ThemedText>
              {savedFlights.slice(1).map((saved, index) => (
                <FlightCard
                  key={flightKey(saved)}
                  saved={saved}
                  lookup={saved.lookup ?? null}
                  legLabel={`Leg ${index + 2}`}
                  onEdit={() => router.push({ pathname: '/flight-lookup', params: legEditParams(saved) })}
                  onRemove={() => confirmRemoveFlight(saved)}
                  onSimulate={() =>
                    router.push({
                      pathname: '/gate-change',
                      params: { flight: saved.lookup?.flight ?? saved.flightNumber, date: saved.date },
                    })
                  }
                />
              ))}
            </View>
          )}

          {savedFlights.length > 0 && (
            <Button
              label="Add another flight"
              variant="secondary"
              onPress={() => router.push({ pathname: '/flight-lookup', params: { mode: 'add' } })}
            />
          )}

          <View style={styles.nextStepHeading}>
            <ThemedText type="subtitle">Your next step</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">A calmer trip, one step at a time</ThemedText>
          </View>
          <Pressable onPress={() => router.push('/calm-guide')} accessibilityRole="button" style={styles.nextStep}>
            <View style={styles.nextStepRow}>
              <View style={styles.stepIcon}><IconSymbol name="checkmark" size={18} color={theme.surface} /></View>
              <View style={styles.stepCopy}>
                <ThemedText type="smallBold">Plan your airport steps</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Set your timing and find a quieter route.</ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={16} color={theme.primary} />
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <View>
              <ThemedText type="subtitle">Explore {airportLabel}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {airportCode === 'CHS' ? 'Whole-airport overview · sample pins' : airportCode === 'SFO' ? 'A full airport overview with calm spots' : 'Flight found · detailed map not available yet'}
              </ThemedText>
            </View>
            <Pressable onPress={() => router.push('/map')} accessibilityRole="button" hitSlop={8}>
              <ThemedText type="smallBold" themeColor="primary">Open map</ThemedText>
            </Pressable>
          </View>
          {airportCode ? <Pressable
            onPress={() => router.push('/map')}
            accessibilityRole="button"
            accessibilityLabel={`Preview of the ${airportCode} airport map. Open map`}
            style={({ pressed }) => [styles.openMapButton, pressed && styles.openMapButtonPressed]}>
            <Image
              source={airportCode === 'CHS'
                ? require('../../../assets/images/chs-airport-overview.png')
                : require('../../../assets/images/sfo-airport-overview.png')}
              resizeMode="contain"
              style={styles.mapPreview}
              accessible={false}
            />
            <View style={styles.mapBadge}><IconSymbol name="location.fill" size={12} color={theme.surface} /><ThemedText type="smallBold" style={styles.mapBadgeText}>Whole airport</ThemedText></View>
          </Pressable> : (
            <Card>
              <ThemedText type="smallBold">We don’t have a {airportLabel} map yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your flight details are saved. Map and gate guidance will appear here when this airport is supported.
              </ThemedText>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function flightKey(saved: SavedFlight): string {
  return `${saved.originCode ?? ''}-${saved.flightNumber}-${saved.date}`;
}

function legEditParams(saved: SavedFlight): Record<string, string> {
  const params: Record<string, string> = { flightNumber: saved.flightNumber, date: saved.date };
  if (saved.originCode) params.originCode = saved.originCode;
  return params;
}

function FlightCard({
  saved,
  lookup,
  legLabel,
  onEdit,
  onRemove,
  onSimulate,
}: {
  saved: SavedFlight;
  lookup: FlightLookup | null;
  legLabel?: string;
  onEdit: () => void;
  onRemove: () => void;
  onSimulate: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const flightLabel = lookup?.flight ?? saved.flightNumber;
  const status = lookup?.status ?? 'unknown';
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit or remove saved flight, currently ${flightLabel}`}
          style={styles.rowCenter}
          hitSlop={8}>
          <IconSymbol name="airplane" size={16} color={theme.primary} />
          <ThemedText type="smallBold">{flightLabel}</ThemedText>
          <IconSymbol name="pencil" size={13} color={theme.primary} />
        </Pressable>
        <View style={styles.rowCenter}>
          {legLabel && (
            <ThemedText type="small" themeColor="textSecondary">{legLabel}</ThemedText>
          )}
          <Pill variant={status === 'unknown' ? 'neutral' : status === 'gate-changed' ? 'estimate' : 'success'}>
            {FLIGHT_STATUS_LABEL[status]}
          </Pill>
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${flightLabel}`}
            hitSlop={8}
            style={styles.removeButton}>
            <IconSymbol name="trash" size={15} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routeEndpoint}>
          <ThemedText type="subtitle">{lookup?.origin.code ?? saved.originCode ?? '—'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {lookup?.origin.city ?? 'Departure'}
          </ThemedText>
        </View>
        <IconSymbol name="airplane" size={18} color={theme.border} />
        <View style={[styles.routeEndpoint, styles.routeEndpointRight]}>
          <ThemedText type="subtitle">{lookup?.destination?.code ?? '—'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {lookup?.destination?.city ?? 'Destination not available'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.rowBetween}>
        <Stat label="Boards" value={lookup ? formatTime(lookup.scheduledDeparture) : 'Not posted'} />
        <Stat label="Gate" value={lookup?.gate ?? 'Not posted'} />
        <Stat label="Terminal" value={lookup?.terminal ?? 'Not posted'} />
      </View>

      {lookup?.gate && (
        <Pressable
          onPress={onSimulate}
          accessibilityRole="button"
          accessibilityLabel="Simulate a gate change, live demo"
          style={styles.simulateButton}>
          <View style={styles.rowCenter}>
            <IconSymbol name="sparkles" size={16} color={theme.text} />
            <ThemedText type="smallBold">Simulate gate change</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">LIVE DEMO</ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
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
    alignItems: 'flex-start',
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeEndpoint: {
    gap: 2,
  },
  routeEndpointRight: {
    alignItems: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: c.neutralFillAlt,
  },
  simulateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.neutralFillAlt,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  legsSection: { gap: Spacing.two },
  removeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  openMapButton: {
    height: 132,
    borderRadius: 20,
    backgroundColor: c.primaryLight,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  mapPreview: { width: '100%', height: 110, alignSelf: 'center' },
  mapBadge: { position: 'absolute', left: 12, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  mapBadgeText: { color: c.surface },
  openMapButtonPressed: { opacity: 0.85 },
  nextStepHeading: { gap: 3 },
  nextStep: { backgroundColor: c.surface, borderRadius: 18, padding: Spacing.three, gap: Spacing.three, shadowColor: '#1F2A2E', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  nextStepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1, gap: 2 },
});
