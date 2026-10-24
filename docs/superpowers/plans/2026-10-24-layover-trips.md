# Layover Trips (multi-flight, connection-aware) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a traveler save multiple flights that Stillgate understands as one journey, surfacing the layover (duration, next gate, nearest quiet spot) at the connecting airport.

**Architecture:** A new `saved-trip.ts` storage module (ordered legs, auto-migrating the old single-flight key) feeds a pure `trip-view.ts` derivation layer (ordering, connection detection, active-leg selection). Home renders a trip stack with a connection card; flight-lookup becomes "add a flight"; Map/Calm Guide follow the active leg. gate-change is untouched (already param-driven).

**Tech Stack:** React Native 0.88 + Expo SDK 58, expo-router, TypeScript, AsyncStorage. Tests via `jest-expo` (new, data layer only).

Spec: `docs/superpowers/specs/2026-10-24-layover-trips-design.md`.

## Global Constraints

- **Expo Go only — no native modules.** Use existing dependencies; the only new deps are dev-only test tooling (`jest`, `jest-expo`, `@types/jest`).
- **No secrets** in code, config, or commits. All demo flights are local mock data with `isRecorded: true`.
- **Estimates are always labeled.** Walk times, layover duration, and quiet-spot "make it" timing read as estimates, never measurements. Missing values show as "unknown"/"not posted" — never a guessed value.
- **Accessibility is a requirement, not polish:** every control has a screen-reader label; tap targets ≥ 44 px; no information by color alone (pair color with text/icon); honor text scaling.
- **Design tokens** come from `@/constants/theme` (`Colors`, `Spacing`, `Fonts`). Reuse `ThemedText`, `ThemedView`, `Card`, `Button`, `Pill`, `Chip`, `IconSymbol` — do not hardcode colors.
- **One-leg trips must behave exactly like today.** This feature degrades gracefully to the current single-flight experience.
- **Path alias:** `@/` maps to `src/` (see `tsconfig.json`).
- **Typecheck command** (used as the UI verification gate): `npx tsc --noEmit`. Lint: `npx expo lint`.

---

## File Structure

**Create:**
- `src/data/trip-view.ts` — pure derivation: `ResolvedLeg`, `Connection`, `TripView`, `orderResolvedLegs`, `detectConnections`, `computeLayoverMinutes`, `selectActiveLegIndex`, `buildTripView`.
- `src/data/saved-trip.ts` — storage + migration + `SavedLeg`/`SavedTrip`/`LegKey`, `legKey`, `getSavedTrip`, `saveTrip`, `addLeg`, `removeLeg`, `replaceLeg`, `clearTrip`, `getActiveLeg`.
- `src/data/__tests__/trip-view.test.ts` — unit tests for the pure helpers.
- `src/data/__tests__/saved-trip.test.ts` — unit tests for storage/migration/dedupe.
- `src/components/flight-leg-card.tsx` — one flight's card (extracted from today's Home card, reused per leg).
- `src/components/connection-card.tsx` — the layover connection card.
- `jest.config.js` — jest-expo preset + `@/` module mapping.

**Modify:**
- `src/data/types.ts` — add `scheduledArrival?: string` to `FlightLookup`.
- `src/data/mock/flight.ts` — add two demo layover legs (`sampleLayoverInbound`, `sampleLayoverOutbound`).
- `src/data/client.ts` — add the two demo legs to `sampleFlights` so `getFlightStatus` resolves them.
- `src/data/flight-provider.ts` — add the two demo legs to `DEMO_FLIGHTS`.
- `src/app/flight-lookup.tsx` — "add a flight" + trip list + edit mode; add the two demo legs to its quick-fill list.
- `src/app/(tabs)/index.tsx` — trip stack + connection card + "Add another flight".
- `src/app/(tabs)/map.tsx` — `getSavedFlight()` → `getActiveLeg()`.
- `src/app/(tabs)/calm-guide.tsx` — `getSavedFlight()` → `getActiveLeg()`.
- `package.json` — add `"test": "jest"` and dev deps.

**Delete (final task):**
- `src/data/saved-flight.ts` — once no caller references it.

---

## Task 1: Jest setup for the data layer

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `src/data/__tests__/trip-view.test.ts` (smoke test only in this task)

**Interfaces:**
- Produces: a working `npm test` command running `jest` with the `@/` alias.

- [ ] **Step 1: Install dev dependencies**

```bash
npx expo install --dev jest-expo
npm install --save-dev jest @types/jest
```

- [ ] **Step 2: Create jest config**

Create `jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Data-layer tests only; limit jest to the data directory for speed.
  testMatch: ['<rootDir>/src/data/**/*.test.ts'],
};
```

- [ ] **Step 3: Add the test script**

In `package.json` `"scripts"`, add:

```json
"test": "jest"
```

- [ ] **Step 4: Write a smoke test**

Create `src/data/__tests__/trip-view.test.ts`:

```ts
describe('jest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS (1 test). If jest-expo pulls in extra setup errors, confirm `jest.config.js` `testMatch` restricts to `src/data`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.js src/data/__tests__/trip-view.test.ts
git commit -m "chore: add jest-expo for data-layer unit tests"
```

---

## Task 2: Add `scheduledArrival` and demo layover legs

**Files:**
- Modify: `src/data/types.ts:56-67`
- Modify: `src/data/mock/flight.ts`
- Modify: `src/data/client.ts:23`
- Modify: `src/data/flight-provider.ts:21`

**Interfaces:**
- Produces: `FlightLookup.scheduledArrival?: string`; mock exports `sampleLayoverInbound`, `sampleLayoverOutbound` (a DEN→SFO→LHR connection through SFO); both resolvable via `lookupFlight` and `getFlightStatus`.

- [ ] **Step 1: Add the field to the type**

In `src/data/types.ts`, inside `interface FlightLookup`, add after `scheduledDeparture`:

```ts
  scheduledDeparture: string;
  /** ISO arrival datetime. Optional; used only to compute layover duration. */
  scheduledArrival?: string;
```

- [ ] **Step 2: Add the demo layover legs**

In `src/data/mock/flight.ts`, append (reuses the existing `toLocalIsoWithOffset` helper):

