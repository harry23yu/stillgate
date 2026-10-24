import type { FlightStatus, StepPhase } from '@/data/types';

export const FLIGHT_STATUS_LABEL: Record<FlightStatus, string> = {
  'on-time': 'On time',
  delayed: 'Delayed',
  boarding: 'Boarding',
  'gate-changed': 'Gate changed',
  cancelled: 'Cancelled',
};

export const STEP_PHASE_LABEL: Record<StepPhase, string> = {
  'check-in': 'Check in',
  security: 'Go through security',
  boarding: 'Head to your gate',
  'gate-change': 'Handle the gate change',
};

export function formatDateHeader(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
    .format(date)
    .toUpperCase();
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
