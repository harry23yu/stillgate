# Pre-security Planning Flow (Calm Guide v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Calm Guide's static 4-phase step content with a personalized, rule-driven 5-step flow (trip details → arrival time → checkpoint → TSA/visa reminder → post-security gate/quiet/food decision), per the approved spec at `docs/superpowers/specs/2026-10-23-pre-security-planning-design.md`.

**Architecture:** One new pure function, `buildItinerary()` (in a new `data/itinerary.ts`), computes the whole trip plan from existing data (flight, airport, profile) plus two new on-device inputs (trip details, checkpoint-lane mock data). `calm-guide.tsx` is rewritten to render that computed result across 5 steps using the same step-shell pattern (counter, Listen placeholder, Back/Next, Need-a-minute card) already proven in this codebase.

**Tech Stack:** React Native + Expo (Expo Go target), expo-router, AsyncStorage, TypeScript. No test framework is configured.

## Global Constraints

- **No test framework is configured** (`package.json` has no jest/vitest/testing-library), and every source file in `src/` uses the `@/` TypeScript path alias (tsconfig `paths`), which only `tsc` and the Metro bundler resolve — plain `node file.ts` cannot run any file that imports via `@/...` (confirmed experimentally: Node 22's native TS execution runs plain relative-import files fine but has no knowledge of tsconfig path aliases). **Therefore no task below uses an isolated unit-test run as its verification step.** Every task is verified by `npx tsc --noEmit` (and `npx expo lint` where relevant), plus a hand-worked numeric example given in the task text as the oracle — confirmed either by re-deriving it by eye against the code, or, for tasks whose output reaches a screen, by running the app and reading the on-screen value against that oracle. This matches spec §8, already approved by Tyler.
- Follow existing file conventions exactly: `ThemedText`/`ThemedView`/`Card`/`Button`/`Pill`/`Chip`/`IconSymbol` components, `Colors`/`Spacing` from `@/constants/theme`, `StyleSheet.create` at the bottom of each file, no comments beyond what's already in each file's style.
- No comments explaining *what* code does — only the sparse *why*-comments already present in this codebase's style (e.g. "always label it as an estimate").
- Escape apostrophes typed directly in JSX text as `&apos;` (ESLint `react/no-unescaped-entities` is enforced here — confirmed by a prior lint failure and fix in this exact codebase). Apostrophes inside JS string *variables* interpolated via `{}` do not need escaping.
- Never fabricate a URL. The TSA/visa reminder "links" are rendered as plain inert text labels (resource names only, not tappable `WebBrowser` links) because this project has no verified URLs for TSA Cares / MagnusCards / State Department travel advisories — inventing one would violate CLAUDE.md §1's "never present a guess... as verified."
- `food` as a `PlaceType` is additive — do not change the existing `Place` shape, `quiet`/`loud`/`service` behavior, or any already-built screen's existing call sites (Map's `PlaceCard`, Gate Change's quiet-spot suggestion) beyond what each task explicitly states.
- All time-based recommendations must read as estimates in the UI copy (no bare numbers presented as guarantees), consistent with the rest of the app.

---

### Task 1: TripDetails data module

**Files:**
- Create: `src/data/trip-details.ts`

**Interfaces:**
- Consumes: `AsyncStorage` from `@react-native-async-storage/async-storage` (already a project dependency, used identically by `src/data/profile.ts` and `src/data/saved-flight.ts`).
- Produces: `TripDetails` interface, `defaultTripDetails` constant, `getTripDetails(): Promise<TripDetails>`, `saveTripDetails(details: TripDetails): Promise<void>` — consumed by Task 7 (`calm-guide.tsx`) and by `data/itinerary.ts` (Tasks 4–5, as a type only).

- [ ] **Step 1: Create `src/data/trip-details.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stillgate.tripDetails';

export interface TripDetails {
  checkingBag: boolean;
  hasBoardingPass: boolean;
  hasPreCheck: boolean;
  isInternational: boolean;
}

export const defaultTripDetails: TripDetails = {
  checkingBag: false,
  hasBoardingPass: false,
  hasPreCheck: false,
  isInternational: false,
};

export async function getTripDetails(): Promise<TripDetails> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultTripDetails;

  try {
    return { ...defaultTripDetails, ...JSON.parse(raw) };
  } catch {
    return defaultTripDetails;
  }
}

export async function saveTripDetails(details: TripDetails): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(details));
}
```

This mirrors `src/data/profile.ts`'s merge-with-defaults pattern exactly (safer against partial/corrupt stored JSON than `saved-flight.ts`'s plain-parse pattern), which fits here since there are several boolean fields with sensible defaults.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/data/trip-details.ts
git commit -m "Add on-device TripDetails module for the pre-security planning flow"
```

---

### Task 2: Extend types and mock data for checkpoints and food

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/mock/sfo.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PlaceType` now includes `'food'`; `Airport.checkpointLanes: CheckpointWait[]`; `sfoAirport.checkpointLanes` populated with two lanes; `sfoAirport.places` gains one `food`-type place with id `'grab-and-go-c5'`. Consumed by Task 3 (`getNearestPlace`), Tasks 4–5 (`itinerary.ts`), and Task 6 (map food filter).

- [ ] **Step 1: Add `'food'` to `PlaceType` and `checkpointLanes` to `Airport` in `src/data/types.ts`**

Change line 6 from:
```ts
export type PlaceType = 'quiet' | 'loud' | 'service';
```
to:
```ts
export type PlaceType = 'quiet' | 'loud' | 'service' | 'food';
```

Change the `Airport` interface (currently lines 42–54):
```ts
export interface Airport {
  code: string;
  name: string;
  verified: boolean;
  lastVerified: string;
  terminals: Terminal[];
  places: Place[];
  /** Gate -> boarding area id, used by the quiet-spot rule. */
  gateAreas: Record<string, string>;
  /** Boarding area id -> approximate schematic position, used to find the nearest quiet spot. */
  areaCenters: Record<string, { x: number; y: number }>;
  steps: Step[];
}
```
to (adds `checkpointLanes`, leaves `steps` alone for now — `steps`/`Step`/`StepPhase` are removed in Task 8, kept separate so this task stays purely additive):
```ts
export interface Airport {
  code: string;
  name: string;
  verified: boolean;
  lastVerified: string;
  terminals: Terminal[];
  places: Place[];
  /** Gate -> boarding area id, used by the quiet-spot rule. */
  gateAreas: Record<string, string>;
  /** Boarding area id -> approximate schematic position, used to find the nearest quiet spot. */
  areaCenters: Record<string, { x: number; y: number }>;
  /** Security checkpoint lanes with live wait estimates, used by the arrival-time and checkpoint rules. */
  checkpointLanes: CheckpointWait[];
  steps: Step[];
}
```

