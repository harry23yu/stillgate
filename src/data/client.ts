import { sampleFlight, sampleFlightAfterGateChange } from '@/data/mock/flight';
import { sfoAirport } from '@/data/mock/sfo';
import type { Airport, FlightLookup, Step, StepPhase } from '@/data/types';

/**
 * Single module boundary for airport/flight data. Every call here currently
 * reads from local mock data; swapping in the real backend only touches this
 * file. See CLAUDE.md §5.
 */

const airportsByCode: Record<string, Airport> = {
  SFO: sfoAirport,
};

export async function getAirport(code: string): Promise<Airport | null> {
  return airportsByCode[code] ?? null;
}

export async function getFlightStatus(flightNumber: string): Promise<FlightLookup | null> {
  return sampleFlight.flight === flightNumber ? sampleFlight : null;
}

/** Returns the flight's state after the labeled, simulated gate change. */
export async function simulateGateChange(flightNumber: string): Promise<FlightLookup | null> {
  return sampleFlightAfterGateChange.flight === flightNumber ? sampleFlightAfterGateChange : null;
}

export async function getSteps(airportCode: string, phase: StepPhase): Promise<Step[]> {
  const airport = await getAirport(airportCode);
  return airport ? airport.steps.filter((step) => step.phase === phase) : [];
}
