import type { FlightStatus } from '@/data/types';

export const FLIGHT_STATUS_LABEL: Record<FlightStatus, string> = {
  'on-time': 'On time',
  delayed: 'Delayed',
  boarding: 'Boarding',
  'gate-changed': 'Gate changed',
  cancelled: 'Cancelled',
  unknown: 'Status unknown',
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

/** "Oct 24, 2:05 PM" — for "saved on" labels. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