- [ ] **Step 2: Typecheck (expect an error — `sfoAirport` is now missing `checkpointLanes`)**

Run: `npx tsc --noEmit`
Expected: one error, `Property 'checkpointLanes' is missing in type '{ ... }' but required in type 'Airport'.` in `src/data/mock/sfo.ts`. This confirms the type change took effect; fixed in the next step.

- [ ] **Step 3: Add `checkpointLanes` and a food place to `src/data/mock/sfo.ts`**

Insert immediately after the `areaCenters` block (currently lines 113–115):
```ts
  areaCenters: {
    'area-c': { x: 0.74, y: 0.36 },
  },
  checkpointLanes: [
    {
      checkpoint: 'Checkpoint B — General',
      waitMinutes: 18,
      queueStatus: 'moderate',
      retrievedAt: '2026-10-23T07:00:00-07:00',
    },
    {
      checkpoint: 'Checkpoint B — PreCheck/CLEAR',
      waitMinutes: 6,
      queueStatus: 'low',
      retrievedAt: '2026-10-23T07:00:00-07:00',
    },
  ],
  steps: [
```
(i.e. the `steps: [` line that already follows `areaCenters` is unchanged — only the new `checkpointLanes` block is inserted before it.)

Add a new place to the `places` array, immediately after the `food-court-t1` entry (currently lines 88–100) and before the closing `],` of the `places` array:
```ts
    {
      id: 'grab-and-go-c5',
      type: 'food',
      name: 'Grab-and-go kiosk near Gate C5',
      terminal: 't1',
      x: 0.64,
      y: 0.42,
      hours: '5:00 AM – 9:00 PM',
      notes: 'Prepackaged snacks, sandwiches and drinks. Estimate, not field-verified.',
      confidence: 'low',
      lastVerified: '2026-10-01',
      source: 'estimate',
    },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/data/mock/sfo.ts
git commit -m "Add checkpoint-lane mock data and a food place type"
```

---

### Task 3: Generalize the nearest-place rule

**Files:**
- Modify: `src/data/client.ts`

**Interfaces:**
- Consumes: `Airport`, `Place`, `PlaceType` from `@/data/types`; `estimateWalkMinutes` (already in this file).
- Produces: `getNearestPlace(airport: Airport, gate: string, type: PlaceType): Place | null`. `getNearestQuietPlace(airport: Airport, gate: string): Place | null` keeps its exact existing signature as a thin wrapper, so `src/app/gate-change.tsx`'s existing call site needs no change. Consumed by Tasks 4–5 (`itinerary.ts`).

- [ ] **Step 1: Replace `getNearestQuietPlace` with a generalized `getNearestPlace` plus a wrapper**

Change the import line (currently line 3) from:
```ts
import type { Airport, FlightLookup, Place, Step, StepPhase } from '@/data/types';
```
to:
```ts
import type { Airport, FlightLookup, Place, PlaceType, Step, StepPhase } from '@/data/types';
```

Replace the existing `getNearestQuietPlace` function and its doc comment (currently lines 30–46):
```ts
/**
 * The quiet-spot rule from CLAUDE.md §4: filter places down to quiet spots,
 * then pick the one nearest the new gate's boarding area. No model decides
 * this — it is a plain nearest-neighbor lookup over the gate-to-area table.
 */
export function getNearestQuietPlace(airport: Airport, gate: string): Place | null {
  const quietPlaces = airport.places.filter((place) => place.type === 'quiet');
  if (quietPlaces.length === 0) return null;

  const areaId = airport.gateAreas[gate];
  const center = areaId ? airport.areaCenters[areaId] : undefined;
  if (!center) return quietPlaces[0];

  return quietPlaces.reduce((nearest, place) =>
    estimateWalkMinutes(center, place) < estimateWalkMinutes(center, nearest) ? place : nearest,
  );
}
```
with:
```ts
/**
 * The nearest-place rule from CLAUDE.md §4: filter places down to one type,
 * then pick the one nearest the gate's boarding area. No model decides
 * this — it is a plain nearest-neighbor lookup over the gate-to-area table.
 */
export function getNearestPlace(airport: Airport, gate: string, type: PlaceType): Place | null {
  const matches = airport.places.filter((place) => place.type === type);
  if (matches.length === 0) return null;

  const areaId = airport.gateAreas[gate];
  const center = areaId ? airport.areaCenters[areaId] : undefined;
  if (!center) return matches[0];

  return matches.reduce((nearest, place) =>
    estimateWalkMinutes(center, place) < estimateWalkMinutes(center, nearest) ? place : nearest,
  );
}

/** Thin wrapper kept for existing call sites (Map, Gate Change). */
export function getNearestQuietPlace(airport: Airport, gate: string): Place | null {
  return getNearestPlace(airport, gate, 'quiet');
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Regression-verify against the already-built Gate Change screen**

This refactor doesn't change the math, only parameterizes it — confirm with the existing feature:

Run: `npx expo start`, open in Expo Go (or the iOS simulator), go to Home → tap "Simulate gate change" (uses the demo flight, gate changes from C2 to C7).

Expected: the gate-change screen's "Picked for your profile" card still shows **"Quiet seating near Gate C9"** with an estimated walk time of **1 min** — this is the same place and number the app already showed before this refactor (gate C7 → `area-c` center `(0.74, 0.36)`; distance to `quiet-nook-c9 (0.78, 0.34)` ≈ 0.045 → `round(0.045 × 18)` = 1 min walk, which is nearer than `sensory-room-t1 (0.52, 0.46)` at ≈ 0.242 distance → 4 min walk).

- [ ] **Step 4: Commit**

```bash
git add src/data/client.ts
git commit -m "Generalize getNearestQuietPlace into a type-parameterized getNearestPlace"
```

---

### Task 4: Itinerary module — arrival time and checkpoint lane

**Files:**
- Create: `src/data/itinerary.ts`

**Interfaces:**
- Consumes: `Airport`, `CheckpointWait`, `FlightLookup`, `Place`, `Profile` from `@/data/types`; `TripDetails` from `@/data/trip-details` (Task 1).
- Produces: `Itinerary` interface (full shape, `postSecurity` filled in by Task 5); `recommendCheckpointLane(checkpointLanes: CheckpointWait[], tripDetails: TripDetails): CheckpointWait | null`; `recommendArrivalTime(flight: FlightLookup, tripDetails: TripDetails, profile: Profile, checkpoint: CheckpointWait | null): { time: string; bufferMinutes: number }`. Both consumed by Task 5's `buildItinerary()` and verified at runtime in Task 7.

- [ ] **Step 1: Create `src/data/itinerary.ts`**

```ts
import type { Airport, CheckpointWait, FlightLookup, Place, Profile } from '@/data/types';
import type { TripDetails } from '@/data/trip-details';

