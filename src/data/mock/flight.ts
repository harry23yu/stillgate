import type { FlightLookup } from '@/data/types';

/** Sample flight used for the dashboard and the simulated gate-change demo. */
export const sampleFlight: FlightLookup = {
  flight: 'AA 1623',
  status: 'on-time',
  scheduledDeparture: '2026-10-23T09:40:00-07:00',
  gate: 'C2',
  terminal: '1',
  retrievedAt: '2026-10-23T07:00:00-07:00',
  isRecorded: true,
  origin: { code: 'SFO', city: 'San Francisco' },
  destination: { code: 'JFK', city: 'New York' },
};

/** What the flight looks like after the simulated gate change. */
export const sampleFlightAfterGateChange: FlightLookup = {
  ...sampleFlight,
  status: 'gate-changed',
  gate: 'C7',
  retrievedAt: '2026-10-23T08:10:00-07:00',
};
