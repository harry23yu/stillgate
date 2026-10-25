import { useQuery } from 'convex/react';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../convex/_generated/api';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { ReviewCard } from '@/components/review-card';
import { SourceHealth } from '@/components/source-health';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { AirportCode } from '@/data/types';
import { convex } from '@/lib/convex';

/**
 * Internal reviewer screen (not linked from the traveler UI; open /review).
 * Scraped drafts only reach travelers after someone approves them here.
 */

const AIRPORTS: AirportCode[] = ['SFO', 'CHS'];
type QueueView = 'needsReview' | 'approved';

export default function ReviewScreen() {
  const [keyInput, setKeyInput] = useState('');
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [airportCode, setAirportCode] = useState<AirportCode>('SFO');
  const [view, setView] = useState<QueueView>('needsReview');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Review places</ThemedText>

          {!convex ? (
            <Card>
              <ThemedText>
                No backend configured. Run `npx convex dev` so EXPO_PUBLIC_CONVEX_URL is set, then restart Expo.
              </ThemedText>
            </Card>
          ) : !reviewKey ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                The review key is the password set with `npx convex env set REVIEW_KEY …` (not an airport code). You
                choose the airport on the next screen.
              </ThemedText>
              <TextField label="Review key" value={keyInput} onChangeText={setKeyInput} autoCapitalize="none" />
              <Button label="Open queue" onPress={() => setReviewKey(keyInput.trim())} disabled={!keyInput.trim()} />
            </Card>
          ) : (
            <>
              <View style={styles.chips}>
                {AIRPORTS.map((code) => (
                  <Chip key={code} label={code} selected={airportCode === code} onPress={() => setAirportCode(code)} />
                ))}
              </View>
              <SourceHealth reviewKey={reviewKey} airportCode={airportCode} />
              <View style={styles.chips}>
                <Chip label="Needs review" selected={view === 'needsReview'} onPress={() => setView('needsReview')} />
                <Chip label="Published" selected={view === 'approved'} onPress={() => setView('approved')} />
              </View>
              <Queue reviewKey={reviewKey} airportCode={airportCode} view={view} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Queue({ reviewKey, airportCode, view }: { reviewKey: string; airportCode: AirportCode; view: QueueView }) {
  const queue = useQuery(api.review.queue, { reviewKey, airportCode, view });

  if (queue === undefined) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Loading…
      </ThemedText>
    );
  }
  if (queue.places.length === 0) {
    return (
      <Card>
        <ThemedText>{view === 'needsReview' ? 'Nothing waiting for review.' : 'Nothing published yet.'}</ThemedText>
      </Card>
    );
  }
  return (
    <>
      {queue.places.map((place) => (
        // Keyed on the scrape too, so the form resets when new source text arrives.
        <ReviewCard
          key={`${place._id}:${place.scraped.pageId}`}
          place={place}
          terminals={queue.terminals}
          reviewKey={reviewKey}
        />
      ))}
    </>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={12}>
        <ThemedText type="smallBold" themeColor="primary">
          Close
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** A wrong review key makes the query throw; land here and let the reviewer retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.content}>
          <ThemedText type="title">Review places</ThemedText>
          <Card>
            <ThemedText>
              {error.message.includes('Invalid review key') ? 'That review key was not accepted.' : error.message}
            </ThemedText>
            <Button label="Try again" onPress={retry} />
          </Card>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