/**
 * The whole computed trip plan for Calm Guide. Built once per flight by
 * buildItinerary() from verified/estimate-labeled inputs only — no model
 * decides any of this. See CLAUDE.md §3 and
 * docs/superpowers/specs/2026-10-23-pre-security-planning-design.md.
 */
export interface Itinerary {
  recommendedArrival: { time: string; bufferMinutes: number };
  recommendedCheckpoint: CheckpointWait | null;
  tsaReminder: { text: string; links: { label: string }[] };
  visaReminder: { text: string; links: { label: string }[] } | null;
  postSecurity: {
    minutesUntilBoarding: number;
    quietOption: { place: Place; canMakeIt: boolean } | null;
    foodOption: { place: Place; canMakeIt: boolean } | null;
  };
}

const DOMESTIC_BASE_MINUTES = 120;
const INTERNATIONAL_BASE_MINUTES = 180;
const CHECKED_BAG_MINUTES = 30;
const PRECHECK_DISCOUNT_MINUTES = 15;
const BOARDING_PASS_DISCOUNT_MINUTES = 10;
const FIRST_FLIGHT_MINUTES = 20;
export const GATE_ARRIVAL_BUFFER_MINUTES = 10;

export function recommendCheckpointLane(
  checkpointLanes: CheckpointWait[],
  tripDetails: TripDetails,
): CheckpointWait | null {
  if (checkpointLanes.length === 0) return null;

  const preferred = tripDetails.hasPreCheck
    ? checkpointLanes.find(
        (lane) => lane.checkpoint.includes('PreCheck') || lane.checkpoint.includes('CLEAR'),
      )
    : checkpointLanes.find((lane) => lane.checkpoint.includes('General'));

  return preferred ?? checkpointLanes[0];
}

