import type { FlightLookup } from '@/data/types';

function nextDemoDeparture(): Date {
  const now = new Date();
  const departure = new Date(now);
  departure.setHours(9, 40, 0, 0);
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

const demoDeparture = nextDemoDeparture();

/** Sample flight used for the dashboard and the simulated gate-change demo. */
export const sampleFlight: FlightLookup = {
  flight: 'AA 1623',
  status: 'on-time',
  scheduledDeparture: toLocalIsoWithOffset(demoDeparture),
  gate: 'C2',
  terminal: '1',
  retrievedAt: new Date().toISOString(),
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
