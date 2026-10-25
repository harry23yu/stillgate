import { v, type Infer } from 'convex/values';

import { internal } from './_generated/api';
import { action, internalMutation, internalQuery } from './_generated/server';
import { flightValidator } from './schema';

/**
 * Live flight lookup through an Apify Store Actor that reads FlightStats'
 * public tracker (https://apify.com/parseforge/flightstats-scraper).
 *
 * Deployment env vars:
 *   APIFY_TOKEN       same token the accessibility scraper uses
 *   FLIGHT_ACTOR_ID   optional, defaults to parseforge~flightstats-scraper
 *
 * FlightStats only publishes roughly 3 days back to 2 days ahead, so dates
 * outside that window come back as not found.
 */

type Flight = Infer<typeof flightValidator>;
type FlightStatus = Flight['status'];

export type FlightLookupResponse =
  | { kind: 'found'; flight: Flight }
  | { kind: 'not-found' }
  | { kind: 'unavailable'; message: string; configured: boolean };

const DEFAULT_ACTOR_ID = 'parseforge~flightstats-scraper';
/** Gates and delays change; don't serve a lookup older than this. */
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Matches the delay threshold FlightStats and airlines use for "delayed". */
const DELAYED_AFTER_MINUTES = 15;

export const lookup = action({
  args: { flightNumber: v.string(), date: v.string(), originCode: v.string() },
  handler: async (ctx, args): Promise<FlightLookupResponse> => {
    const flightCode = args.flightNumber.toUpperCase().replace(/[\s-]+/g, '');
    const originCode = args.originCode.trim().toUpperCase();
    // This action spends money per call, so reject junk before reaching Apify.
    if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(flightCode)) return { kind: 'not-found' };
    if (!/^[A-Z]{3}$/.test(originCode) || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return { kind: 'not-found' };

    const key = `${flightCode}|${args.date}|${originCode}`;
    const cached = await ctx.runQuery(internal.flights.getCached, { key });
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.flight ? { kind: 'found', flight: cached.flight } : { kind: 'not-found' };
    }

    const token = process.env.APIFY_TOKEN;
    if (!token) {
      return { kind: 'unavailable', configured: false, message: 'Live flight lookup is not set up yet.' };
    }

    const trackerUrl = flightTrackerUrl(flightCode, args.date);
    if (!trackerUrl) return { kind: 'not-found' };

    const actorId = process.env.FLIGHT_ACTOR_ID ?? DEFAULT_ACTOR_ID;
    let items: FlightStatsItem[];
    try {
      const response = await fetch(
        `https://api.apify.com/v2/actors/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?timeout=90&maxItems=5`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          // The Actor's `searchTerms` flight-number search returned nothing in
          // testing (Oct 2026) while the flight's own tracker page worked, so
          // pass that page directly.
          body: JSON.stringify({ startUrls: [{ url: trackerUrl }], maxItems: 5 }),
        },
      );
      if (!response.ok) {
        console.error(`Flight Actor responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
        return { kind: 'unavailable', configured: true, message: 'Flight lookup is temporarily unavailable.' };
      }
      items = (await response.json()) as FlightStatsItem[];
    } catch (error) {
      console.error('Flight Actor request failed', error);
      return { kind: 'unavailable', configured: true, message: 'Flight lookup is temporarily unavailable.' };
    }

    // One designator can return several legs or codeshares; keep the leg that
    // leaves from the airport the traveler entered on the date they entered.
    const item = items.find(
      (candidate) =>
        !candidate.error &&
        candidate.originAirportCode?.toUpperCase() === originCode &&
        (!candidate.flightDate || candidate.flightDate === args.date),
    );
    const previousGate = cached?.flight?.gate ?? null;
    const flight = item ? toFlightLookup(item, previousGate) : null;

    await ctx.runMutation(internal.flights.saveCached, { key, flight, previousGate });
    return flight ? { kind: 'found', flight } : { kind: 'not-found' };
  },
});

export const getCached = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) =>
    await ctx.db
      .query('flightLookups')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique(),
});

export const saveCached = internalMutation({
  args: {
    key: v.string(),
    flight: v.union(flightValidator, v.null()),
    previousGate: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { key, flight, previousGate }) => {
    const fields = { key, flight, previousGate, fetchedAt: Date.now() };
    const existing = await ctx.db
      .query('flightLookups')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
    if (existing) await ctx.db.replace(existing._id, fields);
    else await ctx.db.insert('flightLookups', fields);
  },
});

/**
 * "UA901" + "2026-10-25" →
 * https://www.flightstats.com/v2/flight-tracker/UA/901?year=2026&month=10&date=25
 * Accepts 2-character IATA airline codes (UA, B6, 9W) and 3-letter ICAO codes (UAL).
 */
export function flightTrackerUrl(flightCode: string, date: string): string | null {
  const match = /^([A-Z][A-Z0-9]|[0-9][A-Z])(\d{1,4}[A-Z]?)$/.exec(flightCode) ?? /^([A-Z]{3})(\d{1,4}[A-Z]?)$/.exec(flightCode);
  const [year, month, day] = date.split('-').map(Number);
  if (!match || !year || !month || !day) return null;
  return `https://www.flightstats.com/v2/flight-tracker/${match[1]}/${match[2]}?year=${year}&month=${month}&date=${day}`;
}

/** The subset of the Actor's ~50 output fields Stillgate uses. */
interface FlightStatsItem {
  flightNumber?: string;
  flightCode?: string;
  flightDate?: string;
  flightStatus?: string;
  cancelled?: boolean | string;
  originAirportCode?: string;
  originCity?: string;
  destinationAirportCode?: string;
  destinationCity?: string;
  scheduledDeparture?: string;
  scheduledDepartureUtc?: string;
  departureDelayMinutes?: number | string;
  originTerminal?: string;
  originGate?: string;
  error?: string | null;
}

export function toFlightLookup(item: FlightStatsItem, previousGate: string | null): Flight | null {
  const scheduledDeparture = withUtcOffset(item.scheduledDeparture, item.scheduledDepartureUtc);
  if (!scheduledDeparture || !item.originAirportCode) return null;

  const gate = present(item.originGate);
  const terminal = present(item.originTerminal);
  const destinationCode = present(item.destinationAirportCode);

  return {
    flight: present(item.flightNumber) ?? present(item.flightCode) ?? '',
    status: toStatus(item, previousGate, gate),
    scheduledDeparture,
    gate,
    terminal: formatTerminal(terminal),
    retrievedAt: new Date().toISOString(),
    isRecorded: false,
    origin: { code: item.originAirportCode.toUpperCase(), city: present(item.originCity) ?? item.originAirportCode },
    destination: destinationCode
      ? { code: destinationCode.toUpperCase(), city: present(item.destinationCity) ?? destinationCode }
      : null,
  };
}

function toStatus(item: FlightStatsItem, previousGate: string | null, gate: string | null): FlightStatus {
  const status = item.flightStatus?.toLowerCase() ?? '';
  if (item.cancelled === true || item.cancelled === 'Yes' || status === 'cancelled') return 'cancelled';
  if (previousGate && gate && previousGate !== gate) return 'gate-changed';
  // Departed/arrived/diverted have no matching app status; don't claim "on time".
  if (status !== 'scheduled') return 'unknown';
  const delay = Number(item.departureDelayMinutes);
  return Number.isFinite(delay) && delay >= DELAYED_AFTER_MINUTES ? 'delayed' : 'on-time';
}

/**
 * FlightStats gives airport-local time without an offset plus the same time
 * in UTC. Combine them into "2026-10-24T22:40:00-07:00" so the app keeps both
 * the right instant and the airport's local date.
 */
function withUtcOffset(local: string | undefined, utc: string | undefined): string | null {
  const localTime = present(local);
  const utcTime = present(utc);
  if (!localTime || !utcTime) return null;
  const localMs = Date.parse(`${localTime.slice(0, 19)}Z`);
  const utcMs = Date.parse(utcTime);
  if (!Number.isFinite(localMs) || !Number.isFinite(utcMs)) return null;

  const offsetMinutes = Math.round((localMs - utcMs) / 60000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `${localTime.slice(0, 19)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** FlightStats terminal codes: "8" → "Terminal 8", "INTL" → "International". */
function formatTerminal(terminal: string | null): string | null {
  if (!terminal) return null;
  if (/^\d+$/.test(terminal)) return `Terminal ${terminal}`;
  if (terminal.toUpperCase() === 'INTL') return 'International';
  return terminal;
}

/** The Actor writes "Not Disclosed" or "N/A" for missing values. */
function present(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== 'Not Disclosed' && trimmed !== 'N/A' ? trimmed : null;
}