export function recommendArrivalTime(
  flight: FlightLookup,
  tripDetails: TripDetails,
  profile: Profile,
  checkpoint: CheckpointWait | null,
): { time: string; bufferMinutes: number } {
  let bufferMinutes = tripDetails.isInternational ? INTERNATIONAL_BASE_MINUTES : DOMESTIC_BASE_MINUTES;
  if (tripDetails.checkingBag) bufferMinutes += CHECKED_BAG_MINUTES;
  if (tripDetails.hasPreCheck) bufferMinutes -= PRECHECK_DISCOUNT_MINUTES;
  if (tripDetails.hasBoardingPass) bufferMinutes -= BOARDING_PASS_DISCOUNT_MINUTES;
  if (profile.firstFlight) bufferMinutes += FIRST_FLIGHT_MINUTES;
  if (checkpoint) bufferMinutes += checkpoint.waitMinutes;

  const departure = new Date(flight.scheduledDeparture);
  const arrival = new Date(departure.getTime() - bufferMinutes * 60_000);

  return { time: arrival.toISOString(), bufferMinutes };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean). (`Itinerary.postSecurity` is a required field with no producer yet, but nothing constructs an `Itinerary` object until Task 5, so this is not a type error — only `Itinerary`'s *declaration* exists so far.)

- [ ] **Step 3: Hand-verify the two branches against worked examples**

Using the demo flight (`flight.scheduledDeparture = '2026-10-23T09:40:00-07:00'`) and `sfoAirport.checkpointLanes` from Task 2:

*Checking a bag, no boarding pass yet, no PreCheck, domestic, not first flight:*
- `recommendCheckpointLane(lanes, { hasPreCheck: false, ... })` → finds `'Checkpoint B — General'` (18 min wait).
- `recommendArrivalTime`: `120 (domestic) + 30 (bag) − 0 (no boarding-pass discount, since hasBoardingPass is false) − 0 (no PreCheck discount) + 0 (not first flight) + 18 (checkpoint) = 168` minutes.
- Expected `bufferMinutes`: **168**. Expected arrival: `09:40 − 2h48m` = **06:52 local time**.

*No bag, no boarding pass yet, has PreCheck, domestic, not first flight:*
- `recommendCheckpointLane(lanes, { hasPreCheck: true, ... })` → finds `'Checkpoint B — PreCheck/CLEAR'` (6 min wait).
- `recommendArrivalTime`: `120 − 0 (no boarding-pass discount) − 15 (PreCheck discount) + 6 (checkpoint) = 111` minutes.
- Expected `bufferMinutes`: **111**. Expected arrival: `09:40 − 1h51m` = **07:49 local time**.

*Same as the first example, but already has a boarding pass:*
- `recommendArrivalTime`: `120 + 30 (bag) − 10 (boarding-pass discount) + 18 (checkpoint) = 158` minutes.
- Expected `bufferMinutes`: **158**. Expected arrival: `09:40 − 2h38m` = **07:02 local time**.

Re-derive these by reading the code above against each input set and confirm the arithmetic matches. (Runtime confirmation of the first two numbers on-screen happens in Task 7, Step 3; the third is a desk-check only, not re-verified on screen, since Task 7's walkthrough doesn't toggle every combination.)

- [ ] **Step 4: Commit**

```bash
git add src/data/itinerary.ts
git commit -m "Add arrival-time and checkpoint-lane recommendation logic"
```

---

### Task 5: Itinerary module — post-security options and buildItinerary()

**Files:**
- Modify: `src/data/itinerary.ts`

**Interfaces:**
- Consumes: `getNearestPlace`, `estimateWalkMinutes`, `YOU_POSITION` from `@/data/client` (Task 3); `recommendCheckpointLane`, `recommendArrivalTime`, `Itinerary` from this same file (Task 4).
- Produces: `recommendPostSecurityOptions(airport: Airport, flight: FlightLookup, now: Date): Itinerary['postSecurity']`; `buildItinerary(airport: Airport, flight: FlightLookup, tripDetails: TripDetails, profile: Profile, now: Date): Itinerary`. `buildItinerary` is consumed by Task 7 (`calm-guide.tsx`).

- [ ] **Step 1: Add the import and the two functions to `src/data/itinerary.ts`**

Change the import line (currently line 1) from:
```ts
import type { Airport, CheckpointWait, FlightLookup, Place, Profile } from '@/data/types';
```
to:
```ts
import type { Airport, CheckpointWait, FlightLookup, Place, Profile } from '@/data/types';
import { estimateWalkMinutes, getNearestPlace, YOU_POSITION } from '@/data/client';
```

Append to the end of the file (after `recommendArrivalTime`):
```ts

export function recommendPostSecurityOptions(
  airport: Airport,
  flight: FlightLookup,
  now: Date,
): Itinerary['postSecurity'] {
  const gateAreaId = airport.gateAreas[flight.gate];
  const gateCenter = gateAreaId ? airport.areaCenters[gateAreaId] : YOU_POSITION;

  const departure = new Date(flight.scheduledDeparture);
  const minutesUntilBoarding =
    Math.round((departure.getTime() - now.getTime()) / 60_000) - GATE_ARRIVAL_BUFFER_MINUTES;

  function buildOption(type: 'quiet' | 'food'): { place: Place; canMakeIt: boolean } | null {
    const place = getNearestPlace(airport, flight.gate, type);
    if (!place) return null;
    const roundTripMinutes = estimateWalkMinutes(gateCenter, place) * 2;
    return { place, canMakeIt: roundTripMinutes <= minutesUntilBoarding };
  }

  return {
    minutesUntilBoarding,
    quietOption: buildOption('quiet'),
    foodOption: buildOption('food'),
  };
}

export function buildItinerary(
  airport: Airport,
  flight: FlightLookup,
  tripDetails: TripDetails,
  profile: Profile,
  now: Date,
): Itinerary {
  const recommendedCheckpoint = recommendCheckpointLane(airport.checkpointLanes, tripDetails);
  const recommendedArrival = recommendArrivalTime(flight, tripDetails, profile, recommendedCheckpoint);
  const postSecurity = recommendPostSecurityOptions(airport, flight, now);

  return {
    recommendedArrival,
    recommendedCheckpoint,
    tsaReminder: {
      text:
        'At the checkpoint, you may need to remove laptops and liquids from your bag and walk through a scanner — a pat-down is sometimes part of screening. A Sunflower lanyard can signal to staff that you may need extra patience, though it is not a fast pass.',
      links: [{ label: 'TSA Cares' }, { label: 'MagnusCards' }],
    },
    visaReminder: tripDetails.isInternational
      ? {
          text:
            "Check your destination's passport and visa requirements before you fly — rules vary by citizenship and destination and are not looked up in this demo.",
          links: [{ label: 'U.S. State Department travel advisories' }],
        }
      : null,
    postSecurity,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Hand-verify against worked examples**

Using the post-gate-change demo flight (gate `C7`, `scheduledDeparture = '2026-10-23T09:40:00-07:00'`), `area-c` center `(0.74, 0.36)`, nearest quiet place `quiet-nook-c9 (0.78, 0.34)` (1 min walk, from Task 3's verification), nearest food place `grab-and-go-c5 (0.64, 0.42)` (distance ≈ 0.117 → `round(0.117 × 18)` = 2 min walk):

*Plenty of time (`now = '2026-10-23T09:00:00-07:00'`, 40 min before departure):*
- `minutesUntilBoarding = 40 − 10 = 30`.
- Quiet round trip = `1 × 2 = 2` ≤ 30 → `canMakeIt: true`.
- Food round trip = `2 × 2 = 4` ≤ 30 → `canMakeIt: true`.

*Tight on time (`now = '2026-10-23T09:32:00-07:00'`, 8 min before departure):*
- `minutesUntilBoarding = 8 − 10 = −2`.
- Quiet round trip `2` ≤ `−2`? No → `canMakeIt: false`.
- Food round trip `4` ≤ `−2`? No → `canMakeIt: false`.
- This is the intended "not enough time, go straight to the gate" case, and the negative `minutesUntilBoarding` is expected and must not be clamped — it's genuinely urgent information (see Global Constraints).

Re-derive these by reading the code against the two `now` values. (Runtime confirmation happens in Task 7, Step 3.)

- [ ] **Step 4: Commit**

```bash
git add src/data/itinerary.ts
git commit -m "Add post-security recommendation logic and buildItinerary()"
```

---

### Task 6: Map screen — add the Food filter

**Files:**
- Modify: `src/app/(tabs)/map.tsx`

**Interfaces:**
- Consumes: the new `'food'` `PlaceType` (Task 2) and the new `grab-and-go-c5` mock place (Task 2).
- Produces: no new exports — this closes the knock-on gap identified in spec §3.3 (without this, food places would silently never render).

- [ ] **Step 1: Add the Food filter, pin icon, type label, and initial filter state**

Change the `FILTERS` array (currently lines 17–21) from:
```ts
const FILTERS: { type: PlaceType; label: string }[] = [
  { type: 'quiet', label: 'Quiet spots' },
  { type: 'loud', label: 'Loud areas' },
  { type: 'service', label: 'Services' },
];
```
to:
```ts
const FILTERS: { type: PlaceType; label: string }[] = [
  { type: 'quiet', label: 'Quiet spots' },
  { type: 'loud', label: 'Loud areas' },
  { type: 'service', label: 'Services' },
  { type: 'food', label: 'Food' },
];
```

Change `PIN_ICON` (currently lines 23–26) from:
```ts
const PIN_ICON: Record<'quiet' | 'service', 'moon.zzz.fill' | 'info.circle.fill'> = {
  quiet: 'moon.zzz.fill',
  service: 'info.circle.fill',
};
```
to:
```ts
const PIN_ICON: Record<'quiet' | 'service' | 'food', 'moon.zzz.fill' | 'info.circle.fill' | 'fork.knife'> = {
  quiet: 'moon.zzz.fill',
  service: 'info.circle.fill',
  food: 'fork.knife',
};
```

Change `TYPE_LABEL` (currently lines 28–32) from:
```ts
const TYPE_LABEL: Record<PlaceType, string> = {
  quiet: 'Quiet spot',
  loud: 'Typically busy (estimate)',
  service: 'Service',
};
```
to:
```ts
const TYPE_LABEL: Record<PlaceType, string> = {
  quiet: 'Quiet spot',
  loud: 'Typically busy (estimate)',
  service: 'Service',
  food: 'Food spot',
};
```

Change the `activeFilters` initial state (currently lines 37–41) from:
```ts
  const [activeFilters, setActiveFilters] = useState<Record<PlaceType, boolean>>({
    quiet: true,
    loud: true,
    service: true,
  });
```
to:
```ts
  const [activeFilters, setActiveFilters] = useState<Record<PlaceType, boolean>>({
    quiet: true,
    loud: true,
    service: true,
    food: true,
  });
```

Change the pin icon/color lookup inside the `pins.map` block (currently lines 129–133) from:
```tsx
                <IconSymbol
                  name={PIN_ICON[place.type as 'quiet' | 'service']}
                  size={26}
                  color={place.type === 'quiet' ? Colors.primary : Colors.border}
                />
```
to:
```tsx
                <IconSymbol
                  name={PIN_ICON[place.type as 'quiet' | 'service' | 'food']}
                  size={26}
                  color={place.type === 'quiet' ? Colors.primary : Colors.border}
                />
```

Add a fourth legend entry after the existing three (currently lines 145–149):
```tsx
          <View style={styles.legend}>
            <LegendItem icon="moon.zzz.fill" color={Colors.primary} label="Quiet" />
            <LegendItem icon="info.circle.fill" color={Colors.border} label="Service" />
            <LegendItem icon="fork.knife" color={Colors.border} label="Food" />
            <LegendItem icon="square.dashed" color={Colors.estimateBorder} label="Loud (estimate)" />
          </View>
```

Change the `LegendItem` prop type (currently line 168) from:
```tsx
function LegendItem({ icon, color, label }: { icon: 'moon.zzz.fill' | 'info.circle.fill' | 'square.dashed'; color: string; label: string }) {
```
to:
```tsx
function LegendItem({ icon, color, label }: { icon: 'moon.zzz.fill' | 'info.circle.fill' | 'fork.knife' | 'square.dashed'; color: string; label: string }) {
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no output (clean) from both.

- [ ] **Step 3: Manual check**

Run: `npx expo start`, open the Map tab, confirm a fourth "Food" filter chip appears and toggling it shows/hides a fork-and-knife pin near Gate C5 (around 64% across, 42% down the schematic); tap it and confirm the bottom card shows "Grab-and-go kiosk near Gate C5" with a "Food spot" pill, a walk time, and both "Take me there" and "Report a problem" buttons (same behavior as any other non-loud place).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/map.tsx"
git commit -m "Add a Food filter to the Map screen"
```

---

### Task 7: Rewrite Calm Guide as the 5-step personalized flow

**Files:**
- Modify: `src/app/(tabs)/calm-guide.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getAirport`, `getFlightStatus` from `@/data/client`; `buildItinerary`, `Itinerary` from `@/data/itinerary` (Tasks 4–5); `getProfile`, `defaultProfile` from `@/data/profile`; `getSavedFlight` from `@/data/saved-flight`; `getTripDetails`, `saveTripDetails`, `defaultTripDetails`, `TripDetails` from `@/data/trip-details` (Task 1); `formatTime` from `@/lib/format`; `Chip` from `@/components/chip`.
- Produces: no new exports (default screen export only). This task does not yet remove the old `Step`/`StepPhase`/`getSteps`/`STEP_PHASE_LABEL` code that Home still uses — that's Task 9.

- [ ] **Step 1: Replace the full contents of `src/app/(tabs)/calm-guide.tsx`**

```tsx
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getAirport, getFlightStatus } from '@/data/client';
import { buildItinerary, type Itinerary } from '@/data/itinerary';
import { defaultProfile, getProfile } from '@/data/profile';
import { getSavedFlight } from '@/data/saved-flight';
import { defaultTripDetails, getTripDetails, saveTripDetails, type TripDetails } from '@/data/trip-details';
import type { Airport, FlightLookup, Place, Profile } from '@/data/types';
import { formatTime } from '@/lib/format';

const NEED_A_MINUTE_PHRASE =
  "I'm overwhelmed right now and need a quiet moment. Could you help me find a calm place nearby?";

const STEP_TITLES = ['Trip details', 'Leave-by time', 'Checkpoint', 'Before security', 'After security'];

export default function CalmGuideScreen() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [tripDetails, setTripDetails] = useState<TripDetails>(defaultTripDetails);
  const [stepIndex, setStepIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const listeningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAirport('SFO').then(setAirport);
    getProfile().then(setProfile);
    getTripDetails().then(setTripDetails);
    getSavedFlight().then(async (saved) => {
      if (!saved) return;
      const result = await getFlightStatus(saved.flightNumber, saved.date);
      setFlight(result);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (listeningTimeout.current) clearTimeout(listeningTimeout.current);
    };
  }, []);

  const itinerary = useMemo<Itinerary | null>(() => {
    if (!airport || !flight) return null;
    return buildItinerary(airport, flight, tripDetails, profile, new Date());
  }, [airport, flight, tripDetails, profile]);

  if (!airport || !flight || !itinerary) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">Add a flight to get started</ThemedText>
            <ThemedText themeColor="textSecondary">
              Calm Guide needs a flight that matches this demo&apos;s data to build your steps.
            </ThemedText>
            <Button label="Add or edit your flight" onPress={() => router.push('/flight-lookup')} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isLast = stepIndex === STEP_TITLES.length - 1;
  const isFirst = stepIndex === 0;

  function handleListen() {
    if (listeningTimeout.current) clearTimeout(listeningTimeout.current);
    setListening(true);
    listeningTimeout.current = setTimeout(() => setListening(false), 1800);
  }

  function handleBack() {
    setListening(false);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  async function handleNext() {
    setListening(false);
    if (stepIndex === 0) {
      await saveTripDetails(tripDetails);
    }
    if (isLast) {
      router.push('/');
      return;
    }
    setStepIndex((index) => Math.min(STEP_TITLES.length - 1, index + 1));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Calm Guide
            </ThemedText>
            <Pill>{`Step ${stepIndex + 1} of ${STEP_TITLES.length}`}</Pill>
          </View>

          <ThemedText type="title">{STEP_TITLES[stepIndex]}</ThemedText>

          {stepIndex === 0 && <TripDetailsStep tripDetails={tripDetails} onChange={setTripDetails} />}
          {stepIndex === 1 && <ArrivalTimeStep itinerary={itinerary} />}
          {stepIndex === 2 && <CheckpointStep itinerary={itinerary} />}
          {stepIndex === 3 && <TsaReminderStep itinerary={itinerary} />}
          {stepIndex === 4 && <PostSecurityStep itinerary={itinerary} flight={flight} />}

          <Pressable
            onPress={handleListen}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Playing this step' : 'Listen to this step'}
            style={({ pressed }) => [styles.listenButton, pressed && styles.listenButtonPressed]}>
            <IconSymbol name={listening ? 'waveform' : 'play.fill'} size={32} color={Colors.surface} />
            <ThemedText type="subtitle" style={styles.listenLabel}>
              {listening ? 'Playing…' : 'Listen'}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.listenNote}>
            Spoken audio for this step is coming soon — this button is a placeholder for now.
          </ThemedText>

          <View style={styles.navRow}>
            <Button
              label="Back"
              variant="secondary"
              onPress={handleBack}
              style={[styles.navButton, isFirst && styles.navButtonDisabled]}
            />
            <View style={styles.navGap} />
            <Button label={isLast ? 'Done' : 'Next'} onPress={handleNext} style={styles.navButton} />
          </View>

          <Card style={styles.needAMinuteCard}>
            <View style={styles.rowCenter}>
              <IconSymbol name="hand.raised.fill" size={18} color={Colors.estimateText} />
              <ThemedText type="smallBold" themeColor="textSecondary">
                Need a minute?
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.needAMinutePhrase}>
              {NEED_A_MINUTE_PHRASE}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Show this to airport staff if it helps.
            </ThemedText>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function TripDetailsStep({
  tripDetails,
  onChange,
}: {
  tripDetails: TripDetails;
  onChange: (details: TripDetails) => void;
}) {
  function toggle<K extends keyof TripDetails>(key: K) {
    onChange({ ...tripDetails, [key]: !tripDetails[key] });
  }

  return (
    <View style={styles.stepBody}>
      <ThemedText themeColor="textSecondary">
        A few quick questions so later steps only show what applies to you.
      </ThemedText>
      <YesNoRow label="Checking a bag?" value={tripDetails.checkingBag} onToggle={() => toggle('checkingBag')} />
      <YesNoRow
        label="Already have a boarding pass?"
        value={tripDetails.hasBoardingPass}
        onToggle={() => toggle('hasBoardingPass')}
      />
      <YesNoRow
        label="Have TSA PreCheck or CLEAR?"
        value={tripDetails.hasPreCheck}
        onToggle={() => toggle('hasPreCheck')}
      />
      <YesNoRow
        label="International flight?"
        value={tripDetails.isInternational}
        onToggle={() => toggle('isInternational')}
      />
    </View>
  );
}

function YesNoRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.yesNoRow}>
      <ThemedText type="smallBold" style={styles.yesNoLabel}>
        {label}
      </ThemedText>
      <View style={styles.chipRow}>
        <Chip label="Yes" selected={value} onPress={onToggle} />
        <Chip label="No" selected={!value} onPress={onToggle} />
      </View>
    </View>
  );
}

