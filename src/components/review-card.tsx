import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '../../convex/_generated/api';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Pill } from '@/components/pill';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { Confidence, PlaceType } from '@/data/types';

type Queue = FunctionReturnType<typeof api.review.queue>;
export type ReviewPlace = Queue['places'][number];
export type ReviewTerminal = Queue['terminals'][number];

const PLACE_TYPES: PlaceType[] = ['quiet', 'service', 'loud', 'food'];
const CONFIDENCE: Confidence[] = ['low', 'medium', 'high'];

type ReviewCardProps = {
  place: ReviewPlace;
  terminals: ReviewTerminal[];
  reviewKey: string;
};

/**
 * One scraped mention → one publishable Place. The form starts from the
 * last approved version if there is one, otherwise from the scrape plus the
 * gate-based position suggestion.
 */
export function ReviewCard({ place, terminals, reviewKey }: ReviewCardProps) {
  const approve = useMutation(api.review.approve);
  const reject = useMutation(api.review.reject);
  const { scraped, published, suggestion } = place;

  const [type, setType] = useState<PlaceType>(published?.type ?? scraped.type);
  const [name, setName] = useState(published?.name ?? scraped.name);
  const [hours, setHours] = useState(published?.hours ?? scraped.hours ?? 'Unknown');
  const [notes, setNotes] = useState(published?.notes ?? scraped.locationHint ?? '');
  const [terminal, setTerminal] = useState<string | null>(published?.terminal ?? suggestion.terminal);
  const [x, setX] = useState(formatFraction(published?.x ?? suggestion.x));
  const [y, setY] = useState(formatFraction(published?.y ?? suggestion.y));
  // Gate-derived positions are approximate; only a person on site makes it "high".
  const [confidence, setConfidence] = useState<Confidence>(
    published?.confidence ?? (suggestion.x !== null ? 'medium' : 'low'),
  );
  const [saving, setSaving] = useState(false);

  const sourceChanged = !!place.sourceChanged;

  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Could not save', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleApprove(splitOff: boolean) {
    const xValue = Number(x);
    const yValue = Number(y);
    if (!terminal) return Alert.alert('Pick a terminal', 'Choose which terminal this place is in.');
    if (x.trim() === '' || y.trim() === '' || !isFraction(xValue) || !isFraction(yValue)) {
      return Alert.alert('Place it on the map', 'x and y must be numbers between 0 and 1 across the floor plan.');
    }
    void run(() =>
      approve({
        reviewKey,
        placeId: place._id,
        splitOff,
        published: { type, name, terminal, x: xValue, y: yValue, hours, notes, confidence },
      }),
    );
  }

  return (
    <Card>
      <View style={styles.pills}>
        <Pill variant={place.status === 'approved' ? 'success' : 'neutral'}>{place.status}</Pill>
        {sourceChanged && <Pill variant="estimate">Source changed since approval</Pill>}
        {place.missingFromSource && <Pill variant="estimate">No longer on source page</Pill>}
        {place.reverifyDue && <Pill variant="estimate">{`Re-verify (last ${place.lastVerified ?? 'unknown'})`}</Pill>}
        {scraped.securitySide && <Pill>{`${scraped.securitySide}-security`}</Pill>}
      </View>

      <ThemedText type="subtitle">{scraped.name}</ThemedText>

      <View style={styles.section}>
        <ThemedText type="smallBold">From the source page</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {scraped.excerpt}
        </ThemedText>
        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync(place.sourceUrl)}
          accessibilityRole="link"
          accessibilityLabel="Open source page"
          hitSlop={8}>
          <ThemedText type="smallBold" themeColor="primary">
            {place.sourceUrl}
          </ThemedText>
        </Pressable>
      </View>

      {sourceChanged && published && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Published now</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Hours: {published.hours} → scraped: {scraped.hours ?? 'none found'}
          </ThemedText>
        </View>
      )}

      <ChipRow label="Type" options={PLACE_TYPES} value={type} onChange={setType} />
      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField label="Hours" value={hours} onChangeText={setHours} />
      <TextField label="Notes shown to travelers" value={notes} onChangeText={setNotes} />

      <View style={styles.section}>
        <ThemedText type="smallBold">Terminal</ThemedText>
        <View style={styles.chips}>
          {terminals.map((t) => (
            <Chip key={t.id} label={t.name} selected={terminal === t.id} onPress={() => setTerminal(t.id)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" themeColor="textSecondary">
          Suggested position: {suggestion.basis}
        </ThemedText>
        <View style={styles.coords}>
          <View style={styles.coord}>
            <TextField label="x (0–1)" value={x} onChangeText={setX} />
          </View>
          <View style={styles.coord}>
            <TextField label="y (0–1)" value={y} onChangeText={setY} />
          </View>
        </View>
      </View>

      <ChipRow label="Confidence" options={CONFIDENCE} value={confidence} onChange={setConfidence} />

      <View style={styles.actions}>
        <Button label="Approve and publish" onPress={() => handleApprove(false)} disabled={saving} />
        <Button
          label="Publish as a separate place"
          variant="secondary"
          onPress={() => handleApprove(true)}
          disabled={saving}
          accessibilityHint="Keeps this mention in the queue so you can publish another place from it"
        />
        <Button
          label={place.status === 'approved' ? 'Unpublish' : 'Reject'}
          variant="ghost"
          onPress={() => void run(() => reject({ reviewKey, placeId: place._id }))}
          disabled={saving}
        />
      </View>
    </Card>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip key={option} label={option} selected={value === option} onPress={() => onChange(option)} />
        ))}
      </View>
    </View>
  );
}

function formatFraction(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : value.toFixed(3);
}

function isFraction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  coords: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  coord: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralFill,
    paddingTop: Spacing.three,
  },
});
