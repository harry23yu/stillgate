import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { TerminalSchematic } from '@/components/terminal-schematic';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { estimateWalkMinutes, getAirport, YOU_POSITION } from '@/data/client';
import type { Airport, Place, PlaceType } from '@/data/types';

const FILTERS: { type: PlaceType; label: string }[] = [
  { type: 'quiet', label: 'Quiet spots' },
  { type: 'loud', label: 'Loud areas' },
  { type: 'service', label: 'Services' },
  { type: 'food', label: 'Food' },
];

// Hub x-coordinates are in the schematic's 4050-wide viewBox; jumpTo() scales
// them to the measured on-screen canvas width before scrolling.
const JUMP_TARGETS: { label: string; hubX: number }[] = [
  { label: 'Terminal 1', hubX: 160 },
  { label: 'Terminal 2', hubX: 1060 },
  { label: 'Terminal 3', hubX: 1960 },
  { label: 'International', hubX: 2860 }, // Area G hub, first Intl cluster in loop order
];

const PIN_ICON: Record<'quiet' | 'service' | 'food', 'moon.zzz.fill' | 'info.circle.fill' | 'fork.knife'> = {
  quiet: 'moon.zzz.fill',
  service: 'info.circle.fill',
  food: 'fork.knife',
};

const TYPE_LABEL: Record<PlaceType, string> = {
  quiet: 'Quiet spot',
  loud: 'Typically busy (estimate)',
  service: 'Service',
  food: 'Food spot',
};

// Keyed by Place.terminal (src/data/mock/sfo.ts). Both International Terminal
// boarding areas (G and A) map to the same human-readable label.
const TERMINAL_LABEL: Record<string, string> = {
  t1: 'Terminal 1',
  t2: 'Terminal 2',
  t3: 'Terminal 3',
  'intl-g': 'International Terminal',
  'intl-a': 'International Terminal',
};

type TerminalMapProps = { focusPlaceId?: string };

/**
 * Terminal schematic + filters + place details, shared by the full-screen
 * Map route and the Home embed. Owns no page chrome (no outer ThemedView,
 * SafeAreaView, title, or vertical ScrollView) — only the horizontal
 * ScrollView around the schematic canvas, which nests safely inside a
 * caller's own vertical scroll. See CLAUDE.md §4.
 */
