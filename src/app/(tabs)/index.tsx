import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getFlightStatus } from '@/data/client';
import { getSavedFlight } from '@/data/saved-flight';
import type { FlightLookup } from '@/data/types';
import { FLIGHT_STATUS_LABEL, formatDateHeader, formatTime } from '@/lib/format';

export default function HomeScreen() {
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [flightDate, setFlightDate] = useState<string | null>(null);
  const [unmatchedFlightNumber, setUnmatchedFlightNumber] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSavedFlight().then(async (saved) => {
        if (!saved) {
          setFlight(null);
          setFlightDate(null);
          setUnmatchedFlightNumber(null);
          return;
        }
        const result = await getFlightStatus(saved.flightNumber, saved.date);
        if (result) {
          setFlight(result);
          setFlightDate(saved.date);
          setUnmatchedFlightNumber(null);
        } else {
          setFlight(null);
          setFlightDate(null);
          setUnmatchedFlightNumber(saved.flightNumber);
        }
      });
    }, []),
  );

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
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open sensory profile"
              hitSlop={8}
              style={styles.avatarButton}>
              <IconSymbol name="gearshape.fill" size={20} color={Colors.primary} />
            </Pressable>
          </View>

          {flight ? (
            <Card>
              <View style={styles.rowBetween}>
                <Pressable
                  onPress={() => router.push('/flight-lookup')}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit or remove saved flight, currently ${flight.flight}`}
                  style={styles.rowCenter}
                  hitSlop={8}>
                  <IconSymbol name="airplane" size={16} color={Colors.primary} />
                  <ThemedText type="smallBold">{flight.flight}</ThemedText>
                  <IconSymbol name="pencil" size={13} color={Colors.primary} />
                </Pressable>
                <Pill variant={flight.status === 'gate-changed' ? 'estimate' : 'success'}>
                  {FLIGHT_STATUS_LABEL[flight.status]}
                </Pill>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routeEndpoint}>
                  <ThemedText type="subtitle">{flight.origin.code}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {flight.origin.city}
                  </ThemedText>
                </View>
                <IconSymbol name="airplane" size={18} color={Colors.border} />
                <View style={[styles.routeEndpoint, styles.routeEndpointRight]}>
                  <ThemedText type="subtitle">{flight.destination.code}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {flight.destination.city}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowBetween}>
                <Stat label="Boards" value={formatTime(flight.scheduledDeparture)} />
                <Stat label="Gate" value={flight.gate} />
                <Stat label="Terminal" value={flight.terminal} />
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/gate-change',
                    params: { flight: flight.flight, date: flightDate ?? undefined },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Simulate a gate change, live demo"
                style={styles.simulateButton}>
                <View style={styles.rowCenter}>
                  <IconSymbol name="sparkles" size={16} color={Colors.text} />
                  <ThemedText type="smallBold">Simulate gate change</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  LIVE DEMO
                </ThemedText>
              </Pressable>
            </Card>
          ) : (
            <Card>
              {unmatchedFlightNumber ? (
                <>
                  <ThemedText type="smallBold">We couldn&apos;t find {unmatchedFlightNumber}</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    This demo only recognizes one sample flight. Try editing your flight or use the demo
                    flight instead.
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

          <View style={styles.nextStepHeading}>
            <ThemedText type="subtitle">Your next step</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">A calmer trip, one step at a time</ThemedText>
          </View>
          <Pressable onPress={() => router.push('/calm-guide')} accessibilityRole="button" style={styles.nextStep}>
            <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
            <View style={styles.nextStepRow}>
              <View style={styles.stepIcon}><IconSymbol name="checkmark" size={18} color={Colors.surface} /></View>
              <View style={styles.stepCopy}>
                <ThemedText type="smallBold">Plan your airport steps</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Set your timing and find a quieter route.</ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={16} color={Colors.primary} />
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <View>
              <ThemedText type="subtitle">Explore SFO</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">A full airport overview with calm spots</ThemedText>
            </View>
            <Pressable onPress={() => router.push('/map')} accessibilityRole="button" hitSlop={8}>
              <ThemedText type="smallBold" themeColor="primary">Open map</ThemedText>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push('/map')}
            accessibilityRole="button"
            accessibilityLabel="Preview of the SFO terminal map. Open map"
            style={({ pressed }) => [styles.openMapButton, pressed && styles.openMapButtonPressed]}>
            <Image
              source={require('../../../assets/images/sfo-airport-overview.png')}
              resizeMode="contain"
              style={styles.mapPreview}
              accessible={false}
            />
            <View style={styles.mapBadge}><IconSymbol name="location.fill" size={12} color={Colors.surface} /><ThemedText type="smallBold" style={styles.mapBadgeText}>Whole airport</ThemedText></View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
    alignItems: 'flex-start',
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
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
    backgroundColor: Colors.neutralFillAlt,
  },
  simulateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.neutralFillAlt,
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
  openMapButton: {
    height: 132,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  mapPreview: { width: '100%', height: 110, alignSelf: 'center' },
  mapBadge: { position: 'absolute', left: 12, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  mapBadgeText: { color: Colors.surface },
  openMapButtonPressed: { opacity: 0.85 },
  nextStepHeading: { gap: 3 },
  nextStep: { backgroundColor: Colors.surface, borderRadius: 18, padding: Spacing.three, gap: Spacing.three, shadowColor: '#1F2A2E', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.neutralFillAlt, overflow: 'hidden' },
  progressFill: { height: '100%', width: '28%', backgroundColor: Colors.primary, borderRadius: 3 },
  nextStepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1, gap: 2 },
});
