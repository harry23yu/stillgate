import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getAirport, getFlightStatus } from '@/data/client';
import { buildItinerary, type Itinerary } from '@/data/itinerary';
import { defaultProfile, getProfile } from '@/data/profile';
import { getSavedFlight } from '@/data/saved-flight';
import { defaultTripDetails, getTripDetails, saveTripDetails, type TripDetails } from '@/data/trip-details';
import type { Airport, FlightLookup, Place, Profile } from '@/data/types';
import { formatTime } from '@/lib/format';

const NEED_A_MINUTE_PHRASE =
  "I'm overwhelmed right now and need a quiet moment. Could you help me find a calm place nearby?";

const STEP_TITLES = ['Trip details', 'Leave-by time', 'Checkpoint', 'Before security', 'After security'];

export default function CalmGuideScreen() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [tripDetails, setTripDetails] = useState<TripDetails>(defaultTripDetails);
  const [stepIndex, setStepIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const listeningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAirport('SFO').then(setAirport);
    getProfile().then(setProfile);
    getTripDetails().then(setTripDetails);
    getSavedFlight().then(async (saved) => {
      if (!saved) return;
      const result = await getFlightStatus(saved.flightNumber, saved.date);
      setFlight(result);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (listeningTimeout.current) clearTimeout(listeningTimeout.current);
    };
  }, []);

  const itinerary = useMemo<Itinerary | null>(() => {
    if (!airport || !flight) return null;
    return buildItinerary(airport, flight, tripDetails, profile, new Date());
  }, [airport, flight, tripDetails, profile]);

  if (!airport || !flight || !itinerary) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">Add a flight to get started</ThemedText>
            <ThemedText themeColor="textSecondary">
              Calm Guide needs a flight that matches this demo&apos;s data to build your steps.
            </ThemedText>
            <Button label="Add or edit your flight" onPress={() => router.push('/flight-lookup')} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isLast = stepIndex === STEP_TITLES.length - 1;
  const isFirst = stepIndex === 0;

  function handleListen() {
    if (listeningTimeout.current) clearTimeout(listeningTimeout.current);
    setListening(true);
    listeningTimeout.current = setTimeout(() => setListening(false), 1800);
  }

  function handleBack() {
    setListening(false);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  async function handleNext() {
    setListening(false);
    if (stepIndex === 0) {
      await saveTripDetails(tripDetails);
    }
    if (isLast) {
      router.push('/');
      return;
    }
    setStepIndex((index) => Math.min(STEP_TITLES.length - 1, index + 1));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Calm Guide
            </ThemedText>
            <Pill>{`Step ${stepIndex + 1} of ${STEP_TITLES.length}`}</Pill>
          </View>

          <ThemedText type="title">{STEP_TITLES[stepIndex]}</ThemedText>

          {stepIndex === 0 && <TripDetailsStep tripDetails={tripDetails} onChange={setTripDetails} />}
          {stepIndex === 1 && <ArrivalTimeStep itinerary={itinerary} />}
          {stepIndex === 2 && <CheckpointStep itinerary={itinerary} />}
          {stepIndex === 3 && <TsaReminderStep itinerary={itinerary} />}
          {stepIndex === 4 && <PostSecurityStep itinerary={itinerary} flight={flight} />}

          <Pressable
            onPress={handleListen}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Playing this step' : 'Listen to this step'}
            style={({ pressed }) => [styles.listenButton, pressed && styles.listenButtonPressed]}>
            <IconSymbol name={listening ? 'waveform' : 'play.fill'} size={32} color={Colors.surface} />
            <ThemedText type="subtitle" style={styles.listenLabel}>
              {listening ? 'Playing…' : 'Listen'}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.listenNote}>
            Spoken audio for this step is coming soon — this button is a placeholder for now.
          </ThemedText>

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

function TripDetailsStep({
  tripDetails,
  onChange,
}: {
  tripDetails: TripDetails;
  onChange: (details: TripDetails) => void;
}) {
  function toggle<K extends keyof TripDetails>(key: K) {
    onChange({ ...tripDetails, [key]: !tripDetails[key] });
  }

  return (
    <View style={styles.stepBody}>
      <ThemedText themeColor="textSecondary">
        A few quick questions so later steps only show what applies to you.
      </ThemedText>
      <YesNoRow label="Checking a bag?" value={tripDetails.checkingBag} onToggle={() => toggle('checkingBag')} />
      <YesNoRow
        label="Already have a boarding pass?"
        value={tripDetails.hasBoardingPass}
        onToggle={() => toggle('hasBoardingPass')}
      />
      <YesNoRow
        label="Have TSA PreCheck or CLEAR?"
        value={tripDetails.hasPreCheck}
        onToggle={() => toggle('hasPreCheck')}
      />
      <YesNoRow
        label="International flight?"
        value={tripDetails.isInternational}
        onToggle={() => toggle('isInternational')}
      />
    </View>
  );
}

function YesNoRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.yesNoRow}>
      <ThemedText type="smallBold" style={styles.yesNoLabel}>
        {label}
      </ThemedText>
      <View style={styles.chipRow}>
        <Chip label="Yes" selected={value} onPress={onToggle} />
        <Chip label="No" selected={!value} onPress={onToggle} />
      </View>
    </View>
  );
}

