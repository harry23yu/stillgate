import type { FlightLookup } from '@/data/types';

function nextDemoDeparture(hour: number, minute: number): Date {
  const now = new Date();
  const departure = new Date(now);
  departure.setHours(hour, minute, 0, 0);
  if (departure <= now) departure.setDate(departure.getDate() + 1);
  return departure;
}

function toLocalIsoWithOffset(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);
  const localDateTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  return `${localDateTime}${sign}${offsetHours}:${offsetMinutes}`;
}

const sfoDemoDeparture = nextDemoDeparture(22, 40);
const chsDemoDeparture = nextDemoDeparture(5, 30);
const dcaDemoDeparture = nextDemoDeparture(13, 15);

/**
 * Sample SFO flight used by the dashboard and gate-change demo. Gates are demo
 * data: the change lands at C2 (Terminal 1) so the nearest-quiet-spot rule lines
 * up with the seeded Sensory Room — see convex/gateChange.ts WALK_MINUTES.
 */
export const sampleFlight: FlightLookup = {
  flight: 'UA 1',
  status: 'on-time',
  scheduledDeparture: toLocalIsoWithOffset(sfoDemoDeparture),
  gate: 'B7',
  terminal: 'Terminal 1',
  retrievedAt: new Date().toISOString(),
  isRecorded: false,
  origin: { code: 'SFO', city: 'San Francisco' },
  destination: { code: 'SIN', city: 'Singapore' },
};

/** Charleston-to-Atlanta sample. The gate is demo data, not a live assignment. */
export const sampleChsFlight: FlightLookup = {
  flight: 'DL 2850',
  status: 'on-time',
  scheduledDeparture: toLocalIsoWithOffset(chsDemoDeparture),
  gate: 'A3',
  terminal: 'Concourse A',
  retrievedAt: new Date().toISOString(),
  isRecorded: false,
  origin: { code: 'CHS', city: 'Charleston' },
  destination: { code: 'ATL', city: 'Atlanta' },
};

/** Flight-entry example supplied by the user; its destination/gate are intentionally unknown. */
export const sampleDcaFlight: FlightLookup = {
  flight: 'AA 1623',
  status: 'unknown',
  scheduledDeparture: toLocalIsoWithOffset(dcaDemoDeparture),
  gate: null,
  terminal: null,
  retrievedAt: new Date().toISOString(),
  isRecorded: false,
  origin: { code: 'DCA', city: 'Washington, D.C.' },
  destination: null,
};

/** What the flight looks like after the simulated gate change (B7 → C2). */
export const sampleFlightAfterGateChange: FlightLookup = {
  ...sampleFlight,
  status: 'gate-changed',
  gate: 'C2',
  retrievedAt: new Date().toISOString(),
};

/** What the Charleston sample looks like after its simulated gate change. */
export const sampleChsFlightAfterGateChange: FlightLookup = {
  ...sampleChsFlight,
  status: 'gate-changed',
  gate: 'A5',
  retrievedAt: new Date().toISOString(),
};