function ArrivalTimeStep({ itinerary }: { itinerary: Itinerary }) {
  return (
    <Card style={styles.stepBody}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        Estimate
      </ThemedText>
      <ThemedText type="title">Leave by {formatTime(itinerary.recommendedArrival.time)}</ThemedText>
      <ThemedText themeColor="textSecondary">
        That includes about a {itinerary.recommendedArrival.bufferMinutes}-minute buffer before your
        flight, based on your trip details and the current checkpoint wait.
      </ThemedText>
    </Card>
  );
}

function CheckpointStep({ itinerary }: { itinerary: Itinerary }) {
  const checkpoint = itinerary.recommendedCheckpoint;

  if (!checkpoint) {
    return (
      <Card style={styles.stepBody}>
        <ThemedText themeColor="textSecondary">
          Checkpoint wait data isn&apos;t available for this airport yet.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card style={styles.stepBody}>
      <ThemedText type="subtitle">{checkpoint.checkpoint}</ThemedText>
      <View style={styles.rowCenter}>
        <Pill variant={checkpoint.queueStatus === 'low' ? 'success' : 'estimate'}>
          {`${checkpoint.waitMinutes} min wait`}
        </Pill>
        <ThemedText type="small" themeColor="textSecondary">
          {checkpoint.queueStatus} queue (estimate)
        </ThemedText>
      </View>
    </Card>
  );
}

function TsaReminderStep({ itinerary }: { itinerary: Itinerary }) {
  return (
    <View style={styles.stepBody}>
      <Card>
        <ThemedText type="subtitle">What to expect</ThemedText>
        <ThemedText>{itinerary.tsaReminder.text}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          More: {itinerary.tsaReminder.links.map((link) => link.label).join(', ')}
        </ThemedText>
      </Card>
      {itinerary.visaReminder && (
        <Card style={styles.visaCard}>
          <ThemedText type="subtitle">International flight</ThemedText>
          <ThemedText>{itinerary.visaReminder.text}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            More: {itinerary.visaReminder.links.map((link) => link.label).join(', ')}
          </ThemedText>
        </Card>
      )}
    </View>
  );
}

function PostSecurityStep({ itinerary, flight }: { itinerary: Itinerary; flight: FlightLookup }) {
  const { postSecurity } = itinerary;

  return (
    <View style={styles.stepBody}>
      <ThemedText themeColor="textSecondary">
        About {Math.max(postSecurity.minutesUntilBoarding, 0)} min until boarding (estimate).
      </ThemedText>
      <Button label={`Go to Gate ${flight.gate}`} onPress={() => router.push('/')} />
      <OptionButton
        label="Go to a quiet spot"
        option={postSecurity.quietOption}
        onPress={(placeId) => router.push({ pathname: '/map', params: { focus: placeId } })}
      />
      <OptionButton
        label="Get food"
        option={postSecurity.foodOption}
        onPress={(placeId) => router.push({ pathname: '/map', params: { focus: placeId } })}
      />
    </View>
  );
}

function OptionButton({
  label,
  option,
  onPress,
}: {
  label: string;
  option: { place: Place; canMakeIt: boolean } | null;
  onPress: (placeId: string) => void;
}) {
  if (!option) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {label}: not available near this gate.
      </ThemedText>
    );
  }

  if (!option.canMakeIt) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {label} ({option.place.name}): not enough time before boarding — heading to the gate is
        recommended.
      </ThemedText>
    );
  }

  return (
    <Button
      label={`${label}: ${option.place.name}`}
      variant="secondary"
      onPress={() => onPress(option.place.id)}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepBody: {
    gap: Spacing.two,
  },
  yesNoRow: {
    gap: Spacing.one,
  },
  yesNoLabel: {
    marginBottom: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  visaCard: {
    backgroundColor: Colors.estimateFill,
  },
  listenButton: {
    minHeight: 120,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  listenButtonPressed: { opacity: 0.85 },
  listenLabel: { color: Colors.surface },
  listenNote: { textAlign: 'center' },
  navRow: { flexDirection: 'row' },
  navGap: { width: Spacing.two },
  navButton: { flex: 1 },
  navButtonDisabled: { opacity: 0.4 },
  needAMinuteCard: {
    backgroundColor: Colors.estimateFill,
    gap: Spacing.two,
  },
  needAMinutePhrase: { color: Colors.estimateText },
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no output (clean) from both. (Home's `index.tsx` still imports `getSteps`/`STEP_PHASE_LABEL`, which still exist until Task 9 — this task does not touch those, so no break here.)

- [ ] **Step 3: Manual walkthrough — confirm the Task 4/5 worked examples on screen**

Run: `npx expo start`. On Home, tap "Add your flight" → "Use demo flight (AA 1623 on 2026-10-23)" → Save. Open the Calm Guide tab.

- **Step 1 (Trip details):** toggle "Checking a bag?" to Yes, leave the rest at their defaults (No). Tap Next — this persists via `saveTripDetails`.
- **Step 2 (Leave-by time):** expect **"Leave by 6:52 AM"** with a **"168-minute buffer"** note (matches Task 4's first worked example: bag + no PreCheck + domestic + not first flight + 18 min checkpoint).
- **Step 3 (Checkpoint):** expect **"Checkpoint B — General"** with an **18 min wait**, moderate queue.
- Go Back to Step 1, switch "Have TSA PreCheck or CLEAR?" to Yes, Next, Next again: expect Step 2 to now read **"Leave by 7:49 AM"** with a **"111-minute buffer"**, and Step 3 to now read **"Checkpoint B — PreCheck/CLEAR"** with a **6 min wait**, low queue (matches Task 4's second worked example).
- **Step 4 (Before security):** confirm the accommodations card renders, and toggle "International flight?" back on Step 1 to confirm a second "International flight" card appears here with the visa reminder text.
- **Step 5 (After security):** with the system clock/demo timing giving a comfortable gap before the 9:40 AM departure, expect both "Go to a quiet spot: Quiet seating near Gate C9" and "Get food: Grab-and-go kiosk near Gate C5" to render as tappable buttons (matches Task 5's "plenty of time" example). Tapping either navigates to the Map tab with that place focused and highlighted.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/calm-guide.tsx"
git commit -m "Rewrite Calm Guide as a personalized 5-step pre-security planning flow"
```

---

### Task 8: Simplify the Home screen's step preview

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports. Removes this screen's dependency on `getSteps`/`STEP_PHASE_LABEL`/`Step`, clearing the way for Task 9 to delete that dead code.

- [ ] **Step 1: Remove the `steps` state and its old "Your next step" card; add a simplified "Plan your trip" prompt**

Change the imports (currently lines 1–16) from:
```ts
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getAirport, getFlightStatus, getSteps } from '@/data/client';
import { getSavedFlight } from '@/data/saved-flight';
import type { Airport, FlightLookup, Place, Step } from '@/data/types';
import { FLIGHT_STATUS_LABEL, formatDateHeader, formatTime, STEP_PHASE_LABEL } from '@/lib/format';
```
to:
```ts
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/icon-symbol';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getAirport, getFlightStatus } from '@/data/client';
import { getSavedFlight } from '@/data/saved-flight';
import type { Airport, FlightLookup, Place } from '@/data/types';
import { FLIGHT_STATUS_LABEL, formatDateHeader, formatTime } from '@/lib/format';
```

Change the state/effect block (currently lines 18–51) from:
```ts
export default function HomeScreen() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [flightDate, setFlightDate] = useState<string | null>(null);
  const [unmatchedFlightNumber, setUnmatchedFlightNumber] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAirport('SFO').then(setAirport);
      getSteps('SFO', 'security').then(setSteps);
      getSavedFlight().then(async (saved) => {
        if (!saved) {
          setFlight(null);
          setFlightDate(null);
          setUnmatchedFlightNumber(null);
          return;
        }
        const result = await getFlightStatus(saved.flightNumber, saved.date);
        if (result) {
          setFlight(result);
          setFlightDate(saved.date);
          setUnmatchedFlightNumber(null);
        } else {
          setFlight(null);
          setFlightDate(null);
          setUnmatchedFlightNumber(saved.flightNumber);
        }
      });
    }, []),
  );

  const quietPlaces = airport?.places.filter((place) => place.type === 'quiet') ?? [];
  const nextStep = steps[0];
```
to:
```ts
export default function HomeScreen() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [flight, setFlight] = useState<FlightLookup | null>(null);
  const [flightDate, setFlightDate] = useState<string | null>(null);
  const [unmatchedFlightNumber, setUnmatchedFlightNumber] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAirport('SFO').then(setAirport);
      getSavedFlight().then(async (saved) => {
        if (!saved) {
          setFlight(null);
          setFlightDate(null);
          setUnmatchedFlightNumber(null);
          return;
        }
        const result = await getFlightStatus(saved.flightNumber, saved.date);
        if (result) {
          setFlight(result);
          setFlightDate(saved.date);
          setUnmatchedFlightNumber(null);
        } else {
          setFlight(null);
          setFlightDate(null);
          setUnmatchedFlightNumber(saved.flightNumber);
        }
      });
    }, []),
  );

  const quietPlaces = airport?.places.filter((place) => place.type === 'quiet') ?? [];