```ts
/**
 * Two legs forming a DEN -> SFO -> LHR connection through SFO, timed relative to
 * now so the demo lands mid-layover: the inbound leg has just arrived and the
 * outbound leg (Gate G7, International) boards soon. Demo data only.
 */
const layoverNow = new Date();
const layoverInboundArrival = new Date(layoverNow.getTime() - 25 * 60_000); // landed 25m ago
const layoverInboundDeparture = new Date(layoverInboundArrival.getTime() - 95 * 60_000);
const layoverOutboundDeparture = new Date(layoverNow.getTime() + 105 * 60_000); // boards ~1h45

export const sampleLayoverInbound: FlightLookup = {
  flight: 'UA 500',
  status: 'on-time',
  scheduledDeparture: toLocalIsoWithOffset(layoverInboundDeparture),
  scheduledArrival: toLocalIsoWithOffset(layoverInboundArrival),
  gate: 'B22',
  terminal: 'Concourse B',
  retrievedAt: new Date().toISOString(),
  isRecorded: true,
  origin: { code: 'DEN', city: 'Denver' },
  destination: { code: 'SFO', city: 'San Francisco' },
};

export const sampleLayoverOutbound: FlightLookup = {
  flight: 'UA 880',
  status: 'on-time',
  scheduledDeparture: toLocalIsoWithOffset(layoverOutboundDeparture),
  gate: 'G7',
  terminal: 'International',
  retrievedAt: new Date().toISOString(),
  isRecorded: true,
  origin: { code: 'SFO', city: 'San Francisco' },
  destination: { code: 'LHR', city: 'London' },
};
```

- [ ] **Step 3: Make `getFlightStatus` resolve them**

In `src/data/client.ts`, update the imports from `@/data/mock/flight` to include the two new exports, then update line 23:

```ts
const sampleFlights = [
  sampleFlight,
  sampleChsFlight,
  sampleDcaFlight,
  sampleLayoverInbound,
  sampleLayoverOutbound,
];
```

- [ ] **Step 4: Make `lookupFlight` find them — write the failing test**

Create `src/data/__tests__/flight-provider.test.ts`:

```ts
import { lookupFlight } from '@/data/flight-provider';
import { sampleLayoverInbound, sampleLayoverOutbound } from '@/data/mock/flight';

describe('lookupFlight finds demo layover legs', () => {
  it('finds the inbound DEN->SFO leg', async () => {
    const result = await lookupFlight({
      airportCode: 'DEN',
      flightNumber: 'UA 500',
      date: sampleLayoverInbound.scheduledDeparture.slice(0, 10),
    });
    expect(result).toEqual({ kind: 'found', flight: sampleLayoverInbound });
  });

  it('finds the outbound SFO->LHR leg', async () => {
    const result = await lookupFlight({
      airportCode: 'SFO',
      flightNumber: 'UA 880',
      date: sampleLayoverOutbound.scheduledDeparture.slice(0, 10),
    });
    expect(result).toEqual({ kind: 'found', flight: sampleLayoverOutbound });
  });
});
```

- [ ] **Step 5: Run — verify it fails**

Run: `npm test -- flight-provider`
Expected: FAIL (`not-found`) because `DEMO_FLIGHTS` doesn't include the new legs yet.

- [ ] **Step 6: Add them to the provider**

In `src/data/flight-provider.ts`, update the mock import and line 21:

```ts
import { sampleChsFlight, sampleDcaFlight, sampleFlight, sampleLayoverInbound, sampleLayoverOutbound } from '@/data/mock/flight';

const DEMO_FLIGHTS = [sampleFlight, sampleChsFlight, sampleDcaFlight, sampleLayoverInbound, sampleLayoverOutbound];
```

- [ ] **Step 7: Run — verify it passes**

Run: `npm test -- flight-provider`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/data/types.ts src/data/mock/flight.ts src/data/client.ts src/data/flight-provider.ts src/data/__tests__/flight-provider.test.ts
git commit -m "feat(data): add scheduledArrival and DEN-SFO-LHR demo layover legs"
```

---

## Task 3: Pure derivation helpers (`trip-view.ts`)

**Files:**
- Create: `src/data/trip-view.ts`
- Modify: `src/data/__tests__/trip-view.test.ts` (replace smoke test)

**Interfaces:**
- Consumes: `FlightLookup` (`@/data/types`), `getSupportedAirportCode` (`@/data/client`), `SavedLeg` (`@/data/saved-trip`, type-only — defined in Task 5; declare the local types below so this task compiles standalone).
- Produces: `ResolvedLeg`, `Connection`, `TripView`, `orderResolvedLegs(legs)`, `detectConnections(ordered)`, `computeLayoverMinutes(from, to)`, `selectActiveLegIndex(ordered, now)`.

> Note on ordering: Task 5 defines `SavedLeg`. To avoid a circular build, `trip-view.ts` imports it **type-only**. If implementing Task 3 before Task 5, temporarily inline `type SavedLeg = { flightNumber: string; date: string; originCode?: string; lookup?: FlightLookup }` and switch to the import in Task 5. The structure is identical.

- [ ] **Step 1: Write the failing tests**

Replace `src/data/__tests__/trip-view.test.ts` with:

```ts
import {
  computeLayoverMinutes,
  detectConnections,
  orderResolvedLegs,
  selectActiveLegIndex,
  type ResolvedLeg,
} from '@/data/trip-view';
import type { FlightLookup } from '@/data/types';

function flight(partial: Partial<FlightLookup> & { flight: string; scheduledDeparture: string }): FlightLookup {
  return {
    status: 'on-time',
    gate: 'G1',
    terminal: 'T1',
    retrievedAt: '2026-10-24T00:00:00Z',
    isRecorded: true,
    origin: { code: 'AAA', city: 'A' },
    destination: { code: 'BBB', city: 'B' },
    ...partial,
  };
}

function leg(f: FlightLookup | null): ResolvedLeg {
  return { leg: { flightNumber: f?.flight ?? 'X', date: '2026-10-24' }, flight: f };
}

describe('orderResolvedLegs', () => {
  it('sorts by scheduled departure and puts unresolved legs last', () => {
    const later = leg(flight({ flight: 'L2', scheduledDeparture: '2026-10-24T14:00:00Z' }));
    const earlier = leg(flight({ flight: 'L1', scheduledDeparture: '2026-10-24T09:00:00Z' }));
    const unresolved = leg(null);
    const ordered = orderResolvedLegs([later, unresolved, earlier]);
    expect(ordered.map((r) => r.flight?.flight ?? 'none')).toEqual(['L1', 'L2', 'none']);
  });
});

