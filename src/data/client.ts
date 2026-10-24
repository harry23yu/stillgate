import {
  sampleChsFlight,
  sampleChsFlightAfterGateChange,
  sampleFlight,
  sampleFlightAfterGateChange,
} from '@/data/mock/flight';
import { chsAirport } from '@/data/mock/chs';
import { sfoAirport } from '@/data/mock/sfo';
import type { Airport, AirportCode, FlightLookup, Place, PlaceType } from '@/data/types';

/**
 * Single module boundary for airport/flight data. Every call here currently
 * reads from local mock data; swapping in the real backend only touches this
 * file. See CLAUDE.md §5.
 */

const airportsByCode: Record<AirportCode, Airport> = {
  SFO: sfoAirport,
  CHS: chsAirport,
};

const sampleFlights = [sampleFlight, sampleChsFlight];
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
export function getNearestPlace(airport: Airport, gate: string, type: PlaceType): Place | null {
  const matches = airport.places.filter((place) => place.type === type);
  if (matches.length === 0) return null;

  const areaId = airport.gateAreas[gate];
  const center = areaId ? airport.areaCenters[areaId] : undefined;
  if (!center) return matches[0];

  return matches.reduce((nearest, place) =>
    estimateWalkMinutes(center, place) < estimateWalkMinutes(center, nearest) ? place : nearest,
  );
}

/** Thin wrapper kept for existing call sites (Map, Gate Change). */
export function getNearestQuietPlace(airport: Airport, gate: string): Place | null {
  return getNearestPlace(airport, gate, 'quiet');
}

export async function getAirport(code: AirportCode): Promise<Airport | null> {
  return airportsByCode[code] ?? null;
}

/**
 * The real SFO Flight and Reference Data API looks up a flight by airline
 * code, flight number AND a date range (CLAUDE.md §6) — a flight number
 * alone isn't enough to find a specific flight. `date` is a YYYY-MM-DD string.
 */
export async function getFlightStatus(flightNumber: string, date: string): Promise<FlightLookup | null> {
  return sampleFlights.find((flight) => matchesFlight(flight, flightNumber, date)) ?? null;
}

/** Returns the flight's state after the labeled, simulated gate change. */
export async function simulateGateChange(flightNumber: string, date: string): Promise<FlightLookup | null> {
  return sampleFlightsAfterGateChange.find((flight) => matchesFlight(flight, flightNumber, date)) ?? null;
}

function matchesFlight(flight: FlightLookup, flightNumber: string, date: string): boolean {
  return flight.flight === flightNumber && flight.scheduledDeparture.startsWith(date);
}