```

Change the "Your next step" block (currently lines 159–197) from:
```tsx
          <View style={styles.sectionHeader}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Your next step
            </ThemedText>
            {steps.length > 0 && <Pill>{`1 of ${steps.length}`}</Pill>}
          </View>

          {nextStep && (
            <>
              <ThemedText type="subtitle">{STEP_PHASE_LABEL[nextStep.phase]}</ThemedText>
              <Card style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  <IconSymbol name="arrow.right" size={18} color={Colors.surface} />
                </View>
                <View style={styles.stepText}>
                  <ThemedText type="smallBold">{nextStep.text}</ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Listen to this step"
                  onPress={() => router.push('/calm-guide')}
                  hitSlop={8}
                  style={styles.playButton}>
                  <IconSymbol name="play.fill" size={16} color={Colors.surface} />
                </Pressable>
              </Card>
            </>
          )}

          <Button label="Start guidance" onPress={() => router.push('/calm-guide')} />
          <Pressable
            onPress={() => router.push('/calm-guide')}
            accessibilityRole="button"
            accessibilityLabel="Show step-by-step details"
            style={styles.linkButton}>
            <ThemedText type="smallBold" themeColor="primary">
              Show step-by-step details
            </ThemedText>
          </Pressable>
```
to:
```tsx
          <Card>
            <View style={styles.rowCenter}>
              <IconSymbol name="waveform" size={16} color={Colors.primary} />
              <ThemedText type="smallBold">Plan your trip</ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">
              Answer a few quick questions and Calm Guide will build your personalized steps —
              when to leave, which checkpoint to use, and what to do after security.
            </ThemedText>
            <Button label="Start guidance" onPress={() => router.push('/calm-guide')} />
          </Card>
