import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Image, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { estimateWalkMinutes, getAirport, YOU_POSITION } from '@/data/client';
import type { Airport, AirportCode, FlightLookup, Place, PlaceType } from '@/data/types';
import { formatDateTime } from '@/lib/format';
import { focusForGate, mapPointForGate, mapPointForPlace, MAP_IMAGE_SIZE, type AirportMapFocus, type MapPoint } from '@/lib/sfo-map-layout';
import { notify } from '@/lib/notify';
import { api } from '../../convex/_generated/api';

// Live traveler "is this still accurate?" reports are backed by Convex. Only airports seeded into
// the Convex "airports" table accept reports today (the SFO sample); others fall back to a static note.
const hasConvex = Boolean(process.env.EXPO_PUBLIC_CONVEX_URL);
const REPORTS_ENABLED_AIRPORTS: AirportCode[] = ['SFO'];

// shared/data/sfo.json seeds spot ids prefixed with the airport code
// (local "sensory-room-t1" -> seeded "sfo-sensory-room-t1"). Map local -> seeded until the two are unified.
function convexSpotId(airportCode: AirportCode, place: Place): string {
  return `${airportCode.toLowerCase()}-${place.id}`;
}

const FILTERS: { type: PlaceType; label: string }[] = [
  { type: 'quiet', label: 'Quiet spots' },
  { type: 'loud', label: 'Loud areas' },
  { type: 'service', label: 'Services' },
  { type: 'food', label: 'Food' },
];

const TERMINALS: Record<AirportCode, { id: AirportMapFocus; label: string }[]> = {
  SFO: [
    { id: 'all', label: 'Whole airport' },
    { id: 't1', label: 'Terminal 1' },
    { id: 't2', label: 'Terminal 2' },
    { id: 't3', label: 'Terminal 3' },
    { id: 'intl', label: 'International' },
  ],
  CHS: [
    { id: 'all', label: 'Whole airport' },
    { id: 'concourse-a', label: 'Concourse A' },
    { id: 'concourse-b', label: 'Concourse B' },
  ],
};

const AIRPORT_MAP_IMAGES: Record<AirportCode, ImageSourcePropType> = {
  SFO: require('../../assets/images/sfo-airport-overview.png'),
  CHS: require('../../assets/images/chs-airport-overview.png'),
};

const FOCUS_CENTERS: Partial<Record<AirportMapFocus, { x: number; y: number }>> = {
  t1: { x: 1310, y: 590 },
  t2: { x: 820, y: 225 },
  t3: { x: 275, y: 545 },
  intl: { x: 820, y: 1030 },
  'concourse-a': { x: 1640, y: 440 },
  'concourse-b': { x: 730, y: 300 },
};

const PIN_ICON: Record<'quiet' | 'service' | 'food', 'moon.zzz.fill' | 'info.circle.fill' | 'fork.knife'> = {
  quiet: 'moon.zzz.fill',
  service: 'info.circle.fill',
  food: 'fork.knife',
};

const TYPE_LABEL: Record<PlaceType, string> = {
  quiet: 'Quiet spot',
  loud: 'Busy area · estimate',
  service: 'Service',
  food: 'Food spot',
};

const CHS_TYPE_LABEL: Record<PlaceType, string> = {
  quiet: 'Sample quiet spot',
  loud: 'Busy area · sample',
  service: 'Sample service',
  food: 'Sample food',
};

// Keyed by Place.terminal (src/data/mock/sfo.ts). Both International Terminal
// boarding areas (G and A) map to the same human-readable label.
const TERMINAL_LABEL: Record<string, string> = {
  t1: 'Terminal 1',
  t2: 'Terminal 2',
  t3: 'Terminal 3',
  'intl-g': 'International Terminal',
  'intl-a': 'International Terminal',
  'concourse-a': 'Concourse A',
  'concourse-b': 'Concourse B',
};

type TerminalMapProps = {
  airportCode: AirportCode;
  flight: FlightLookup | null;
  focusPlaceId?: string;
};

