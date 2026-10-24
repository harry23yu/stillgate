import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TerminalMap } from '@/components/terminal-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getFlightStatus, getSupportedAirportCode } from '@/data/client';
import { getSavedFlight } from '@/data/saved-flight';
import type { AirportCode, FlightLookup } from '@/data/types';

export default function MapScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [airportCode, setAirportCode] = useState<AirportCode | null>('SFO');
  const [airportOrigin, setAirportOrigin] = useState('SFO');
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const airportName = airportCode === 'SFO' ? 'San Francisco' : airportCode === 'CHS' ? 'Charleston' : airportOrigin;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadSavedFlight() {
        const saved = await getSavedFlight();
        const result = saved?.lookup ?? (saved ? await getFlightStatus(saved.flightNumber, saved.date, saved.originCode) : null);
        if (!active) return;
        setFlight(result);
        const origin = result?.origin.code ?? saved?.originCode ?? 'SFO';
        setAirportOrigin(origin);
        setAirportCode(getSupportedAirportCode(origin));
      }
      void loadSavedFlight();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="title">Explore {airportOrigin}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {airportCode ? `${airportName} International Airport` : 'Detailed airport map not available yet'}
              </ThemedText>
            </View>
          </View>
          {airportCode ? (
            <TerminalMap key={airportCode} airportCode={airportCode} flight={flight} focusPlaceId={focus} />
          ) : (
            <Card>
              <ThemedText type="subtitle">We don’t have a {airportOrigin} map yet</ThemedText>
              <ThemedText themeColor="textSecondary">
                Your flight is recognized, but this airport’s terminal layout and gate locations aren’t in Stillgate yet.
              </ThemedText>
              <Button label="Edit flight" variant="secondary" onPress={() => router.push('/flight-lookup')} />
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: { gap: Spacing.one },
  headerText: { flex: 1 },
});