function ArrivalTimeStep({ itinerary }: { itinerary: Itinerary }) {
  return (
    <Card style={styles.stepBody}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        Estimate
      </ThemedText>
      <ThemedText type="title">Leave by {formatTime(itinerary.recommendedArrival.time)}</ThemedText>
      <ThemedText themeColor="textSecondary">
        That includes about a {itinerary.recommendedArrival.bufferMinutes}-minute buffer before your
        flight, based on your trip details and the current checkpoint wait.
      </ThemedText>
    </Card>
  );
}

function CheckpointStep({ itinerary }: { itinerary: Itinerary }) {
  const checkpoint = itinerary.recommendedCheckpoint;

  if (!checkpoint) {
    return (
      <Card style={styles.stepBody}>
        <ThemedText themeColor="textSecondary">
          Checkpoint wait data isn&apos;t available for this airport yet.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card style={styles.stepBody}>
      <ThemedText type="subtitle">{checkpoint.checkpoint}</ThemedText>
      <View style={styles.rowCenter}>
        <Pill variant={checkpoint.queueStatus === 'low' ? 'success' : 'estimate'}>
          {`${checkpoint.waitMinutes} min wait`}
        </Pill>
        <ThemedText type="small" themeColor="textSecondary">
          {checkpoint.queueStatus} queue (estimate)
        </ThemedText>
      </View>
    </Card>
  );
}

function TsaReminderStep({ itinerary }: { itinerary: Itinerary }) {
  return (
    <View style={styles.stepBody}>
      <Card>
        <ThemedText type="subtitle">What to expect</ThemedText>
        <ThemedText>{itinerary.tsaReminder.text}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          More: {itinerary.tsaReminder.links.map((link) => link.label).join(', ')}
        </ThemedText>
      </Card>
      {itinerary.visaReminder && (
        <Card style={styles.visaCard}>
          <ThemedText type="subtitle">International flight</ThemedText>
          <ThemedText>{itinerary.visaReminder.text}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            More: {itinerary.visaReminder.links.map((link) => link.label).join(', ')}
          </ThemedText>
        </Card>
      )}
    </View>
  );
}

function PostSecurityStep({ itinerary, flight }: { itinerary: Itinerary; flight: FlightLookup }) {
  const { postSecurity } = itinerary;

  return (
    <View style={styles.stepBody}>
      <ThemedText themeColor="textSecondary">
        About {Math.max(postSecurity.minutesUntilBoarding, 0)} min until boarding (estimate).
      </ThemedText>
      <Button label={`Go to Gate ${flight.gate}`} onPress={() => router.push('/')} />
      <OptionButton
        label="Go to a quiet spot"
        option={postSecurity.quietOption}
        onPress={(placeId) => router.push({ pathname: '/map', params: { focus: placeId } })}
      />
      <OptionButton
        label="Get food"
        option={postSecurity.foodOption}
        onPress={(placeId) => router.push({ pathname: '/map', params: { focus: placeId } })}
      />
    </View>
  );
}

function OptionButton({
  label,
  option,
  onPress,
}: {
  label: string;
  option: { place: Place; canMakeIt: boolean } | null;
  onPress: (placeId: string) => void;
}) {
  if (!option) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {label}: not available near this gate.
      </ThemedText>
    );
  }

  if (!option.canMakeIt) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {label} ({option.place.name}): not enough time before boarding — heading to the gate is
        recommended.
      </ThemedText>
    );
  }

  return (
    <Button
      label={`${label}: ${option.place.name}`}
      variant="secondary"
      onPress={() => onPress(option.place.id)}
    />
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
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
  stepBody: {
    gap: Spacing.two,
  },
  yesNoRow: {
    gap: Spacing.one,
  },
  yesNoLabel: {
    marginBottom: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  visaCard: {
    backgroundColor: Colors.estimateFill,
  },
  listenButton: {
    minHeight: 120,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  listenButtonPressed: { opacity: 0.85 },
  listenLabel: { color: Colors.surface },
  listenNote: { textAlign: 'center' },
  navRow: { flexDirection: 'row' },
  navGap: { width: Spacing.two },
  navButton: { flex: 1 },
  navButtonDisabled: { opacity: 0.4 },
  needAMinuteCard: {
    backgroundColor: Colors.estimateFill,
    gap: Spacing.two,
  },
  needAMinutePhrase: { color: Colors.estimateText },
});