/**
 * Terminal schematic + filters + place details, shared by the full-screen
 * Map route and the Home embed. Owns no page chrome (no outer ThemedView,
 * SafeAreaView, title, or vertical ScrollView) — only the horizontal
 * ScrollView around the schematic canvas, which nests safely inside a
 * caller's own vertical scroll. See CLAUDE.md §4.
 */
export function TerminalMap({ airportCode, flight, focusPlaceId }: TerminalMapProps) {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<PlaceType, boolean>>(() => ({
    quiet: true,
    loud: airportCode === 'CHS',
    service: airportCode === 'CHS',
    food: airportCode === 'CHS',
  }));
  const [selectedId, setSelectedId] = useState<string | null>(focusPlaceId ?? null);
  const [selectedCluster, setSelectedCluster] = useState<Place[] | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(focusPlaceId ?? null);
  const [mapFocus, setMapFocus] = useState<AirportMapFocus>('all');
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const horizontalScroll = useRef<ScrollViewInstance>(null);
  const verticalScroll = useRef<ScrollViewInstance>(null);
  const scrollOffsets = useRef({ x: 0, y: 0 });
  const previousView = useRef({ focus: mapFocus, zoom });

  useEffect(() => {
    let active = true;
    getAirport(airportCode).then((result) => {
      if (active) setAirport(result);
    });
    return () => {
      active = false;
    };
  }, [airportCode]);

  const imageSize = MAP_IMAGE_SIZE[airportCode];
  const imageAspectRatio = imageSize.width / imageSize.height;
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
        x: imageLeft + (center.x / imageSize.width) * imageWidth - viewport.width / 2,
        animated: true,
      });
      verticalScroll.current?.scrollTo({
        y: imageTop + (center.y / imageSize.height) * imageHeight - viewport.height / 2,
        animated: true,
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [airportCode, baseImageWidth, imageAspectRatio, imageHeight, imageLeft, imageSize.height, imageSize.width, imageTop, imageWidth, mapFocus, viewport.height, viewport.width, zoom]);

  const selectedPlace = useMemo(
    () => airport?.places.find((place) => place.id === selectedId) ?? null,
    [airport, selectedId],
  );

  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!airport) {
    return null;
  }

  function toggleFilter(type: PlaceType) {
    setActiveFilters((current) => ({ ...current, [type]: !current[type] }));
    setSelectedId(null);
    setSelectedCluster(null);
  }

  function selectPlace(place: Place) {
    setSelectedId(place.id);
    setSelectedCluster(null);
  }

  function selectCluster(places: Place[]) {
    setSelectedId(null);
    setSelectedCluster(places);
  }

  function handleTakeMeThere(place: Place) {
    setHighlightedId(place.id);
    focusMap(place.terminal.startsWith('intl-') ? 'intl' : (place.terminal as AirportMapFocus));
  }

  function focusMap(next: AirportMapFocus) {
    setMapFocus(next);
    setSelectedId(null);
    setSelectedCluster(null);
    setZoom(next === 'all' ? 1 : 1.8);
  }

  function onMapLayout(event: LayoutChangeEvent) {
    setViewport({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  }

  function handleReport(place: Place) {
    notify(
      'Thanks for the report',
      `This demo does not send reports yet, but in the full app this would flag "${place.name}" for review.`,
    );
  }

  const isInFocus = (place: Place) =>
    mapFocus === 'all' || place.terminal === mapFocus || (mapFocus === 'intl' && place.terminal.startsWith('intl-'));
  const pins = airport.places.filter((place) => place.type !== 'loud' && activeFilters[place.type] && isInFocus(place));
  const loudZones = airport.places.filter((place) => place.type === 'loud' && activeFilters.loud && isInFocus(place));
  const markerGroups = clusterPlaceMarkers([...loudZones, ...pins], imageLayout, imageSize, airportCode);
  const gatePoint = flight?.gate ? mapPointForGate(flight.gate, airportCode) : null;
  const flightFocus = flight?.gate ? focusForGate(flight.gate, airportCode) : null;

  return (
    <View style={styles.container}>
      {!airport.verified && (
        <View style={styles.demoNotice}>
          <IconSymbol name="info.circle.fill" size={18} color={theme.primary} />
          <View style={styles.demoNoticeCopy}>
            <ThemedText type="smallBold">
              {airportCode === 'CHS' ? 'Charleston demo map' : 'Approximate map locations'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {airportCode === 'CHS'
                ? 'The map is from CHS. Place pins are examples and haven’t been verified.'
                : 'Place and gate markers are approximate. Check airport signs for current directions.'}
            </ThemedText>
          </View>
        </View>
      )}

      {airport.dataSource === 'cached' && airport.dataFetchedAt && (
        <View style={styles.demoNotice} accessibilityRole="text">
          <IconSymbol name="arrow.down.circle.fill" size={18} color={theme.primary} />
          <View style={styles.demoNoticeCopy}>
            <ThemedText type="smallBold">Using places saved on your phone</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              We couldn’t reach Stillgate just now, so this shows what you saved on {formatDateTime(airport.dataFetchedAt)}.
            </ThemedText>
          </View>
        </View>
      )}

      <View style={styles.sectionHeading}>
        <ThemedText type="smallBold">Places on the map</ThemedText>
      </View>
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

      <View style={styles.sectionHeading}>
        <ThemedText type="smallBold">Airport areas</ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TERMINALS[airportCode].map((target) => (
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
          <IconSymbol name="airplane" size={16} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary">{`My flight · ${flight.flight} · Gate ${flight.gate}`}</ThemedText>
          <IconSymbol name="chevron.right" size={14} color={theme.primary} />
        </Pressable>
      )}

      <View style={styles.mapTools}>
        <ThemedText type="small" themeColor="textSecondary">Zoom in for gate details, then drag to explore.</ThemedText>
        <View style={styles.zoomControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" accessibilityState={{ disabled: zoom <= 1 }} disabled={zoom <= 1} onPress={() => { setSelectedCluster(null); setSelectedId(null); setZoom((value) => Math.max(1, Number((value - 0.4).toFixed(1)))); }} style={[styles.zoomButton, zoom <= 1 && styles.zoomButtonDisabled]}>
            <IconSymbol name="minus" size={18} color={theme.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" accessibilityState={{ disabled: zoom >= 2.6 }} disabled={zoom >= 2.6} onPress={() => { setSelectedCluster(null); setSelectedId(null); setZoom((value) => Math.min(2.6, Number((value + 0.4).toFixed(1)))); }} style={[styles.zoomButton, zoom >= 2.6 && styles.zoomButtonDisabled]}>
            <IconSymbol name="plus" size={18} color={theme.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Show whole airport" onPress={() => focusMap('all')} style={styles.zoomButton}>
            <IconSymbol name="arrow.counterclockwise" size={17} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.schematicWrapper}>
        <View style={[styles.mapViewport, airportCode === 'CHS' && styles.wideMapViewport]} onLayout={onMapLayout}>
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
                    source={AIRPORT_MAP_IMAGES[airportCode]}
                    resizeMode="contain"
                    style={[styles.airportImage, { left: imageLeft, top: imageTop, width: imageWidth, height: imageHeight }]}
                    accessible
                    accessibilityLabel={`${airport.name} airport overview map`}
                  />

            {markerGroups.map((group) => {
              const key = group.places.map((place) => place.id).join(':');
              if (group.places.length > 1) {
                return (
                  <Pressable
                    key={key}
                    onPress={() => selectCluster(group.places)}
                    accessibilityRole="button"
                    accessibilityLabel={`${group.places.length} nearby places. Tap to choose one.`}
                    accessibilityHint="Opens a list of places at this map location."
                    style={[styles.placeCluster, mapPositionStyle(group.point, imageLayout, imageSize)]}>
                    <ThemedText type="smallBold" style={styles.placeClusterCount}>{group.places.length}</ThemedText>
                  </Pressable>
                );
              }

              const [place] = group.places;
              if (place.type === 'loud') {
                return (
                  <Pressable
                    key={place.id}
                    onPress={() => selectPlace(place)}
                    accessibilityRole="button"
                    accessibilityLabel={airportCode === 'CHS'
                      ? `${place.name}, sample busy area, not measured`
                      : `${place.name}, typically busy, estimate`}
                    style={[
                      styles.loudZone,
                      mapPositionStyle(group.point, imageLayout, imageSize),
                      selectedId === place.id && styles.loudZoneSelected,
                    ]}>
                    <IconSymbol name="waveform" size={15} color={theme.estimateText} />
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={place.id}
                  onPress={() => selectPlace(place)}
                  accessibilityRole="button"
                  accessibilityLabel={`${airportCode === 'CHS' ? CHS_TYPE_LABEL[place.type] : TYPE_LABEL[place.type]}: ${place.name}`}
                  hitSlop={8}
                  style={[styles.pin, mapPositionStyle(group.point, imageLayout, imageSize)]}>
                  {highlightedId === place.id && <View style={styles.pinHighlightRing} />}
                  <IconSymbol
                    name={PIN_ICON[place.type]}
                    size={26}
                    color={place.type === 'quiet' ? theme.primary : theme.border}
                  />
                </Pressable>
              );
            })}

            {gatePoint && flight && (
              <View style={[styles.flightGateMarker, mapPositionStyle(gatePoint, imageLayout, imageSize)]}>
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
        {airportCode === 'SFO'
          ? 'Airport overview shown as provided. Place and gate markers are approximate.'
          : 'Charleston overview shown as provided. Sample pins are approximate and unverified.'}
      </ThemedText>

      {airport.places.length > 0 && (
        <View style={styles.legend}>
          <LegendItem icon="moon.zzz.fill" color={theme.primary} label="Quiet" />
          <LegendItem icon="info.circle.fill" color={theme.border} label="Service" />
          <LegendItem icon="fork.knife" color={theme.border} label="Food" />
          <LegendItem icon="square.dashed" color={theme.estimateBorder} label={airportCode === 'CHS' ? 'Busy area · sample' : 'Busy area · estimate'} />
        </View>
      )}

      {airport.places.length === 0 ? (
        <Card>
          <ThemedText type="smallBold">Charleston airport example</ThemedText>
          <ThemedText themeColor="textSecondary">
            Choose Concourse A or B above to zoom in. Gate and amenity details have not been added to this example.
          </ThemedText>
        </Card>
      ) : selectedCluster ? (
        <NearbyPlacesCard
          places={selectedCluster}
          airportCode={airportCode}
          onSelect={selectPlace}
        />
      ) : selectedPlace ? (
        <PlaceCard
          place={selectedPlace}
          imageSize={imageSize}
          airportCode={airportCode}
          from={gatePoint ?? {
            x: YOU_POSITION.x * imageSize.width,
            y: YOU_POSITION.y * imageSize.height,
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

type PlaceMarkerGroup = { places: Place[]; point: MapPoint };
type LocatedPlaceMarker = { place: Place; point: MapPoint; screenX: number; screenY: number };

const PLACE_MARKER_CLEARANCE = 48;

function clusterPlaceMarkers(
  places: Place[],
  image: { left: number; top: number; width: number; height: number },
  imageSize: { width: number; height: number },
  airportCode: AirportCode,
): PlaceMarkerGroup[] {
  if (image.width <= 0 || image.height <= 0) return [];

  const markers: LocatedPlaceMarker[] = places.map((place) => {
    const point = mapPointForPlace(place, airportCode);
    return {
      place,
      point,
      screenX: image.left + (point.x / imageSize.width) * image.width,
      screenY: image.top + (point.y / imageSize.height) * image.height,
    };
  });
  const clusters: LocatedPlaceMarker[][] = [];

  for (const marker of markers) {
    let nearestCluster: LocatedPlaceMarker[] | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const fitsCluster = cluster.every((other) =>
        Math.hypot(marker.screenX - other.screenX, marker.screenY - other.screenY) < PLACE_MARKER_CLEARANCE,
      );
      if (!fitsCluster) continue;

      const centerX = cluster.reduce((sum, other) => sum + other.screenX, 0) / cluster.length;
      const centerY = cluster.reduce((sum, other) => sum + other.screenY, 0) / cluster.length;
      const distance = Math.hypot(marker.screenX - centerX, marker.screenY - centerY);
      if (distance < nearestDistance) {
        nearestCluster = cluster;
        nearestDistance = distance;
      }
    }

    if (!nearestCluster) {
      clusters.push([marker]);
      continue;
    }
    nearestCluster.push(marker);
  }

  return clusters.map((cluster) => ({
    places: cluster.map(({ place }) => place),
    point: {
      x: cluster.reduce((sum, marker) => sum + marker.point.x, 0) / cluster.length,
      y: cluster.reduce((sum, marker) => sum + marker.point.y, 0) / cluster.length,
    },
  }));
}

function mapPositionStyle(
  point: { x: number; y: number },
  image: { left: number; top: number; width: number; height: number },
  imageSize: { width: number; height: number },
) {
  return {
    left: image.left + (point.x / imageSize.width) * image.width,
    top: image.top + (point.y / imageSize.height) * image.height,
  };
}

function LegendItem({ icon, color, label }: { icon: 'moon.zzz.fill' | 'info.circle.fill' | 'fork.knife' | 'square.dashed'; color: string; label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.legendItem}>
      <IconSymbol name={icon} size={16} color={color} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function NearbyPlacesCard({
  places,
  airportCode,
  onSelect,
}: {
  places: Place[];
  airportCode: AirportCode;
  onSelect: (place: Place) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">Nearby places</ThemedText>
        <Pill variant="neutral">{`${places.length} places`}</Pill>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        These markers are close together at this zoom. Choose one to see its details.
      </ThemedText>
      <View style={styles.nearbyPlacesList}>
        {places.map((place) => {
          const typeLabel = airportCode === 'CHS' ? CHS_TYPE_LABEL[place.type] : TYPE_LABEL[place.type];
          const icon = place.type === 'loud' ? 'waveform' : PIN_ICON[place.type];
          const iconColor = place.type === 'quiet'
            ? theme.primary
            : place.type === 'loud'
              ? theme.estimateText
              : theme.border;

          return (
            <Pressable
              key={place.id}
              onPress={() => onSelect(place)}
              accessibilityRole="button"
              accessibilityLabel={`${place.name}, ${typeLabel}`}
              style={styles.nearbyPlaceRow}>
              <IconSymbol name={icon} size={20} color={iconColor} />
              <View style={styles.nearbyPlaceCopy}>
                <ThemedText type="smallBold">{place.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{typeLabel}</ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={16} color={theme.textSecondary} />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function PlaceCard({
  place,
  imageSize,
  airportCode,
  from,
  onTakeMeThere,
  onReport,
}: {
  place: Place;
  imageSize: { width: number; height: number };
  airportCode: AirportCode;
  from: { x: number; y: number };
  onTakeMeThere: () => void;
  onReport: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const destination = mapPointForPlace(place, airportCode);
  const walkMinutes = estimateWalkMinutes(
    { x: from.x / imageSize.width, y: from.y / imageSize.height },
    { x: destination.x / imageSize.width, y: destination.y / imageSize.height },
  );
  const terminalLabel = TERMINAL_LABEL[place.terminal];

  return (
      <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{place.name}</ThemedText>
        <Pill variant={place.type === 'loud' ? 'estimate' : place.type === 'quiet' ? 'success' : 'neutral'}>
          {airportCode === 'CHS' ? CHS_TYPE_LABEL[place.type] : TYPE_LABEL[place.type]}
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
      {place.type !== 'loud' && (
        <View style={styles.cardActions}>
          <Button label="Take me there" onPress={onTakeMeThere} style={styles.cardButton} />
        </View>
      )}
      {hasConvex && REPORTS_ENABLED_AIRPORTS.includes(airportCode) ? (
        <SpotReportSection place={place} airportCode={airportCode} />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Last verified {place.lastVerified}
          </ThemedText>
          <View style={styles.cardActions}>
            <Button label="Report a problem" variant="secondary" onPress={onReport} style={styles.cardButton} />
          </View>
        </>
      )}
    </Card>
  );
}

// Live trust signal + report control for one spot. Rendered only when Convex is configured and the
// airport is seeded, so useQuery/useMutation always have a ConvexProvider above them.
function SpotReportSection({ place, airportCode }: { place: Place; airportCode: AirportCode }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const spotId = convexSpotId(airportCode, place);
  const summary = useQuery(api.reports.spotReportSummary, { airportCode, spotId });
  const submitReport = useMutation(api.reports.submitReport);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accurate = summary?.accurate ?? 0;
  const wrong = summary?.wrong ?? 0;
  const total = summary?.total ?? 0;
  // Enough recent "wrong" reports, and not outweighed by confirmations: warn the next traveler.
  const flagged = wrong >= 2 && wrong >= accurate;

  async function report(verdict: 'accurate' | 'wrong') {
    setPending(true);
    setError(null);
    try {
      await submitReport({ airportCode, spotId, verdict });
    } catch {
      setError('We couldn’t record that just now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.trustSection}>
      {summary === undefined ? (
        <ThemedText type="small" themeColor="textSecondary">Checking traveler reports…</ThemedText>
      ) : flagged ? (
        <View style={styles.trustRow}>
          <IconSymbol name="exclamationmark.triangle.fill" size={15} color={theme.estimateText} />
          <ThemedText type="small" style={[styles.trustText, { color: theme.estimateText }]}>
            {wrong} traveler{wrong === 1 ? '' : 's'} said this was off recently — double-check before relying on it.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.trustRow}>
          <IconSymbol name="checkmark.seal.fill" size={15} color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.trustText}>
            {total > 0
              ? `${accurate} traveler${accurate === 1 ? '' : 's'} confirmed this recently · verified ${place.lastVerified}`
              : `Verified ${place.lastVerified} · no traveler reports yet`}
          </ThemedText>
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary">Is this still right?</ThemedText>
      <View style={styles.cardActions}>
        <Button label="Still accurate" variant="secondary" onPress={() => void report('accurate')} disabled={pending} style={styles.cardButton} />
        <Button label="This was off" variant="secondary" onPress={() => void report('wrong')} disabled={pending} style={styles.cardButton} />
      </View>
      {error && <ThemedText type="small" style={{ color: theme.estimateText }}>{error}</ThemedText>}
    </View>
  );
}

const makeStyles = (theme: Palette) => StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: 16,
    backgroundColor: theme.primaryLight,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  demoNoticeCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  sectionHeading: {
    marginBottom: -Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.two,
  },
  schematicWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.neutralFillAlt,
  },
  mapViewport: { height: 380, width: '100%' },
  wideMapViewport: { height: 250 },
  airportImage: { position: 'absolute' },
  mapTools: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  zoomButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.neutralFill },
  zoomButtonDisabled: { opacity: 0.45 },
  flightShortcut: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: theme.primaryLight,
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
    backgroundColor: theme.primaryLight,
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
    backgroundColor: theme.youMarker,
    borderWidth: 3,
    borderColor: theme.surface,
  },
  flightGateLabel: {
    backgroundColor: theme.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  loudZone: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.estimateBorder,
    backgroundColor: theme.estimateFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loudZoneSelected: {
    borderWidth: 3,
  },
  placeCluster: {
    position: 'absolute',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: theme.surface,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeClusterCount: {
    color: theme.surface,
  },
  nearbyPlacesList: {
    gap: Spacing.one,
  },
  nearbyPlaceRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: theme.neutralFillAlt,
    paddingVertical: Spacing.two,
  },
  nearbyPlaceCopy: {
    flex: 1,
    gap: Spacing.half,
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
  trustSection: {
    gap: Spacing.two,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  trustText: {
    flex: 1,
  },
});
