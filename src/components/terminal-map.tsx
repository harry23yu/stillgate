import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { estimateWalkMinutes, getAirport, getFlightStatus, YOU_POSITION } from '@/data/client';
import { getSavedFlight } from '@/data/saved-flight';
import type { Airport, FlightLookup, Place, PlaceType } from '@/data/types';
import { focusForGate, mapPointForGate, mapPointForPlace, SFO_MAP_IMAGE_SIZE, type AirportMapFocus } from '@/lib/sfo-map-layout';

const FILTERS: { type: PlaceType; label: string }[] = [
  { type: 'quiet', label: 'Quiet spots' },
  { type: 'loud', label: 'Loud areas' },
  { type: 'service', label: 'Services' },
  { type: 'food', label: 'Food' },
];

const TERMINALS: { id: AirportMapFocus; label: string }[] = [
  { id: 'all', label: 'Whole airport' },
  { id: 't1', label: 'Terminal 1' },
  { id: 't2', label: 'Terminal 2' },
  { id: 't3', label: 'Terminal 3' },
  { id: 'intl', label: 'International' },
];

const FOCUS_CENTERS: Partial<Record<AirportMapFocus, { x: number; y: number }>> = {
  t1: { x: 1310, y: 590 },
  t2: { x: 820, y: 225 },
  t3: { x: 275, y: 545 },
  intl: { x: 820, y: 1030 },
};

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
    loud: false,
    service: false,
    food: false,
  });
  const [selectedId, setSelectedId] = useState<string | null>(focusPlaceId ?? null);
  const [highlightedId, setHighlightedId] = useState<string | null>(focusPlaceId ?? null);
  const [mapFocus, setMapFocus] = useState<AirportMapFocus>('all');
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const horizontalScroll = useRef<ScrollViewInstance>(null);
  const verticalScroll = useRef<ScrollViewInstance>(null);
  const scrollOffsets = useRef({ x: 0, y: 0 });
  const previousView = useRef({ focus: mapFocus, zoom });

  useEffect(() => {
    getAirport('SFO').then(setAirport);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSavedFlight().then(async (saved) => {
        if (!saved) {
          if (active) setFlight(null);
          return;
        }
        const result = await getFlightStatus(saved.flightNumber, saved.date);
        if (active) setFlight(result);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const imageAspectRatio = SFO_MAP_IMAGE_SIZE.width / SFO_MAP_IMAGE_SIZE.height;
  const baseImageWidth = Math.min(viewport.width, viewport.height * imageAspectRatio);
  const imageWidth = baseImageWidth * zoom;
  const imageHeight = imageWidth / imageAspectRatio;
  const contentWidth = Math.max(viewport.width, imageWidth);
  const contentHeight = Math.max(viewport.height, imageHeight);
  const imageLeft = Math.max(0, (contentWidth - imageWidth) / 2);
  const imageTop = Math.max(0, (contentHeight - imageHeight) / 2);
  const imageLayout = { left: imageLeft, top: imageTop, width: imageWidth, height: imageHeight };

  useEffect(() => {
    if (!viewport.width || !viewport.height) return;
    const focusChanged = previousView.current.focus !== mapFocus;
    const previousZoom = previousView.current.zoom;
    const zoomChanged = previousZoom !== zoom;
    previousView.current = { focus: mapFocus, zoom };
    const center = FOCUS_CENTERS[mapFocus];
    const timer = setTimeout(() => {
      if (!focusChanged && zoomChanged) {
        const previousWidth = baseImageWidth * previousZoom;
        const previousHeight = previousWidth / imageAspectRatio;
        const previousContentWidth = Math.max(viewport.width, previousWidth);
        const previousContentHeight = Math.max(viewport.height, previousHeight);
        const previousLeft = Math.max(0, (previousContentWidth - previousWidth) / 2);
        const previousTop = Math.max(0, (previousContentHeight - previousHeight) / 2);
        const imageX = Math.max(0, Math.min(1,
          (scrollOffsets.current.x + viewport.width / 2 - previousLeft) / previousWidth,
        ));
        const imageY = Math.max(0, Math.min(1,
          (scrollOffsets.current.y + viewport.height / 2 - previousTop) / previousHeight,
        ));
        horizontalScroll.current?.scrollTo({
          x: imageLeft + imageX * imageWidth - viewport.width / 2,
          animated: true,
        });
        verticalScroll.current?.scrollTo({
          y: imageTop + imageY * imageHeight - viewport.height / 2,
          animated: true,
        });
        return;
      }
      if (!center || mapFocus === 'all') {
        horizontalScroll.current?.scrollTo({ x: 0, animated: true });
        verticalScroll.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      horizontalScroll.current?.scrollTo({
        x: imageLeft + (center.x / SFO_MAP_IMAGE_SIZE.width) * imageWidth - viewport.width / 2,
        animated: true,
      });
      verticalScroll.current?.scrollTo({
        y: imageTop + (center.y / SFO_MAP_IMAGE_SIZE.height) * imageHeight - viewport.height / 2,
        animated: true,
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [baseImageWidth, imageAspectRatio, imageHeight, imageLeft, imageTop, imageWidth, mapFocus, viewport.height, viewport.width, zoom]);

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
    focusMap(place.terminal.startsWith('intl-') ? 'intl' : (place.terminal as AirportMapFocus));
  }

  function focusMap(next: AirportMapFocus) {
    setMapFocus(next);
    setSelectedId(null);
    setZoom(next === 'all' ? 1 : 1.8);
  }

  function onMapLayout(event: LayoutChangeEvent) {
    setViewport({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  }

  function handleReport(place: Place) {
    Alert.alert(
      'Thanks for the report',
      `This demo does not send reports yet, but in the full app this would flag "${place.name}" for review.`,
    );
  }

  const isInFocus = (place: Place) =>
    mapFocus === 'all' || place.terminal === mapFocus || (mapFocus === 'intl' && place.terminal.startsWith('intl-'));
  const pins = airport.places.filter((place) => place.type !== 'loud' && activeFilters[place.type] && isInFocus(place));
  const loudZones = airport.places.filter((place) => place.type === 'loud' && activeFilters.loud && isInFocus(place));
  const gatePoint = flight ? mapPointForGate(flight.gate) : null;
  const flightFocus = flight ? focusForGate(flight.gate) : null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {FILTERS.map((filter) => (
          <Chip
            key={filter.type}
            label={filter.label}
            selected={activeFilters[filter.type]}
            onPress={() => toggleFilter(filter.type)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TERMINALS.map((target) => (
          <Chip
            key={target.id}
            label={target.label}
            selected={mapFocus === target.id}
            onPress={() => focusMap(target.id)}
            accessibilityLabel={`Show ${target.label}`}
          />
        ))}
      </ScrollView>

      {flight && flightFocus && (
        <Pressable onPress={() => focusMap(flightFocus)} accessibilityRole="button" style={styles.flightShortcut}>
          <IconSymbol name="airplane" size={16} color={Colors.primary} />
          <ThemedText type="smallBold" themeColor="primary">{`My flight · ${flight.flight} · Gate ${flight.gate}`}</ThemedText>
          <IconSymbol name="chevron.right" size={14} color={Colors.primary} />
        </Pressable>
      )}

      <View style={styles.mapTools}>
        <ThemedText type="small" themeColor="textSecondary">Zoom in for gate details, then drag to explore.</ThemedText>
        <View style={styles.zoomControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" accessibilityState={{ disabled: zoom <= 1 }} disabled={zoom <= 1} onPress={() => setZoom((value) => Math.max(1, Number((value - 0.4).toFixed(1))))} style={[styles.zoomButton, zoom <= 1 && styles.zoomButtonDisabled]}>
            <IconSymbol name="minus" size={18} color={Colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" accessibilityState={{ disabled: zoom >= 2.6 }} disabled={zoom >= 2.6} onPress={() => setZoom((value) => Math.min(2.6, Number((value + 0.4).toFixed(1))))} style={[styles.zoomButton, zoom >= 2.6 && styles.zoomButtonDisabled]}>
            <IconSymbol name="plus" size={18} color={Colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Show whole airport" onPress={() => focusMap('all')} style={styles.zoomButton}>
            <IconSymbol name="arrow.counterclockwise" size={17} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.schematicWrapper}>
        <View style={styles.mapViewport} onLayout={onMapLayout}>
          {viewport.width > 0 && (
            <ScrollView
              ref={horizontalScroll}
              horizontal
              bounces={false}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(event) => { scrollOffsets.current.x = event.nativeEvent.contentOffset.x; }}
              contentContainerStyle={{ width: contentWidth, height: viewport.height }}>
              <ScrollView
                ref={verticalScroll}
                nestedScrollEnabled
                bounces={false}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(event) => { scrollOffsets.current.y = event.nativeEvent.contentOffset.y; }}
                style={{ width: contentWidth, height: viewport.height }}
                contentContainerStyle={{ width: contentWidth, height: contentHeight }}>
                <View style={{ width: contentWidth, height: contentHeight, position: 'relative' }}>
                  <Image
                    source={require('../../assets/images/sfo-airport-overview.png')}
                    resizeMode="contain"
                    style={[styles.airportImage, { left: imageLeft, top: imageTop, width: imageWidth, height: imageHeight }]}
                    accessible
                    accessibilityLabel="SFO airport overview showing terminals, gates, garages, and AirTrain connections"
                  />

            {loudZones.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => selectPlace(place)}
                accessibilityRole="button"
                accessibilityLabel={`${place.name}, typically busy, estimate`}
                style={[
                  styles.loudZone,
                  mapPositionStyle(mapPointForPlace(place), imageLayout),
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
                style={[styles.pin, mapPositionStyle(mapPointForPlace(place), imageLayout)]}>
                {highlightedId === place.id && <View style={styles.pinHighlightRing} />}
                <IconSymbol
                  name={PIN_ICON[place.type as 'quiet' | 'service' | 'food']}
                  size={26}
                  color={place.type === 'quiet' ? Colors.primary : Colors.border}
                />
              </Pressable>
            ))}

            {gatePoint && flight && (
              <View style={[styles.flightGateMarker, mapPositionStyle(gatePoint, imageLayout)]}>
                <View style={styles.flightGateDot} />
                <ThemedText type="smallBold" style={styles.flightGateLabel}>{flight.gate}</ThemedText>
              </View>
            )}
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.schematicCaption}>
        Airport overview shown as provided. Place and gate markers are approximate.
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
          from={gatePoint ?? {
            x: YOU_POSITION.x * SFO_MAP_IMAGE_SIZE.width,
            y: YOU_POSITION.y * SFO_MAP_IMAGE_SIZE.height,
          }}
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

function mapPositionStyle(
  point: { x: number; y: number },
  image: { left: number; top: number; width: number; height: number },
) {
  return {
    left: image.left + (point.x / SFO_MAP_IMAGE_SIZE.width) * image.width,
    top: image.top + (point.y / SFO_MAP_IMAGE_SIZE.height) * image.height,
  };
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
  from,
  onTakeMeThere,
  onReport,
}: {
  place: Place;
  from: { x: number; y: number };
  onTakeMeThere: () => void;
  onReport: () => void;
}) {
  const destination = mapPointForPlace(place);
  const walkMinutes = estimateWalkMinutes(
    { x: from.x / SFO_MAP_IMAGE_SIZE.width, y: from.y / SFO_MAP_IMAGE_SIZE.height },
    { x: destination.x / SFO_MAP_IMAGE_SIZE.width, y: destination.y / SFO_MAP_IMAGE_SIZE.height },
  );
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
    flexWrap: 'nowrap',
    gap: Spacing.two,
  },
  schematicWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  mapViewport: { height: 380, width: '100%' },
  airportImage: { position: 'absolute' },
  mapTools: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  zoomButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.neutralFill },
  zoomButtonDisabled: { opacity: 0.45 },
  flightShortcut: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  flightGateMarker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  flightGateDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.youMarker,
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  flightGateLabel: {
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