export function TerminalMap({ focusPlaceId }: TerminalMapProps) {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<PlaceType, boolean>>({
    quiet: true,
    loud: true,
    service: true,
    food: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(focusPlaceId ?? null);
  const [highlightedId, setHighlightedId] = useState<string | null>(focusPlaceId ?? null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    getAirport('SFO').then(setAirport);
  }, []);

  const selectedPlace = useMemo(
    () => airport?.places.find((place) => place.id === selectedId) ?? null,
    [airport, selectedId],
  );

  if (!airport) {
    return null;
  }

  function toggleFilter(type: PlaceType) {
    setActiveFilters((current) => ({ ...current, [type]: !current[type] }));
  }

  function selectPlace(place: Place) {
    setSelectedId(place.id);
  }

  function handleTakeMeThere(place: Place) {
    setHighlightedId(place.id);
  }

  function handleReport(place: Place) {
    Alert.alert(
      'Thanks for the report',
      `This demo does not send reports yet, but in the full app this would flag "${place.name}" for review.`,
    );
  }

  function jumpTo(hubX: number) {
    const scale = canvasWidth / 4050;
    const target = Math.max(0, Math.min(hubX * scale - viewportWidth / 2, canvasWidth - viewportWidth));
    scrollRef.current?.scrollTo({ x: target, animated: true });
  }

  function handleCanvasLayout(event: LayoutChangeEvent) {
    setCanvasWidth(event.nativeEvent.layout.width);
  }

  function handleScrollViewportLayout(event: LayoutChangeEvent) {
    setViewportWidth(event.nativeEvent.layout.width);
  }

  const pins = airport.places.filter((place) => place.type !== 'loud' && activeFilters[place.type]);
  const loudZones = airport.places.filter((place) => place.type === 'loud' && activeFilters.loud);

  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {FILTERS.map((filter) => (
          <Chip
            key={filter.type}
            label={filter.label}
            selected={activeFilters[filter.type]}
            onPress={() => toggleFilter(filter.type)}
          />
        ))}
      </View>

      <View style={styles.chipRow}>
        {JUMP_TARGETS.map((target) => (
          <Chip
            key={target.label}
            label={target.label}
            selected={false}
            onPress={() => jumpTo(target.hubX)}
            accessibilityLabel={`Jump to ${target.label}`}
          />
        ))}
      </View>

      <View style={styles.schematicWrapper}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator
          style={styles.schematicScroll}
          onLayout={handleScrollViewportLayout}>
          <View style={styles.schematicCanvas} onLayout={handleCanvasLayout}>
            <TerminalSchematic />

            {loudZones.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => selectPlace(place)}
                accessibilityRole="button"
                accessibilityLabel={`${place.name}, typically busy, estimate`}
                style={[
                  styles.loudZone,
                  { left: `${place.x * 100}%`, top: `${place.y * 100}%` },
                  selectedId === place.id && styles.loudZoneSelected,
                ]}>
                <ThemedText type="small" style={styles.loudZoneLabel} numberOfLines={2}>
                  {place.name}
                </ThemedText>
              </Pressable>
            ))}

            {pins.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => selectPlace(place)}
                accessibilityRole="button"
                accessibilityLabel={`${TYPE_LABEL[place.type]}: ${place.name}`}
                hitSlop={8}
                style={[styles.pin, { left: `${place.x * 100}%`, top: `${place.y * 100}%` }]}>
                {highlightedId === place.id && <View style={styles.pinHighlightRing} />}
                <IconSymbol
                  name={PIN_ICON[place.type as 'quiet' | 'service' | 'food']}
                  size={26}
                  color={place.type === 'quiet' ? Colors.primary : Colors.border}
                />
              </Pressable>
            ))}

            <View style={[styles.pin, styles.youPin]}>
              <View style={styles.youDot} />
              <ThemedText type="small" style={styles.youLabel}>
                You
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.schematicCaption}>
        Drawn from public layout info, not SFO&apos;s official architectural plans.
      </ThemedText>

      <View style={styles.legend}>
        <LegendItem icon="moon.zzz.fill" color={Colors.primary} label="Quiet" />
        <LegendItem icon="info.circle.fill" color={Colors.border} label="Service" />
        <LegendItem icon="fork.knife" color={Colors.border} label="Food" />
        <LegendItem icon="square.dashed" color={Colors.estimateBorder} label="Loud (estimate)" />
      </View>

      {selectedPlace ? (
        <PlaceCard
          place={selectedPlace}
          onTakeMeThere={() => handleTakeMeThere(selectedPlace)}
          onReport={() => handleReport(selectedPlace)}
        />
      ) : (
        <Card>
          <ThemedText themeColor="textSecondary">Tap a pin or a busy zone to see details.</ThemedText>
        </Card>
      )}
    </View>
  );
}

function LegendItem({ icon, color, label }: { icon: 'moon.zzz.fill' | 'info.circle.fill' | 'fork.knife' | 'square.dashed'; color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <IconSymbol name={icon} size={16} color={color} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function PlaceCard({
  place,
  onTakeMeThere,
  onReport,
}: {
  place: Place;
  onTakeMeThere: () => void;
  onReport: () => void;
}) {
  const walkMinutes = estimateWalkMinutes(YOU_POSITION, place);
  const terminalLabel = TERMINAL_LABEL[place.terminal];

  return (
    <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{place.name}</ThemedText>
        <Pill variant={place.type === 'loud' ? 'estimate' : place.type === 'quiet' ? 'success' : 'neutral'}>
          {TYPE_LABEL[place.type]}
        </Pill>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {terminalLabel ? `${terminalLabel} · ${place.hours}` : place.hours}
      </ThemedText>
      <ThemedText>{place.notes}</ThemedText>
      {place.type !== 'loud' && (
        <ThemedText type="smallBold" themeColor="primary">
          ~{walkMinutes} min walk (estimate)
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Last verified {place.lastVerified}
      </ThemedText>
      <View style={styles.cardActions}>
        {place.type !== 'loud' && (
          <Button label="Take me there" onPress={onTakeMeThere} style={styles.cardButton} />
        )}
        <Button label="Report a problem" variant="secondary" onPress={onReport} style={styles.cardButton} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  schematicWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  schematicScroll: {
    height: 320,
  },
  schematicCanvas: {
    height: 320,
    aspectRatio: 4050 / 420,
    position: 'relative',
  },
  schematicCaption: {
    marginTop: Spacing.one,
  },
  pin: {
    position: 'absolute',
    transform: [{ translateX: -13 }, { translateY: -13 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHighlightRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
  },
  youPin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    transform: [{ translateX: -11 }, { translateY: -11 }],
  },
  youDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
  loudZone: {
    position: 'absolute',
    width: 96,
    height: 60,
    marginLeft: -48,
    marginTop: -30,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.estimateBorder,
    backgroundColor: Colors.estimateFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  loudZoneSelected: {
    borderWidth: 3,
  },
  loudZoneLabel: {
    color: Colors.estimateText,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cardButton: {
    flexGrow: 1,
  },
});
