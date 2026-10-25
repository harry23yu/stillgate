import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getAirport, getFlightStatus, getSupportedAirportCode } from '@/data/client';
import { buildItinerary, type Itinerary } from '@/data/itinerary';
import { buildGuideNarration } from '@/data/guide-narration';
import { defaultProfile, getProfile } from '@/data/profile';
import { getSavedFlight } from '@/data/saved-flight';
import { defaultTripDetails, getTripDetails, saveTripDetails, type TripDetails } from '@/data/trip-details';
import type { Airport, FlightLookup, Place, Profile } from '@/data/types';
import { formatTime } from '@/lib/format';
import { useGuideAudio } from '@/hooks/use-guide-audio';
import { useTheme } from '@/hooks/use-theme';

const NEED_A_MINUTE_PHRASE =
  "I'm overwhelmed right now and need a quiet moment. Could you help me find a calm place nearby?";

const STEP_TITLES = ['Trip details', 'Leave-by time', 'Checkpoint', 'Before security', 'After security'];
const GUIDE_STEP_IDS = ['trip', 'arrival', 'checkpoint', 'security', 'post-security'] as const;

export default function CalmGuideScreen() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [tripDetails, setTripDetails] = useState<TripDetails>(defaultTripDetails);
  const [stepIndex, setStepIndex] = useState(0);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const audio = useGuideAudio();
  const theme = useTheme();

  useEffect(() => {
    let active = true;
    async function loadTrip() {
      try {
        const [storedProfile, storedTripDetails, saved] = await Promise.all([
          getProfile(),
          getTripDetails(),
          getSavedFlight(),
        ]);
        if (!active) return;
        setProfile(storedProfile);
        setTripDetails(storedTripDetails);
        if (saved) {
          const result = saved.lookup ?? await getFlightStatus(saved.flightNumber, saved.date, saved.originCode);
          if (!active) return;
          setFlight(result);
          const airportCode = getSupportedAirportCode(result?.origin.code);
          if (airportCode) {
            const airportResult = await getAirport(airportCode);
            if (active) setAirport(airportResult);
          }
        }
      } finally {
        if (active) setLoadingTrip(false);
      }
    }
    void loadTrip();
    return () => {
      active = false;
    };
  }, []);

  const itinerary = useMemo<Itinerary | null>(() => {
    if (!airport || !flight) return null;
    return buildItinerary(airport, flight, tripDetails, profile, new Date());
  }, [airport, flight, tripDetails, profile]);

  const narration = useMemo(() => {
    if (!flight || !itinerary) return null;
    return buildGuideNarration(GUIDE_STEP_IDS[stepIndex], itinerary, flight);
  }, [flight, itinerary, stepIndex]);

  if (flight && !getSupportedAirportCode(flight.origin.code)) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.emptyState}>
            <ThemedText type="eyebrow" themeColor="textSecondary">Flight saved</ThemedText>
            <ThemedText type="title">We don’t have a {flight.origin.code} airport guide yet</ThemedText>
            <ThemedText themeColor="textSecondary">
              Your flight details are saved. We need a verified terminal map before we can give reliable walking directions for this airport.
            </ThemedText>
            <Button label="Explore airport map" onPress={() => router.push('/map')} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loadingTrip) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">Loading your trip…</ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

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
    if (narration) void audio.toggle(narration);
  }

  function handleBack() {
    audio.stop();
    setStepIndex((index) => Math.max(0, index - 1));
  }

  async function handleNext() {
    audio.stop();
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
            disabled={audio.state === 'loading'}
            accessibilityRole="button"
            accessibilityLabel={audio.state === 'playing' ? 'Pause guide audio' : 'Listen to this step with Cartesia'}
            style={({ pressed }) => [styles.listenButton, { backgroundColor: theme.primary }, pressed && styles.listenButtonPressed]}>
            <IconSymbol name={audio.state === 'playing' ? 'pause.fill' : 'waveform'} size={32} color={theme.surface} />
            <ThemedText type="subtitle" style={{ color: theme.surface }}>
              {audio.state === 'loading'
                ? 'Preparing audio…'
                : audio.state === 'playing'
                  ? 'Pause guide'
                  : audio.state === 'paused'
                    ? 'Resume guide'
                    : audio.state === 'finished'
                      ? 'Listen again'
                      : 'Listen'}
            </ThemedText>
          </Pressable>
          {audio.state === 'playing' || audio.state === 'paused' ? (
            <Button label="Stop audio" variant="secondary" onPress={audio.stop} />
          ) : null}
          <ThemedText type="small" themeColor="textSecondary" style={styles.listenNote}>
            {audio.error ?? 'A calm Cartesia voice reads this step aloud.'}
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

          <Card style={[styles.needAMinuteCard, { backgroundColor: theme.estimateFill }]}>
            <View style={styles.rowCenter}>
              <IconSymbol name="hand.raised.fill" size={18} color={theme.estimateText} />
              <ThemedText type="smallBold" themeColor="textSecondary">
                Need a minute?
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={{ color: theme.estimateText }}>
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
  const theme = useTheme();
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
        <Card style={{ backgroundColor: theme.estimateFill }}>
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
  listenButton: {
    minHeight: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  listenButtonPressed: { opacity: 0.85 },
  listenNote: { textAlign: 'center' },
  navRow: { flexDirection: 'row' },
  navGap: { width: Spacing.two },
  navButton: { flex: 1 },
  navButtonDisabled: { opacity: 0.4 },
  needAMinuteCard: {
    gap: Spacing.two,
  },
});