describe('detectConnections', () => {
  it('detects a connection when destination matches the next origin', () => {
    const l1 = leg(flight({ flight: 'L1', scheduledDeparture: '2026-10-24T09:00:00Z', scheduledArrival: '2026-10-24T11:00:00Z', origin: { code: 'DEN', city: 'Denver' }, destination: { code: 'SFO', city: 'SF' } }));
    const l2 = leg(flight({ flight: 'L2', scheduledDeparture: '2026-10-24T13:15:00Z', origin: { code: 'SFO', city: 'SF' }, destination: { code: 'LHR', city: 'London' } }));
    const connections = detectConnections([l1, l2]);
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({ fromLegIndex: 0, toLegIndex: 1, airportCode: 'SFO', airportMapped: true, layoverMinutes: 135 });
  });

  it('returns no connection when airports do not match', () => {
    const l1 = leg(flight({ flight: 'L1', scheduledDeparture: '2026-10-24T09:00:00Z', destination: { code: 'SFO', city: 'SF' } }));
    const l2 = leg(flight({ flight: 'L2', scheduledDeparture: '2026-10-24T13:00:00Z', origin: { code: 'JFK', city: 'NY' } }));
    expect(detectConnections([l1, l2])).toHaveLength(0);
  });

  it('marks an unmapped layover airport', () => {
    const l1 = leg(flight({ flight: 'L1', scheduledDeparture: '2026-10-24T09:00:00Z', destination: { code: 'DEN', city: 'Denver' } }));
    const l2 = leg(flight({ flight: 'L2', scheduledDeparture: '2026-10-24T13:00:00Z', origin: { code: 'DEN', city: 'Denver' } }));
    expect(detectConnections([l1, l2])[0].airportMapped).toBe(false);
  });

  it('skips connection detection when destination is null', () => {
    const l1 = leg(flight({ flight: 'L1', scheduledDeparture: '2026-10-24T09:00:00Z', destination: null }));
    const l2 = leg(flight({ flight: 'L2', scheduledDeparture: '2026-10-24T13:00:00Z', origin: { code: 'SFO', city: 'SF' } }));
    expect(detectConnections([l1, l2])).toHaveLength(0);
  });
});

describe('computeLayoverMinutes', () => {
  it('returns null when arrival is unknown', () => {
    const from = flight({ flight: 'L1', scheduledDeparture: '2026-10-24T09:00:00Z' });
    const to = flight({ flight: 'L2', scheduledDeparture: '2026-10-24T13:00:00Z' });
    expect(computeLayoverMinutes(from, to)).toBeNull();
  });
});

