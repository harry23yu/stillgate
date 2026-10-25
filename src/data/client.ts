import {
  sampleChsFlight,
  sampleChsFlightAfterGateChange,
  sampleDcaFlight,
  sampleFlight,
  sampleFlightAfterGateChange,
} from '@/data/mock/flight';
import { chsAirport } from '@/data/mock/chs';
import { sfoAirport } from '@/data/mock/sfo';
import { api } from '../../convex/_generated/api';
import { readCachedAirport, writeCachedAirport, type CachedAirportPlaces } from '@/data/airport-cache';
import type { Airport, AirportCode, AirportDataSource, FlightLookup, Place, PlaceType } from '@/data/types';
import { convex } from '@/lib/convex';

/**
 * Single module boundary for airport/flight data. Airport places come from
 * the reviewed Convex backend (with an on-device cache and bundled fallback);
 * flights still read local mock data. See CLAUDE.md §5.
 */

const airportsByCode: Record<AirportCode, Airport> = {
  SFO: sfoAirport,
  CHS: chsAirport,
};

const sampleFlights = [sampleFlight, sampleChsFlight, sampleDcaFlight];
const sampleFlightsAfterGateChange = [sampleFlightAfterGateChange, sampleChsFlightAfterGateChange];

/** Schematic position of the "You" marker, shared by the dashboard preview and the map. */
export const YOU_POSITION = { x: 0.45, y: 0.7 };

/**
 * Rough walk-time estimate from schematic distance. Not a measured value —
 * always label it as an estimate in the UI. See CLAUDE.md §4.
 */
export function estimateWalkMinutes(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(1, Math.round(distance * 18));
}

/**
 * The nearest-place rule from CLAUDE.md §4: filter places down to one type,
 * then pick the one nearest the gate's boarding area. No model decides
 * this — it is a plain nearest-neighbor lookup over the gate-to-area table.
 */
export function getNearestPlace(airport: Airport, gate: string | null, type: PlaceType): Place | null {
  const matches = airport.places.filter((place) => place.type === type);
  if (matches.length === 0) return null;
  if (!gate) return null;

  const areaId = airport.gateAreas[gate];
  const center = areaId ? airport.areaCenters[areaId] : undefined;
  if (!center) return matches[0];

  return matches.reduce((nearest, place) =>
    estimateWalkMinutes(center, place) < estimateWalkMinutes(center, nearest) ? place : nearest,
  );
}

/** Thin wrapper kept for existing call sites (Map, Gate Change). */
export function getNearestQuietPlace(airport: Airport, gate: string | null): Place | null {
  return getNearestPlace(airport, gate, 'quiet');
}

/** Airport Wi-Fi often half-works; don't leave a traveler watching a spinner. */
const REMOTE_TIMEOUT_MS = 5000;

/**
 * Bundled map metadata plus reviewed places from the backend. Order of
 * preference: fresh backend data → last copy saved on this device → bundled
 * sample data. `dataSource` on the result says which one the UI got.
 */
export async function getAirport(code: AirportCode): Promise<Airport | null> {
  const base = airportsByCode[code];
  if (!base) return null;

  const live = await fetchReviewedPlaces(code);
  if (live) return mergeReviewedPlaces(base, live, 'live');

  const cached = await readCachedAirport(code);
  if (cached) return mergeReviewedPlaces(base, cached, 'cached');

  return { ...base, dataSource: 'sample' };
}

/**
 * Downloads an airport's reviewed places to the device ahead of time (call
 * when a trip is saved, while the traveler is probably still on good Wi-Fi).
 */
export async function prefetchAirport(code: AirportCode): Promise<void> {
  await fetchReviewedPlaces(code);
}

async function fetchReviewedPlaces(code: AirportCode): Promise<CachedAirportPlaces | null> {
  if (!convex) return null;
  try {
    const result = await withTimeout(convex.query(api.airports.get, { code }), REMOTE_TIMEOUT_MS);
    const entry = { places: result.places, fetchedAt: new Date().toISOString() };
    await writeCachedAirport(code, entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Per place type, reviewed backend places replace the bundled sample ones:
 * once a reviewer publishes any quiet spot for an airport, the unverified
 * sample quiet spots stop showing. Types nobody has reviewed yet (often
 * loud/food) keep their clearly-labeled sample pins.
 */
export function mergeReviewedPlaces(
  base: Airport,
  reviewed: CachedAirportPlaces,
  dataSource: Exclude<AirportDataSource, 'sample'>,
): Airport {
  const reviewedTypes = new Set(reviewed.places.map((place) => place.type));
  const samplePlaces = base.places.filter((place) => !reviewedTypes.has(place.type));
  const latestVerified = reviewed.places
    .map((place) => place.lastVerified)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1);

  return {
    ...base,
    places: [...reviewed.places, ...samplePlaces],
    // "Verified" only once nothing on the map is sample data.
    verified: base.verified || (reviewed.places.length > 0 && samplePlaces.length === 0),
    lastVerified: latestVerified ?? base.lastVerified,
    dataSource,
    dataFetchedAt: reviewed.fetchedAt,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Returns a detailed floor-plan code only when Stillgate has that airport map. */
export function getSupportedAirportCode(code: string | undefined): AirportCode | null {
  return code === 'SFO' || code === 'CHS' ? code : null;
}

/**
 * The real SFO Flight and Reference Data API looks up a flight by airline
 * code, flight number AND a date range (CLAUDE.md §6) — a flight number
 * alone isn't enough to find a specific flight. `date` is a YYYY-MM-DD string.
 */
export async function getFlightStatus(
  flightNumber: string,
  date: string,
  airportCode?: string,
): Promise<FlightLookup | null> {
  const normalizedNumber = normalizeFlightNumber(flightNumber);
  return sampleFlights.find((flight) =>
    matchesFlight(flight, normalizedNumber, date) && (!airportCode || flight.origin.code === airportCode),
  ) ?? null;
}

/** Returns the flight's state after the labeled, simulated gate change. */
export async function simulateGateChange(flightNumber: string, date: string): Promise<FlightLookup | null> {
  const normalizedNumber = normalizeFlightNumber(flightNumber);
  return sampleFlightsAfterGateChange.find((flight) => matchesFlight(flight, normalizedNumber, date)) ?? null;
}

function matchesFlight(flight: FlightLookup, flightNumber: string, date: string): boolean {
  return normalizeFlightNumber(flight.flight) === flightNumber && flight.scheduledDeparture.startsWith(date);
}

export function normalizeFlightNumber(flightNumber: string): string {
  return flightNumber.toUpperCase().replace(/[\s-]+/g, '');
}