```

- [ ] **Step 2: Remove the now-unused `sectionHeader`/`stepRow`/`stepIcon`/`stepText`/`playButton`/`linkButton` styles**

In the `styles` object at the bottom of the file, remove these six now-unused entries (the "Made for your needs" section below still needs its own `sectionHeader` usage, so only remove styles no longer referenced anywhere in the file — `stepRow`, `stepIcon`, `stepText`, `playButton`, and `linkButton`; keep `sectionHeader`, since the "Made for your needs" block still uses it):

Remove (currently within the `styles` block):
```ts
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no output (clean) from both.

- [ ] **Step 4: Manual check**

Run: `npx expo start`, open Home, confirm the "Plan your trip" card renders in place of the old "Your next step" card and its "Start guidance" button navigates to Calm Guide.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "Simplify Home's step preview now that Calm Guide computes its own steps"
```

---

### Task 9: Remove the old static step model and do a final validation pass

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/client.ts`
- Modify: `src/data/mock/sfo.ts`
- Modify: `src/lib/format.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new — pure removal. After this task, `Step`, `StepPhase`, `getSteps`, `STEP_PHASE_LABEL`, and `Airport.steps`/`sfoAirport.steps` no longer exist anywhere in the codebase.

- [ ] **Step 1: Remove `Step`/`StepPhase` and `Airport.steps` from `src/data/types.ts`**

Remove (currently lines 33–40):
```ts
export type StepPhase = 'check-in' | 'security' | 'boarding' | 'gate-change';

