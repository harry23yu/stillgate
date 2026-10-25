import { api } from '../../convex/_generated/api';
import { normalizeFlightNumber } from '@/data/client';
import { sampleChsFlight, sampleDcaFlight, sampleFlight } from '@/data/mock/flight';
import type { FlightLookup } from '@/data/types';
import { convex } from '@/lib/convex';

export interface FlightLookupInput {
  airportCode: string;
  flightNumber: string;
  date: string;
}

export type FlightLookupResult =
  | { kind: 'found'; flight: FlightLookup }
  | { kind: 'not-found' }
  | { kind: 'unavailable'; message: string };

/** Backend implementations can replace this port without changing the screen. */
export interface FlightLookupProvider {
  lookup(input: FlightLookupInput): Promise<FlightLookupResult>;
}

const DEMO_FLIGHTS = [sampleFlight, sampleChsFlight, sampleDcaFlight];

export const demoFlightLookupProvider: FlightLookupProvider = {
  async lookup({ airportCode, flightNumber, date }) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const normalizedNumber = normalizeFlightNumber(flightNumber);
    const flight = DEMO_FLIGHTS.find(
      (candidate) =>
        candidate.origin.code === airportCode &&
        normalizeFlightNumber(candidate.flight) === normalizedNumber &&
        candidate.scheduledDeparture.startsWith(date),
    );

    return flight ? { kind: 'found', flight } : { kind: 'not-found' };
  },
};

/** A live lookup starts an Apify run (usually ~10 s); allow for a slow cold start. */
const LIVE_TIMEOUT_MS = 60_000;

/**
 * Live FlightStats data through the Convex `flights.lookup` action. The
 * Apify token stays on the backend, never on the phone.
 */
export const liveFlightLookupProvider: FlightLookupProvider & {
  /** False when there's no backend, or it has no Apify token yet. */
  lookupIfConfigured(input: FlightLookupInput): Promise<FlightLookupResult | 'not-configured'>;
} = {
  async lookup(input) {
    const result = await this.lookupIfConfigured(input);
    return result === 'not-configured' ? { kind: 'unavailable', message: 'Live flight lookup is not set up.' } : result;
  },
  async lookupIfConfigured({ airportCode, flightNumber, date }) {
    if (!convex) return 'not-configured';
    try {
      const result = await Promise.race([
        convex.action(api.flights.lookup, { flightNumber, date, originCode: airportCode }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out')), LIVE_TIMEOUT_MS)),
      ]);
      if (result.kind === 'unavailable') {
        return result.configured ? { kind: 'unavailable', message: result.message } : 'not-configured';
      }
      return result;
    } catch {
      return { kind: 'unavailable', message: 'Flight lookup is temporarily unavailable.' };
    }
  },
};

/**
 * Live lookup when the backend and Apify token are set up; otherwise the
 * labeled demo flights, so the screen still works in local development.
 * A live lookup that fails stays "unavailable" rather than silently showing
 * demo data in its place.
 */
export async function lookupFlight(input: FlightLookupInput): Promise<FlightLookupResult> {
  const live = await liveFlightLookupProvider.lookupIfConfigured(input);
  if (live === 'not-configured') return demoFlightLookupProvider.lookup(input);
  // Keep the labeled demo flights findable during development alongside live data.
  if (live.kind === 'not-found') return demoFlightLookupProvider.lookup(input);
  return live;
}