describe('selectActiveLegIndex', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('returns the earliest future leg', () => {
    const past = leg(flight({ flight: 'L1', scheduledDeparture: '2026-10-24T09:00:00Z' }));
    const future = leg(flight({ flight: 'L2', scheduledDeparture: '2026-10-24T14:00:00Z' }));
    expect(selectActiveLegIndex([past, future], now)).toBe(1);
  });

  it('returns the last resolved leg when all are in the past', () => {
    const p1 = leg(flight({ flight: 'L1', scheduledDeparture: '2026-10-24T08:00:00Z' }));
    const p2 = leg(flight({ flight: 'L2', scheduledDeparture: '2026-10-24T10:00:00Z' }));
    expect(selectActiveLegIndex([p1, p2], now)).toBe(1);
  });

  it('returns null when nothing resolves', () => {
    expect(selectActiveLegIndex([leg(null)], now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npm test -- trip-view`
Expected: FAIL (cannot find module `@/data/trip-view`).

- [ ] **Step 3: Implement `trip-view.ts`**

Create `src/data/trip-view.ts`:

```ts
import { getFlightStatus, getSupportedAirportCode } from '@/data/client';
import type { SavedLeg, SavedTrip } from '@/data/saved-trip';
import type { FlightLookup } from '@/data/types';

export interface ResolvedLeg {
  leg: SavedLeg;
  flight: FlightLookup | null;
}

export interface Connection {
  fromLegIndex: number;
  toLegIndex: number;
  /** The shared (layover) airport code. */
  airportCode: string;
  /** True when Stillgate has a detailed map for that airport (SFO/CHS). */
  airportMapped: boolean;
  /** Minutes between inbound arrival and outbound departure; null when unknown. */
  layoverMinutes: number | null;
}

export interface TripView {
  legs: ResolvedLeg[];
  connections: Connection[];
  activeLegIndex: number | null;
}

function departureTime(leg: ResolvedLeg): number {
  return leg.flight ? new Date(leg.flight.scheduledDeparture).getTime() : Number.POSITIVE_INFINITY;
}

export function orderResolvedLegs(legs: ResolvedLeg[]): ResolvedLeg[] {
  return legs
    .map((leg, index) => ({ leg, index }))
    .sort((a, b) => {
      const diff = departureTime(a.leg) - departureTime(b.leg);
      return diff !== 0 ? diff : a.index - b.index; // stable for unresolved legs
    })
    .map(({ leg }) => leg);
}

export function computeLayoverMinutes(from: FlightLookup, to: FlightLookup): number | null {
  if (!from.scheduledArrival) return null;
  const arrival = new Date(from.scheduledArrival).getTime();
  const departure = new Date(to.scheduledDeparture).getTime();
  if (Number.isNaN(arrival) || Number.isNaN(departure)) return null;
  const minutes = Math.round((departure - arrival) / 60_000);
  return minutes >= 0 ? minutes : null;
}

export function detectConnections(ordered: ResolvedLeg[]): Connection[] {
  const connections: Connection[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i].flight;
    const to = ordered[i + 1].flight;
    if (!from || !to) continue;
    const destination = from.destination?.code;
    if (!destination || destination !== to.origin.code) continue;
    connections.push({
      fromLegIndex: i,
      toLegIndex: i + 1,
      airportCode: to.origin.code,
      airportMapped: getSupportedAirportCode(to.origin.code) !== null,
      layoverMinutes: computeLayoverMinutes(from, to),
    });
  }
  return connections;
}

export function selectActiveLegIndex(ordered: ResolvedLeg[], now: Date): number | null {
  let lastResolved: number | null = null;
  for (let i = 0; i < ordered.length; i++) {
    const flight = ordered[i].flight;
    if (!flight) continue;
    lastResolved = i;
    if (new Date(flight.scheduledDeparture).getTime() > now.getTime()) return i;
  }
  return lastResolved;
}

export async function buildTripView(trip: SavedTrip, now: Date = new Date()): Promise<TripView> {
  const resolved: ResolvedLeg[] = await Promise.all(
    trip.legs.map(async (leg) => ({
      leg,
      flight: leg.lookup ?? (await getFlightStatus(leg.flightNumber, leg.date, leg.originCode)),
    })),
  );
  const legs = orderResolvedLegs(resolved);
  return { legs, connections: detectConnections(legs), activeLegIndex: selectActiveLegIndex(legs, now) };
}
```

> If Task 5 is not yet implemented, temporarily replace the `SavedLeg`/`SavedTrip` import with the inline types noted above so this file compiles.

- [ ] **Step 4: Run — verify it passes**

Run: `npm test -- trip-view`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/data/trip-view.ts src/data/__tests__/trip-view.test.ts
git commit -m "feat(data): add pure trip-view derivation (ordering, connections, active leg)"
```

---

## Task 4: `buildTripView` end-to-end test

**Files:**
- Modify: `src/data/__tests__/trip-view.test.ts` (append)

**Interfaces:**
- Consumes: `buildTripView`, `SavedTrip` (inline-typed in the test via saved `lookup`, so no storage/async-flight calls are exercised).

- [ ] **Step 1: Write the failing test**

Append to `src/data/__tests__/trip-view.test.ts`:

```ts
import { buildTripView } from '@/data/trip-view';
import { sampleLayoverInbound, sampleLayoverOutbound } from '@/data/mock/flight';

describe('buildTripView (legs carry their own lookup)', () => {
  it('orders legs, detects the SFO connection, and picks the outbound as active', async () => {
    const trip = {
      legs: [
        { flightNumber: sampleLayoverOutbound.flight, date: sampleLayoverOutbound.scheduledDeparture.slice(0, 10), lookup: sampleLayoverOutbound },
        { flightNumber: sampleLayoverInbound.flight, date: sampleLayoverInbound.scheduledDeparture.slice(0, 10), lookup: sampleLayoverInbound },
      ],
    };
    const view = await buildTripView(trip, new Date());
    expect(view.legs.map((l) => l.flight?.flight)).toEqual(['UA 500', 'UA 880']);
    expect(view.connections).toHaveLength(1);
    expect(view.connections[0].airportCode).toBe('SFO');
    // Inbound already departed, outbound departs in the future -> outbound is active.
    expect(view.activeLegIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run — verify it fails (if `buildTripView` export missing) or passes**

Run: `npm test -- trip-view`
Expected: PASS (Task 3 already implemented `buildTripView`). If the demo-leg timing changes make the inbound leg appear in the future, adjust the demo offsets in `mock/flight.ts` so the inbound leg's departure is before `now`.

- [ ] **Step 3: Commit**

```bash
git add src/data/__tests__/trip-view.test.ts
git commit -m "test(data): cover buildTripView end-to-end with demo layover legs"
```

---

## Task 5: `saved-trip.ts` storage, migration, and leg operations

**Files:**
- Create: `src/data/saved-trip.ts`
- Create: `src/data/__tests__/saved-trip.test.ts`

**Interfaces:**
- Consumes: `buildTripView` (`@/data/trip-view`), `normalizeFlightNumber` (`@/data/client`), `FlightLookup` (`@/data/types`), `AsyncStorage`.
- Produces: `SavedLeg`, `SavedTrip`, `LegKey`, `legKey(leg)`, `getSavedTrip()`, `saveTrip(trip)`, `addLeg(leg)`, `removeLeg(key)`, `replaceLeg(key, leg)`, `clearTrip()`, `getActiveLeg(now?)`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/__tests__/saved-trip.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addLeg, clearTrip, getSavedTrip, legKey, removeLeg, replaceLeg } from '@/data/saved-trip';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NEW_KEY = 'stillgate.savedTrip';
const LEGACY_KEY = 'stillgate.savedFlight';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('migration', () => {
  it('wraps a legacy single flight into a one-leg trip and removes the old key', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify({ flightNumber: 'UA 1', date: '2026-10-24', originCode: 'SFO' }));
    const trip = await getSavedTrip();
    expect(trip.legs).toHaveLength(1);
    expect(trip.legs[0].flightNumber).toBe('UA 1');
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(NEW_KEY)).not.toBeNull();
  });

  it('returns an empty trip when nothing is stored', async () => {
    expect(await getSavedTrip()).toEqual({ legs: [] });
  });
});

describe('leg operations', () => {
  it('adds legs and dedupes by flight+date+origin', async () => {
    await addLeg({ flightNumber: 'UA 500', date: '2026-10-24', originCode: 'DEN' });
    await addLeg({ flightNumber: 'ua500', date: '2026-10-24', originCode: 'den' }); // same key, normalized
    const trip = await addLeg({ flightNumber: 'UA 880', date: '2026-10-24', originCode: 'SFO' });
    expect(trip.legs).toHaveLength(2);
  });

  it('removes a leg by key', async () => {
    await addLeg({ flightNumber: 'UA 500', date: '2026-10-24', originCode: 'DEN' });
    const key = legKey({ flightNumber: 'UA 500', date: '2026-10-24', originCode: 'DEN' });
    const trip = await removeLeg(key);
    expect(trip.legs).toHaveLength(0);
  });

  it('replaces a leg by key', async () => {
    await addLeg({ flightNumber: 'UA 500', date: '2026-10-24', originCode: 'DEN' });
    const key = legKey({ flightNumber: 'UA 500', date: '2026-10-24', originCode: 'DEN' });
    const trip = await replaceLeg(key, { flightNumber: 'UA 999', date: '2026-10-25', originCode: 'DEN' });
    expect(trip.legs[0].flightNumber).toBe('UA 999');
  });

  it('clears the trip', async () => {
    await addLeg({ flightNumber: 'UA 500', date: '2026-10-24', originCode: 'DEN' });
    await clearTrip();
    expect(await getSavedTrip()).toEqual({ legs: [] });
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npm test -- saved-trip`
Expected: FAIL (cannot find module `@/data/saved-trip`).

- [ ] **Step 3: Implement `saved-trip.ts`**

Create `src/data/saved-trip.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeFlightNumber } from '@/data/client';
import { buildTripView } from '@/data/trip-view';
import type { FlightLookup } from '@/data/types';

const STORAGE_KEY = 'stillgate.savedTrip';
const LEGACY_KEY = 'stillgate.savedFlight';

export interface SavedLeg {
  flightNumber: string;
  /** YYYY-MM-DD. */
  date: string;
  originCode?: string;
  lookup?: FlightLookup;
}

export interface SavedTrip {
  legs: SavedLeg[];
}

export type LegKey = string;

export function legKey(leg: SavedLeg): LegKey {
  const flight = normalizeFlightNumber(leg.flightNumber);
  const origin = (leg.originCode ?? leg.lookup?.origin.code ?? '').trim().toUpperCase();
  return `${flight}__${leg.date.trim()}__${origin}`;
}

export async function getSavedTrip(): Promise<SavedTrip> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SavedTrip;
      if (Array.isArray(parsed.legs)) return parsed;
    } catch {
      // fall through
    }
    return { legs: [] };
  }

  // Migrate a legacy single saved flight into a one-leg trip.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      const flight = JSON.parse(legacy) as SavedLeg;
      if (typeof flight.flightNumber === 'string' && typeof flight.date === 'string') {
        const migrated: SavedTrip = { legs: [flight] };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        await AsyncStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
    } catch {
      // ignore malformed legacy data
    }
  }

  return { legs: [] };
}

export async function saveTrip(trip: SavedTrip): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
}

export async function addLeg(leg: SavedLeg): Promise<SavedTrip> {
  const trip = await getSavedTrip();
  const key = legKey(leg);
  if (trip.legs.some((existing) => legKey(existing) === key)) return trip;
  const updated: SavedTrip = { legs: [...trip.legs, leg] };
  await saveTrip(updated);
  return updated;
}

export async function removeLeg(key: LegKey): Promise<SavedTrip> {
  const trip = await getSavedTrip();
  const updated: SavedTrip = { legs: trip.legs.filter((existing) => legKey(existing) !== key) };
  await saveTrip(updated);
  return updated;
}

export async function replaceLeg(key: LegKey, leg: SavedLeg): Promise<SavedTrip> {
  const trip = await getSavedTrip();
  const updated: SavedTrip = { legs: trip.legs.map((existing) => (legKey(existing) === key ? leg : existing)) };
  await saveTrip(updated);
  return updated;
}

export async function clearTrip(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function getActiveLeg(now: Date = new Date()): Promise<{ leg: SavedLeg; flight: FlightLookup } | null> {
  const trip = await getSavedTrip();
  if (trip.legs.length === 0) return null;
  const view = await buildTripView(trip, now);
  if (view.activeLegIndex === null) return null;
  const active = view.legs[view.activeLegIndex];
  return active.flight ? { leg: active.leg, flight: active.flight } : null;
}
```

- [ ] **Step 4: Switch `trip-view.ts` to the real import**

If Task 3 used inline `SavedLeg`/`SavedTrip` types, replace them with:

```ts
import type { SavedLeg, SavedTrip } from '@/data/saved-trip';
```

- [ ] **Step 5: Run — verify it passes**

Run: `npm test`
Expected: PASS (all data-layer suites).

- [ ] **Step 6: Commit**

```bash
git add src/data/saved-trip.ts src/data/__tests__/saved-trip.test.ts src/data/trip-view.ts
git commit -m "feat(data): add saved-trip storage with migration, leg ops, active leg"
```

---

## Task 6: Extract `FlightLegCard` component

**Files:**
- Create: `src/components/flight-leg-card.tsx`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Produces: `FlightLegCard({ flight, date, isActive, onEdit, onSimulateGateChange })`.

- [ ] **Step 1: Create the component**

Create `src/components/flight-leg-card.tsx`. Move today's flight-card JSX (Home `index.tsx` lines ~70-131: status pill, route row, boards/gate/terminal stats, simulate-gate-change button) into it. Signature:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { FlightLookup } from '@/data/types';
import { FLIGHT_STATUS_LABEL, formatTime } from '@/lib/format';

interface FlightLegCardProps {
  flight: FlightLookup;
  isActive?: boolean;
  onEdit: () => void;
  onSimulateGateChange?: () => void;
}

export function FlightLegCard({ flight, isActive, onEdit, onSimulateGateChange }: FlightLegCardProps) {
  return (
    <Card>
      {isActive && (
        <View style={styles.upNext} accessible accessibilityLabel="Up next flight">
          <ThemedText type="small" themeColor="primary">UP NEXT</ThemedText>
        </View>
      )}
      <View style={styles.rowBetween}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit or remove flight ${flight.flight}`}
          style={styles.rowCenter}
          hitSlop={8}>
          <IconSymbol name="airplane" size={16} color={Colors.primary} />
          <ThemedText type="smallBold">{flight.flight}</ThemedText>
          <IconSymbol name="pencil" size={13} color={Colors.primary} />
        </Pressable>
        <Pill variant={flight.status === 'unknown' ? 'neutral' : flight.status === 'gate-changed' ? 'estimate' : 'success'}>
          {FLIGHT_STATUS_LABEL[flight.status]}
        </Pill>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routeEndpoint}>
          <ThemedText type="subtitle">{flight.origin.code}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{flight.origin.city}</ThemedText>
        </View>
        <IconSymbol name="airplane" size={18} color={Colors.border} />
        <View style={[styles.routeEndpoint, styles.routeEndpointRight]}>
          <ThemedText type="subtitle">{flight.destination?.code ?? '—'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{flight.destination?.city ?? 'Destination not available'}</ThemedText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.rowBetween}>
        <Stat label="Boards" value={formatTime(flight.scheduledDeparture)} />
        <Stat label="Gate" value={flight.gate ?? 'Not posted'} />
        <Stat label="Terminal" value={flight.terminal ?? 'Not posted'} />
      </View>

      {flight.gate && onSimulateGateChange && (
        <Pressable
          onPress={onSimulateGateChange}
          accessibilityRole="button"
          accessibilityLabel={`Simulate a gate change for ${flight.flight}, live demo`}
          style={styles.simulateButton}>
          <View style={styles.rowCenter}>
            <IconSymbol name="sparkles" size={16} color={Colors.text} />
            <ThemedText type="smallBold">Simulate gate change</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">LIVE DEMO</ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  upNext: { alignSelf: 'flex-start', backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeEndpoint: { gap: 2 },
  routeEndpointRight: { alignItems: 'flex-end' },
  divider: { height: 1, backgroundColor: Colors.neutralFillAlt },
  simulateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.neutralFillAlt, borderRadius: 14, paddingHorizontal: Spacing.three, minHeight: 44 },
});
```

- [ ] **Step 2: Use it in Home for the single-leg case (temporary wiring)**

In `src/app/(tabs)/index.tsx`, replace the inline flight `<Card>…</Card>` (lines ~70-131) with:

```tsx
<FlightLegCard
  flight={flight}
  isActive
  onEdit={() => router.push('/flight-lookup')}
  onSimulateGateChange={() => router.push({ pathname: '/gate-change', params: { flight: flight.flight, date: flightDate ?? undefined } })}
/>
```

Add the import `import { FlightLegCard } from '@/components/flight-leg-card';` and remove the now-unused local `Stat` function/styles if they are no longer referenced (keep any still used by other sections). Task 8 rewrites this screen fully; this step only proves the extraction renders identically.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify on device**

Load the app with a single saved flight; confirm the Home flight card looks and behaves exactly as before (status pill, route, stats, Simulate gate change).

- [ ] **Step 5: Commit**

```bash
git add src/components/flight-leg-card.tsx src/app/(tabs)/index.tsx
git commit -m "refactor(home): extract FlightLegCard component"
```

---

## Task 7: `ConnectionCard` component

**Files:**
- Create: `src/components/connection-card.tsx`

**Interfaces:**
- Consumes: `Connection` (`@/data/trip-view`), `FlightLookup` (`@/data/types`), `Airport` (`@/data/types`), `recommendPostSecurityOptions` (`@/data/itinerary`), `estimateWalkMinutes`, `getNearestPlace` (`@/data/client`), `formatMinutes`/`formatTime` (`@/lib/format`).
- Produces: `ConnectionCard({ connection, outboundFlight, airport, onTakeMeThere, onOpenMap, onSimulateGateChange })`.

> `airport` is `null` when the layover airport is unmapped — render the text-only variant then.

- [ ] **Step 1: Confirm the duration formatter exists**

Check `src/lib/format.ts` for a minutes→"Xh Ym" helper. If none exists, add:

```ts
export function formatMinutes(total: number): string {
  if (total < 0) return '—';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
```

- [ ] **Step 2: Create the component**

Create `src/components/connection-card.tsx`:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { estimateWalkMinutes, getNearestPlace } from '@/data/client';
import { recommendPostSecurityOptions } from '@/data/itinerary';
import type { Connection } from '@/data/trip-view';
import type { Airport, FlightLookup } from '@/data/types';
import { formatMinutes } from '@/lib/format';

interface ConnectionCardProps {
  connection: Connection;
  outboundFlight: FlightLookup;
  airport: Airport | null;
  onTakeMeThere: (placeId: string) => void;
  onOpenMap: () => void;
  onSimulateGateChange: () => void;
}

export function ConnectionCard({ connection, outboundFlight, airport, onTakeMeThere, onOpenMap, onSimulateGateChange }: ConnectionCardProps) {
  const durationLabel = connection.layoverMinutes !== null ? `${formatMinutes(connection.layoverMinutes)} between flights` : 'Time between flights not posted';

  const options = airport ? recommendPostSecurityOptions(airport, outboundFlight, new Date()) : null;
  const quiet = options?.quietOption ?? null;
  const quietWalk = airport && quiet ? estimateWalkMinutes(airport.areaCenters[airport.gateAreas[outboundFlight.gate ?? ''] ?? ''] ?? { x: 0.5, y: 0.5 }, quiet.place) : null;

  return (
    <Card>
      <View style={styles.header}>
        <IconSymbol name="arrow.triangle.swap" size={16} color={Colors.primary} />
        <ThemedText type="smallBold">Layover at {connection.airportCode}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">{durationLabel}</ThemedText>

      <View style={styles.divider} />

      <View style={styles.rowBetween}>
        <ThemedText type="small" themeColor="textSecondary">Next flight departs</ThemedText>
        <ThemedText type="smallBold">Gate {outboundFlight.gate ?? 'Not posted'} · {outboundFlight.terminal ?? 'Terminal not posted'}</ThemedText>
      </View>
      {options && (
        <View style={styles.rowBetween}>
          <ThemedText type="small" themeColor="textSecondary">Boards in</ThemedText>
          <ThemedText type="smallBold">{options.minutesUntilBoarding > 0 ? formatMinutes(options.minutesUntilBoarding) : 'Boarding now'}</ThemedText>
        </View>
      )}

      {airport && quiet ? (
        <View style={styles.quietBlock}>
          <ThemedText type="smallBold">Nearest quiet spot to Gate {outboundFlight.gate}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {quiet.place.name}{quietWalk !== null ? ` · ~${quietWalk} min walk (estimate)` : ''}
          </ThemedText>
          {quiet.canMakeIt ? (
            <Pill variant="success">You have time to stop</Pill>
          ) : (
            <Pill variant="estimate">Short connection — head straight to Gate {outboundFlight.gate}</Pill>
          )}
          {quiet.canMakeIt && (
            <View style={styles.actions}>
              <Pressable onPress={() => onTakeMeThere(quiet.place.id)} accessibilityRole="button" accessibilityLabel={`Take me to ${quiet.place.name}`} style={styles.actionButton}>
                <ThemedText type="smallBold" themeColor="primary">Take me there</ThemedText>
              </Pressable>
              <Pressable onPress={onOpenMap} accessibilityRole="button" accessibilityLabel="Open map" style={styles.actionButton}>
                <ThemedText type="smallBold" themeColor="primary">Open map</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Detailed quiet-spot guidance isn’t available for {connection.airportCode} yet.
        </ThemedText>
      )}

      {outboundFlight.gate && (
        <Pressable onPress={onSimulateGateChange} accessibilityRole="button" accessibilityLabel={`Simulate a gate change for ${outboundFlight.flight}, live demo`} style={styles.simulateButton}>
          <View style={styles.header}>
            <IconSymbol name="sparkles" size={16} color={Colors.text} />
            <ThemedText type="smallBold">Simulate gate change on this leg</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">LIVE DEMO</ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: Colors.neutralFillAlt },
  quietBlock: { gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.three },
  actionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  simulateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.neutralFillAlt, borderRadius: 14, paddingHorizontal: Spacing.three, minHeight: 44 },
});
```

> Verify the `IconSymbol` name `arrow.triangle.swap` exists in `src/components/icon-symbol.tsx`'s mapping; if not, use an existing one (e.g. `airplane`). Confirm `Pill` supports the `success` and `estimate` variants used here (it does — Home uses them).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (The component isn't mounted yet; this just confirms it compiles.)

- [ ] **Step 4: Commit**

```bash
git add src/components/connection-card.tsx src/lib/format.ts
git commit -m "feat(home): add ConnectionCard for layover display"
```

---

## Task 8: Home trip stack

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `getSavedTrip`, `buildTripView` (via local state), `getAirport`, `getSupportedAirportCode`, `FlightLegCard`, `ConnectionCard`, `Button`.

- [ ] **Step 1: Replace the flight-loading effect with trip loading**

In `src/app/(tabs)/index.tsx`, replace the `useFocusEffect` that calls `getSavedFlight()` with trip loading into a `TripView` state plus a map of layover airports:

```tsx
const [tripView, setTripView] = useState<TripView | null>(null);
const [layoverAirports, setLayoverAirports] = useState<Record<string, Airport | null>>({});

useFocusEffect(
  useCallback(() => {
    let active = true;
    getSavedTrip().then(async (trip) => {
      const view = await buildTripView(trip, new Date());
      if (!active) return;
      setTripView(view);
      // Resolve airport objects for any mapped layover airports (for the connection card).
      const entries = await Promise.all(
        view.connections
          .filter((c) => c.airportMapped)
          .map(async (c) => [c.airportCode, await getAirport(c.airportCode as 'SFO' | 'CHS')] as const),
      );
      if (active) setLayoverAirports(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, []),
);
```

Add imports: `getSavedTrip` + `getActiveLeg`-free; `buildTripView`, `TripView` from `@/data/trip-view`; `getAirport` from `@/data/client`; `Airport` from `@/data/types`; `FlightLegCard`, `ConnectionCard`. Remove the `getSavedFlight` import and the old `flight`/`flightDate`/`unmatchedFlightNumber` single-flight state.

- [ ] **Step 2: Derive the active leg + the "explore airport" source**

```tsx
const legs = tripView?.legs ?? [];
const activeIndex = tripView?.activeLegIndex ?? null;
const activeFlight = activeIndex !== null ? legs[activeIndex]?.flight ?? null : null;
const airportCode = getSupportedAirportCode(activeFlight?.origin.code ?? 'SFO');
const airportLabel = activeFlight?.origin.code ?? 'SFO';
```

- [ ] **Step 3: Render the trip stack**

Replace the single `flight ? (<Card>…) : (<Card>…)` block with:

```tsx
{legs.length === 0 ? (
  <Card>
    <ThemedText type="smallBold">Add your flight</ThemedText>
    <ThemedText themeColor="textSecondary">Enter your flight number to see its status here.</ThemedText>
    <Button label="Add your flight" onPress={() => router.push('/flight-lookup')} />
  </Card>
) : (
  <View style={{ gap: Spacing.three }}>
    {legs.map((resolved, index) => {
      const connection = tripView?.connections.find((c) => c.fromLegIndex === index);
      const previous = legs[index - 1];
      const hasPrevNoConnection = index > 0 && !tripView?.connections.some((c) => c.toLegIndex === index);
      return (
        <View key={resolved.leg.flightNumber + resolved.leg.date + (resolved.leg.originCode ?? '')} style={{ gap: Spacing.three }}>
          {hasPrevNoConnection && previous?.flight && (
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Separate flights — not a connection
            </ThemedText>
          )}
          {resolved.flight ? (
            <FlightLegCard
              flight={resolved.flight}
              isActive={index === activeIndex}
              onEdit={() => router.push({ pathname: '/flight-lookup', params: { editKey: resolved.leg.flightNumber + '|' + resolved.leg.date + '|' + (resolved.leg.originCode ?? '') } })}
              onSimulateGateChange={() => router.push({ pathname: '/gate-change', params: { flight: resolved.flight!.flight, date: resolved.leg.date } })}
            />
          ) : (
            <Card>
              <ThemedText type="smallBold">We couldn’t find {resolved.leg.flightNumber}</ThemedText>
              <ThemedText themeColor="textSecondary">This demo recognizes the SFO, Charleston, and demo layover sample flights. Try editing this flight.</ThemedText>
            </Card>
          )}
          {connection && legs[connection.toLegIndex]?.flight && (
            <ConnectionCard
              connection={connection}
              outboundFlight={legs[connection.toLegIndex].flight!}
              airport={layoverAirports[connection.airportCode] ?? null}
              onTakeMeThere={(placeId) => router.push({ pathname: '/map', params: { highlight: placeId } })}
              onOpenMap={() => router.push('/map')}
              onSimulateGateChange={() => router.push({ pathname: '/gate-change', params: { flight: legs[connection.toLegIndex].flight!.flight, date: legs[connection.toLegIndex].leg.date } })}
            />
          )}
        </View>
      );
    })}
    <Button label="Add another flight" variant="secondary" onPress={() => router.push('/flight-lookup')} />
  </View>
)}
```

> `editKey` uses `|`-joined fields (not `legKey`) so the lookup screen can reconstruct it without importing storage internals; the lookup screen matches on these fields. The `/map?highlight=` param is best-effort — if `map.tsx` doesn't yet read a `highlight` param, "Take me there" simply opens the map (acceptable; pin-highlight wiring is out of this plan's core scope).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Remove any now-unused imports/styles flagged by `npx expo lint`.

- [ ] **Step 5: Verify on device**

- Single saved flight: Home shows one card marked "UP NEXT", identical to before.
- Build the demo trip (DEN→SFO UA 500, then SFO→LHR UA 880, both today): Home shows leg → connection card (Layover at SFO, ~2h10, Gate G7, nearest quiet spot, Boards in) → leg, with "Add another flight".
- No flights: empty state.

- [ ] **Step 6: Commit**

```bash
git add src/app/(tabs)/index.tsx
git commit -m "feat(home): render trip stack with connection cards"
```

---

## Task 9: flight-lookup becomes "add a flight"

**Files:**
- Modify: `src/app/flight-lookup.tsx`

**Interfaces:**
- Consumes: `getSavedTrip`, `addLeg`, `removeLeg`, `replaceLeg`, `legKey`, `SavedLeg` (`@/data/saved-trip`); `buildTripView` to list resolved legs; `useLocalSearchParams` for `editKey`.

- [ ] **Step 1: Swap storage imports and load the trip**

Replace `import { clearSavedFlight, getSavedFlight, saveFlight } from '@/data/saved-flight';` with:

```tsx
import { addLeg, getSavedTrip, legKey, removeLeg, replaceLeg, type SavedLeg } from '@/data/saved-trip';
import { buildTripView, type ResolvedLeg } from '@/data/trip-view';
```

Read `const { editKey } = useLocalSearchParams<{ editKey?: string }>();`. Parse it as `flightNumber|date|origin`. On mount, load `getSavedTrip()` → `buildTripView` to populate a `tripLegs: ResolvedLeg[]` state for the "Flights in this trip" list, and if `editKey` is present, prefill the form from the matching leg.

- [ ] **Step 2: Rework save to add/replace a leg**

Replace `handleSave` so that on a found lookup it builds a `SavedLeg` and calls `addLeg` (new) or `replaceLeg(oldKey, leg)` (edit mode), then `router.back()`:

```tsx
async function handleSave() {
  if (lookupResult?.kind !== 'found') return;
  const flight = lookupResult.flight;
  const leg: SavedLeg = {
    flightNumber: flight.flight,
    date: flight.scheduledDeparture.slice(0, 10),
    originCode: flight.origin.code,
    lookup: flight,
  };
  try {
    if (editKey) {
      await replaceLeg(editKeyToLegKey(editKey), leg);
    } else {
      await addLeg(leg);
    }
    router.back();
  } catch {
    setError('We couldn’t save this flight on your device. Please try again.');
  }
}
```

Add a small helper that converts the `|`-joined `editKey` into the storage `LegKey` via `legKey({ flightNumber, date, originCode })`:

```tsx
function editKeyToLegKey(key: string) {
  const [flightNumber = '', date = '', originCode = ''] = key.split('|');
  return legKey({ flightNumber, date, originCode });
}
```

- [ ] **Step 3: Replace remove behavior**

Replace `removeSavedFlight`/`clearSavedFlight` usage with per-leg removal. In edit mode, "Remove this flight" calls `removeLeg(editKeyToLegKey(editKey))` then `router.back()`. The bottom "Flights in this trip" list renders each leg with a × that calls `removeLeg(legKey(resolvedLeg.leg))` and refreshes the list.

- [ ] **Step 4: Add the "Flights in this trip" list and the demo legs**

Add the two demo legs to the quick-fill `DEMO_FLIGHTS` import/array so they can be entered quickly:

```tsx
import { sampleChsFlight, sampleDcaFlight, sampleFlight, sampleLayoverInbound, sampleLayoverOutbound } from '@/data/mock/flight';
const DEMO_FLIGHTS = [sampleLayoverInbound, sampleLayoverOutbound, sampleFlight, sampleChsFlight, sampleDcaFlight];
```

Below the result area, render the current trip legs (from `tripLegs` state) with remove controls. Update the title to "Add a flight" and the primary save label to `editKey ? 'Update flight' : 'Add this flight'`.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors (remove unused `clearSavedFlight`/`getSavedFlight`/`saveFlight`/`hasSavedFlight` references).

- [ ] **Step 6: Verify on device**

Add UA 500 (DEN), then UA 880 (SFO); both appear in "Flights in this trip" and on Home as a connection. Tap a Home leg's pencil → opens prefilled in edit mode; Update and Remove both work.

- [ ] **Step 7: Commit**

```bash
git add src/app/flight-lookup.tsx
git commit -m "feat(flight-lookup): add flights to a trip with edit and remove"
```

---

## Task 10: Repoint Map + Calm Guide to the active leg; retire `saved-flight.ts`

**Files:**
- Modify: `src/app/(tabs)/map.tsx:13,26-35`
- Modify: `src/app/(tabs)/calm-guide.tsx:18,40-60`
- Delete: `src/data/saved-flight.ts`

**Interfaces:**
- Consumes: `getActiveLeg` (`@/data/saved-trip`).

- [ ] **Step 1: Update Map**

In `src/app/(tabs)/map.tsx`, replace `import { getSavedFlight } from '@/data/saved-flight';` with `import { getActiveLeg } from '@/data/saved-trip';`. Replace the `getSavedFlight()` call: instead of `const saved = await getSavedFlight()` then resolving `saved.lookup ?? getFlightStatus(...)`, use:

```tsx
const active = await getActiveLeg();
// active?.flight is the FlightLookup to drive the map; active is null when there is no trip.
```

Adapt the surrounding logic to use `active?.flight` where `saved`/resolved flight was used.

- [ ] **Step 2: Update Calm Guide**

In `src/app/(tabs)/calm-guide.tsx`, replace `import { getSavedFlight } from '@/data/saved-flight';` with `import { getActiveLeg } from '@/data/saved-trip';`. In the `Promise.all` (lines ~43-47), replace `getSavedFlight()` with `getActiveLeg()`, and replace the subsequent `const result = saved.lookup ?? await getFlightStatus(...)` block with `const result = active?.flight ?? null;` (the active leg already carries the resolved flight), keeping the airport-resolution logic that follows.

- [ ] **Step 3: Delete the legacy module**

Run: `grep -rn "saved-flight" src` — expect no results. Then:

```bash
git rm src/data/saved-flight.ts
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all pass; no references to `getSavedFlight`.

- [ ] **Step 5: Verify on device**

With the demo layover trip saved, open Map and Calm Guide: both target SFO (the active/outbound leg's airport). With a single CHS flight, both target CHS. With no trip, both show their empty/default state.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(trip): point Map and Calm Guide at the active leg; remove saved-flight"
```

---

## Self-Review Notes

- **Spec coverage:** §4 data model → Tasks 2,5; §4.2 migration → Task 5; §4.3 scheduledArrival → Task 2; §5 derivation → Tasks 3,4; §6 API → Task 5; §7 Home → Tasks 6,8; §7.1 connection card → Task 7; §8 flight-lookup → Task 9; §9 Map/Calm Guide/gate-change → Task 10 (gate-change needs no change); §10 edge cases → covered across Tasks 3 (null destination, unmapped, unknown arrival), 7 (short connection, unmapped text-only), 8 (unresolved leg, separate-flights note), 5 (dedupe); §12 testing → Tasks 1-5; §13 demo data → Task 2.
- **Type consistency:** `SavedLeg`/`SavedTrip` defined in Task 5, imported type-only by Task 3 (circular-safe); `Connection`/`TripView`/`ResolvedLeg` defined in Task 3, consumed in Tasks 7,8,9; `legKey`/`LegKey` defined in Task 5, used in Tasks 8 (`editKey` is a `|`-joined surrogate converted via `editKeyToLegKey`),9; `recommendPostSecurityOptions` return shape (`minutesUntilBoarding`, `quietOption.{place,canMakeIt}`) matches `src/data/itinerary.ts`.
- **Known soft spots to watch during implementation:** (1) confirm `IconSymbol` names used in Task 7 exist; (2) the `/map?highlight=` param is best-effort; (3) demo-leg timing in Task 2 must keep the inbound leg in the past and the outbound in the future relative to `now` for the active-leg demo to read correctly.
