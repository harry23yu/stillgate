import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { getAirport, getFlightStatus, getSteps } from '@/data/client';
import type { Airport, FlightLookup, Place, Step } from '@/data/types';
import { formatDateHeader, formatTime } from '@/lib/format';

const PHASE_LABEL: Record<Step['phase'], string> = {
  'check-in': 'Check in',
  security: 'Go through security',
  boarding: 'Head to your gate',
  'gate-change': 'Handle the gate change',
};

const STATUS_LABEL: Record<FlightLookup['status'], string> = {
  'on-time': 'On time',
  delayed: 'Delayed',
  boarding: 'Boarding',
  'gate-changed': 'Gate changed',
  cancelled: 'Cancelled',
};

export default function HomeScreen() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    getAirport('SFO').then(setAirport);
    getFlightStatus('AA 1623').then(setFlight);
    getSteps('SFO', 'security').then(setSteps);
  }, []);

  const quietPlaces = airport?.places.filter((place) => place.type === 'quiet') ?? [];
  const nextStep = steps[0];

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

          {flight && (
            <Card>
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  <IconSymbol name="airplane" size={16} color={Colors.primary} />
                  <ThemedText type="smallBold">{flight.flight}</ThemedText>
                </View>
                <Pill variant={flight.status === 'gate-changed' ? 'estimate' : 'success'}>
                  {STATUS_LABEL[flight.status]}
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
                onPress={() => router.push('/gate-change')}
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
          )}

          <View style={styles.sectionHeader}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Your next step
            </ThemedText>
            {steps.length > 0 && <Pill>{`1 of ${steps.length}`}</Pill>}
          </View>

          {nextStep && (
            <>
              <ThemedText type="subtitle">{PHASE_LABEL[nextStep.phase]}</ThemedText>
              <Card style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  <IconSymbol name="arrow.right" size={18} color={Colors.surface} />
                </View>
                <View style={styles.stepText}>
                  <ThemedText type="smallBold">{nextStep.text}</ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Listen to this step"
                  onPress={() => router.push('/calm-guide')}
                  hitSlop={8}
                  style={styles.playButton}>
                  <IconSymbol name="play.fill" size={16} color={Colors.surface} />
                </Pressable>
              </Card>
            </>
          )}

          <Button label="Start guidance" onPress={() => router.push('/calm-guide')} />
          <Pressable
            onPress={() => router.push('/calm-guide')}
            accessibilityRole="button"
            accessibilityLabel="Show step-by-step details"
            style={styles.linkButton}>
            <ThemedText type="smallBold" themeColor="primary">
              Show step-by-step details
            </ThemedText>
          </Pressable>

          <View style={styles.sectionHeader}>
            <View>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Made for your needs
              </ThemedText>
              <ThemedText type="subtitle">Quiet places nearby</ThemedText>
            </View>
            <Pressable
              onPress={() => router.push('/map')}
              accessibilityRole="button"
              accessibilityLabel="View full map">
              <ThemedText type="smallBold" themeColor="primary">
                View map
              </ThemedText>
            </Pressable>
          </View>

          <MapPreview places={quietPlaces} />
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

function MapPreview({ places }: { places: Place[] }) {
  return (
    <ThemedView type="neutralFillAlt" style={styles.mapPreview}>
      {places.slice(0, 3).map((place) => (
        <View key={place.id} style={[styles.pin, { left: `${place.x * 100}%`, top: `${place.y * 100}%` }]}>
          <IconSymbol name="mappin.circle.fill" size={22} color={Colors.primary} />
        </View>
      ))}
      <View style={[styles.pin, styles.youPin]}>
        <View style={styles.youDot} />
        <ThemedText type="small" style={styles.youLabel}>
          You
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.mapLabel}>
        TERMINAL 1
      </ThemedText>
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
    paddingBottom: Spacing.six + BottomTabInset,
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  mapPreview: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pin: {
    position: 'absolute',
    transform: [{ translateX: -11 }, { translateY: -11 }],
  },
  youPin: {
    left: '45%',
    top: '70%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  youDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.youMarker,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  youLabel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapLabel: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.two,
    letterSpacing: 1,
  },
});
