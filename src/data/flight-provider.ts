import { normalizeFlightNumber } from '@/data/client';
import { sampleChsFlight, sampleDcaFlight, sampleFlight } from '@/data/mock/flight';
import type { FlightLookup } from '@/data/types';

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

/** Stable mobile call site for the future Apify/flight-data adapter. */
export function lookupFlight(input: FlightLookupInput): Promise<FlightLookupResult> {
  return demoFlightLookupProvider.lookup(input);
}
