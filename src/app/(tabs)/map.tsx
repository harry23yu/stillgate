import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TerminalMap } from '@/components/terminal-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getFlightStatus } from '@/data/client';
import { getSavedFlight } from '@/data/saved-flight';
import type { AirportCode, FlightLookup } from '@/data/types';

export default function MapScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [airportCode, setAirportCode] = useState<AirportCode>('SFO');
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const airportName = airportCode === 'SFO' ? 'San Francisco' : 'Charleston';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadSavedFlight() {
        const saved = await getSavedFlight();
        const result = saved ? await getFlightStatus(saved.flightNumber, saved.date) : null;
        if (!active) return;
        setFlight(result);
        setAirportCode(result?.origin.code === 'CHS' ? 'CHS' : 'SFO');
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
              <ThemedText type="title">Explore {airportCode}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{airportName} International Airport</ThemedText>
            </View>
          </View>
          <TerminalMap key={airportCode} airportCode={airportCode} flight={flight} focusPlaceId={focus} />
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
  header: { gap: Spacing.one },
  headerText: {
    flex: 1,
  },
});
