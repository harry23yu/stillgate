import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../convex/_generated/api';
import {
  estimateWalkMinutes,
  getAirport,
  getFlightStatus,
  getNearestQuietPlace,
  simulateGateChange,
  YOU_POSITION,
} from '@/data/client';
import { sampleFlight } from '@/data/mock/flight';
import { defaultProfile, getProfile } from '@/data/profile';
import type { Airport, FlightLookup, Place, Profile } from '@/data/types';
import { FLIGHT_STATUS_LABEL, formatTime } from '@/lib/format';
import { goBackOrHome } from '@/lib/navigation';
import { notify } from '@/lib/notify';

const hasConvex = Boolean(process.env.EXPO_PUBLIC_CONVEX_URL);

const DEMO_FLIGHT_NUMBER = sampleFlight.flight;
const DEMO_FLIGHT_DATE = sampleFlight.scheduledDeparture.slice(0, 10);

export default function GateChangeScreen() {
  const { flight: flightParam, date: dateParam } = useLocalSearchParams<{ flight?: string; date?: string }>();
  const flightNumber = flightParam ?? DEMO_FLIGHT_NUMBER;
  const date = dateParam ?? DEMO_FLIGHT_DATE;
  const [airport, setAirport] = useState<Airport | null>(null);
  const [before, setBefore] = useState<FlightLookup | null>(null);
  const [after, setAfter] = useState<FlightLookup | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [gentleAlertsOnly, setGentleAlertsOnly] = useState(true);

  useEffect(() => {
    let active = true;
    void getProfile().then((storedProfile) => {
      if (active) setProfile(storedProfile);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadFlightAndAirport() {
      const [beforeFlight, afterFlight] = await Promise.all([
        getFlightStatus(flightNumber, date),
        simulateGateChange(flightNumber, date),
      ]);
      if (!active) return;
      setBefore(beforeFlight);
      setAfter(afterFlight);
      if (beforeFlight) {
        const airportCode = beforeFlight.origin.code === 'CHS' ? 'CHS' : 'SFO';
        const matchingAirport = await getAirport(airportCode);
        if (active) setAirport(matchingAirport);
      }
    }
    void loadFlightAndAirport();
    return () => {
      active = false;
    };
  }, [flightNumber, date]);

  const theme = useTheme();

  if (!airport || !before || !after || !before.gate || !after.gate) {
    return <ThemedView style={styles.container} />;
  }

  const newGate = after.gate;
  const originCode = before.origin.code;
  const areaId = airport.gateAreas[newGate];
  const areaCenter = areaId ? airport.areaCenters[areaId] : YOU_POSITION;
  const quietPlace = getNearestQuietPlace(airport, newGate);
  const walkMinutes = quietPlace ? estimateWalkMinutes(areaCenter, quietPlace) : null;

  function handleShowWayToGate() {
    const location = originCode === 'CHS'
      ? `Concourse ${newGate.charAt(0)} at Charleston International Airport`
      : 'the International Terminal at SFO';
    notify(
      `Gate ${newGate}`,
      `Gate ${newGate} is in ${location}. Turn-by-turn directions are not part of this demo — use the map to see the area.`,
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.demoBadge}>
            <IconSymbol name="sparkles" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Gate change simulated for this demo
            </ThemedText>
          </View>
          <Pressable
            onPress={goBackOrHome}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={styles.closeButton}>
            <IconSymbol name="xmark" size={20} color={theme.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="title">Your gate has changed</ThemedText>

          <Card>
            <View style={styles.rowCenter}>
              <IconSymbol name="airplane" size={16} color={theme.primary} />
              <ThemedText type="smallBold">{after.flight}</ThemedText>
            </View>
            <View style={styles.gateRow}>
              <GateBlock label="Old gate" gate={before.gate} />
              <IconSymbol name="arrow.right" size={20} color={theme.border} />
              <GateBlock label="New gate" gate={after.gate} emphasized />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Boards {formatTime(after.scheduledDeparture)}
            </ThemedText>
          </Card>

          {hasConvex ? (
            <LiveQuietSpotRecommendation
              airportCode={originCode}
              gate={newGate}
              fromGate={before.gate}
              profile={profile}
              fallbackPlace={quietPlace}
              fallbackWalkMinutes={walkMinutes}
            />
          ) : quietPlace ? (
            <QuietSpotCard
              name={quietPlace.name}
              notes={quietPlace.notes}
              walkMinutes={walkMinutes}
              onPress={() => router.push({ pathname: '/map', params: { focus: quietPlace.id } })}
            />
          ) : null}

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
              trackColor={{ true: theme.primary, false: theme.neutralFill }}
              accessibilityLabel="Gentle alerts only"
            />
          </Card>

          <View style={styles.actions}>
            <Button label="Show the way to the new gate" variant="secondary" onPress={handleShowWayToGate} />
            <Button label="Not now" variant="ghost" onPress={goBackOrHome} />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.neutralFillAlt }]} />

          <View>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Live lookup
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.liveLookupNote}>
              Latest status for your flight.
            </ThemedText>
          </View>
          <Card>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">{before.flight}</ThemedText>
              <Pill variant="success">Live</Pill>
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

function LiveQuietSpotRecommendation({
  airportCode,
  gate,
  fromGate,
  profile,
  fallbackPlace,
  fallbackWalkMinutes,
}: {
  airportCode: string;
  gate: string;
  fromGate: string;
  profile: Profile;
  fallbackPlace: Place | null;
  fallbackWalkMinutes: number | null;
}) {
  const result = useQuery(api.gateChange.gateChangeSteps, {
    airportCode,
    gate,
    fromGate,
    profile: {
      noise: profile.noise ?? 'medium',
      crowds: profile.crowds ?? 'medium',
      lighting: profile.lighting ?? 'medium',
      whatHelps: profile.whatHelps,
      firstFlight: profile.firstFlight,
      detailLevel: profile.detailLevel,
    },
  });

  if (!result?.spot) {
    return fallbackPlace ? (
      <QuietSpotCard
        name={fallbackPlace.name}
        notes={fallbackPlace.notes}
        walkMinutes={fallbackWalkMinutes}
        onPress={() => router.push({ pathname: '/map', params: { focus: fallbackPlace.id } })}
      />
    ) : null;
  }

  return (
    <Card>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        Picked for your profile
      </ThemedText>
      <ThemedText type="subtitle">{result.spot.name}</ThemedText>
      {result.steps.slice(1).map((step) => (
        <ThemedText key={step} themeColor="textSecondary">{step}</ThemedText>
      ))}
      <Button
        label="Take me to the quiet spot"
        variant="secondary"
        onPress={() => router.push({ pathname: '/map', params: { focus: result.spot!.id } })}
      />
    </Card>
  );
}

function QuietSpotCard({
  name,
  notes,
  walkMinutes,
  onPress,
}: {
  name: string;
  notes: string;
  walkMinutes: number | null;
  onPress: () => void;
}) {
  return (
    <Card>
      <ThemedText type="eyebrow" themeColor="textSecondary">Picked for your profile</ThemedText>
      <ThemedText type="subtitle">{name}</ThemedText>
      <ThemedText themeColor="textSecondary">{notes}</ThemedText>
      {walkMinutes !== null && (
        <ThemedText type="smallBold" themeColor="primary">
          ~{walkMinutes} min walk from the new gate (estimate)
        </ThemedText>
      )}
      <Button label="Take me to the quiet spot" variant="secondary" onPress={onPress} />
    </Card>
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
    marginVertical: Spacing.one,
  },
  liveLookupNote: {
    marginTop: 2,
  },
});
