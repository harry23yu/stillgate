import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import {
  estimateWalkMinutes,
  getAirport,
  getFlightStatus,
  getNearestQuietPlace,
  simulateGateChange,
  YOU_POSITION,
} from '@/data/client';
import { sampleFlight } from '@/data/mock/flight';
import type { Airport, FlightLookup, Place } from '@/data/types';
import { FLIGHT_STATUS_LABEL, formatTime } from '@/lib/format';

const DEMO_FLIGHT_NUMBER = sampleFlight.flight;
const DEMO_FLIGHT_DATE = sampleFlight.scheduledDeparture.slice(0, 10);

export default function GateChangeScreen() {
  const { flight: flightParam, date: dateParam } = useLocalSearchParams<{ flight?: string; date?: string }>();
  const flightNumber = flightParam ?? DEMO_FLIGHT_NUMBER;
  const date = dateParam ?? DEMO_FLIGHT_DATE;
  const [airport, setAirport] = useState<Airport | null>(null);
  const [before, setBefore] = useState<FlightLookup | null>(null);
  const [after, setAfter] = useState<FlightLookup | null>(null);
  const [gentleAlertsOnly, setGentleAlertsOnly] = useState(true);

  useEffect(() => {
    getAirport('SFO').then(setAirport);
    getFlightStatus(flightNumber, date).then(setBefore);
    simulateGateChange(flightNumber, date).then(setAfter);
  }, [flightNumber, date]);

  if (!airport || !before || !after) {
    return <ThemedView style={styles.container} />;
  }

  const newGate = after.gate;
  const areaId = airport.gateAreas[newGate];
  const areaCenter = areaId ? airport.areaCenters[areaId] : YOU_POSITION;
  const quietPlace = getNearestQuietPlace(airport, newGate);
  const walkMinutes = quietPlace ? estimateWalkMinutes(areaCenter, quietPlace) : null;

  function handleTakeMeToQuietSpot(place: Place) {
    router.push({ pathname: '/map', params: { focus: place.id } });
  }

  function handleShowWayToGate() {
    Alert.alert(
      `Gate ${newGate}`,
      `Gate ${newGate} is in the C concourse of Terminal 1. Turn-by-turn directions are not part of this demo — use the map to see the area.`,
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.demoBadge}>
            <IconSymbol name="sparkles" size={14} color={Colors.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Simulated demo: not a real flight
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={styles.closeButton}>
            <ThemedText type="smallBold" themeColor="primary">
              Close
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="title">Your gate has changed</ThemedText>

          <Card>
            <View style={styles.rowCenter}>
              <IconSymbol name="airplane" size={16} color={Colors.primary} />
              <ThemedText type="smallBold">{after.flight}</ThemedText>
            </View>
            <View style={styles.gateRow}>
              <GateBlock label="Old gate" gate={before.gate} />
              <IconSymbol name="arrow.right" size={20} color={Colors.border} />
              <GateBlock label="New gate" gate={after.gate} emphasized />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Boards {formatTime(after.scheduledDeparture)}
            </ThemedText>
          </Card>

          {quietPlace && (
            <Card>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Picked for your profile
              </ThemedText>
              <ThemedText type="subtitle">{quietPlace.name}</ThemedText>
              <ThemedText themeColor="textSecondary">{quietPlace.notes}</ThemedText>
              {walkMinutes !== null && (
                <ThemedText type="smallBold" themeColor="primary">
                  ~{walkMinutes} min walk from the new gate (estimate)
                </ThemedText>
              )}
            </Card>
          )}

          <Card style={styles.alertsRow}>
            <View style={styles.alertsText}>
              <ThemedText type="smallBold">Gentle alerts only</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Fewer, calmer notifications about this change.
              </ThemedText>
            </View>
            <Switch
              value={gentleAlertsOnly}
              onValueChange={setGentleAlertsOnly}
              trackColor={{ true: Colors.primary, false: Colors.neutralFill }}
              accessibilityLabel="Gentle alerts only"
            />
          </Card>

          <View style={styles.actions}>
            {quietPlace && (
              <Button label="Take me to the quiet spot" onPress={() => handleTakeMeToQuietSpot(quietPlace)} />
            )}
            <Button label="Show the way to the new gate" variant="secondary" onPress={handleShowWayToGate} />
            <Button label="Not now" variant="ghost" onPress={() => router.back()} />
          </View>

          <View style={styles.divider} />

          <View>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Live lookup
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.liveLookupNote}>
              {before.isRecorded
                ? 'This demo uses a recorded response, not a live API call.'
                : 'Live result from the flight data API.'}
            </ThemedText>
          </View>
          <Card>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">{before.flight}</ThemedText>
              <Pill variant={before.isRecorded ? 'neutral' : 'success'}>
                {before.isRecorded ? 'Recorded response' : 'Live'}
              </Pill>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {FLIGHT_STATUS_LABEL[before.status]} · Gate {before.gate} · Terminal {before.terminal}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Retrieved {new Date(before.retrievedAt).toLocaleString()}
            </ThemedText>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function GateBlock({ label, gate, emphasized }: { label: string; gate: string; emphasized?: boolean }) {
  return (
    <View style={styles.gateBlock}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type={emphasized ? 'title' : 'subtitle'} themeColor={emphasized ? 'primary' : undefined}>
        {gate}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  content: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
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
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gateBlock: {
    gap: 2,
  },
  alertsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertsText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: Spacing.two,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutralFillAlt,
    marginVertical: Spacing.one,
  },
  liveLookupNote: {
    marginTop: 2,
  },
});