export interface Step {
  id: string;
  phase: StepPhase;
  text: string;
  audioUrl: string | null;
}

```

Remove the `steps: Step[];` line from the `Airport` interface (added back in Task 2's diff, now removed):
```ts
  steps: Step[];
```
so the `Airport` interface ends with the `checkpointLanes` field and its closing `}`.

- [ ] **Step 2: Remove the `steps` array from `src/data/mock/sfo.ts`**

Remove the entire `steps: [...]` block (the four step objects for `check-in`/`security`/`boarding`/`gate-change`) from `sfoAirport`, and the trailing comma/brace adjustment so the object still ends validly after `checkpointLanes`.

- [ ] **Step 3: Remove `getSteps` and the unused `Step`/`StepPhase` import from `src/data/client.ts`**

Change the import line from:
```ts
import type { Airport, FlightLookup, Place, PlaceType, Step, StepPhase } from '@/data/types';
```
to:
```ts
import type { Airport, FlightLookup, Place, PlaceType } from '@/data/types';
```

Remove the `getSteps` function at the end of the file:
```ts

export async function getSteps(airportCode: string, phase: StepPhase): Promise<Step[]> {
  const airport = await getAirport(airportCode);
  return airport ? airport.steps.filter((step) => step.phase === phase) : [];
}
```

- [ ] **Step 4: Remove `STEP_PHASE_LABEL` and the unused `StepPhase` import from `src/lib/format.ts`**

Change the import line (currently line 1) from:
```ts
import type { FlightStatus, StepPhase } from '@/data/types';
```
to:
```ts
import type { FlightStatus } from '@/data/types';
```

Remove:
```ts

export const STEP_PHASE_LABEL: Record<StepPhase, string> = {
  'check-in': 'Check in',
  security: 'Go through security',
  boarding: 'Head to your gate',
  'gate-change': 'Handle the gate change',
};
```

- [ ] **Step 5: Full typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no output (clean) from both. This confirms no remaining reference to `Step`, `StepPhase`, `getSteps`, `STEP_PHASE_LABEL`, or `Airport.steps` anywhere in `src/`.

- [ ] **Step 6: Full bundle check**

Run: `npx expo export --platform ios --output-dir /tmp/stillgate-final-export`
Expected: completes with an `Exported: /tmp/stillgate-final-export` line and no bundler errors (confirms no broken module wiring from any removal across the whole plan).

Then clean up: `rm -rf /tmp/stillgate-final-export`

- [ ] **Step 7: Full manual walkthrough on a real device/Expo Go**

Run: `npx expo start`, open in Expo Go on a real iPhone (per CLAUDE.md's standing verification bar), and walk through:
1. Home → "Add your flight" → demo flight → Save.
2. Calm Guide, all 5 steps, trying at least: bag + no PreCheck + domestic, then no bag + PreCheck + international (confirm the visa card appears only when international is Yes).
3. Post-security step with plenty of time (confirm both quiet and food options are tappable buttons) — this requires either running through the flow well before the demo flight's 9:40 AM departure, or temporarily editing `sampleFlight.scheduledDeparture` in `src/data/mock/flight.ts` to a few minutes in the future to exercise the "not enough time" branch, then reverting that edit (do not commit a temporary date change).
4. Map tab: confirm the Food filter chip and the grab-and-go pin still work (Task 6 regression check).
5. Gate Change screen via Home's "Simulate gate change": confirm the quiet-spot suggestion still works (Task 3 regression check).

- [ ] **Step 8: Commit**

```bash
git add src/data/types.ts src/data/client.ts src/data/mock/sfo.ts src/lib/format.ts
git commit -m "Remove the old static step model now that Calm Guide computes its own steps"
```
