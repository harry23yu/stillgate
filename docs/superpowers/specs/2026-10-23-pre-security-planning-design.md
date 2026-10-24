# Pre-security planning flow (Calm Guide v2) — design

Date: 2026-10-23
Status: Approved by Tyler, pending spec review

## 1. Purpose

Replace the current static, 4-phase Calm Guide (check-in / security / boarding /
gate-change, with hand-written step text) with a personalized, rule-driven
sequence that:

1. Collects a few quick trip-logistics answers up front, so later steps can
   skip what doesn't apply.
2. Recommends a time to leave for the airport, from flight data + a
   checkpoint wait estimate + the traveler's own logistics answers.
3. Recommends which security checkpoint lane to use.
4. Reminds the traveler of TSA accommodations (and, for international
   flights, a generic passport/visa reminder — see §7 for why this is
   generic for now).
5. After security, offers gate / quiet spot / food, biased toward whichever
   option is nearest the gate and still fits in the time remaining.

This is new scope beyond CLAUDE.md §4's original 4-screen mockup spec — the
mockup's Calm Guide was 4 static steps with Listen/Back/Next/Need-a-minute.
This design keeps that shell but makes the content dynamic and personalized.
It **fully replaces** the existing Calm Guide step content (per Tyler's
choice); it does not touch the Gate Change screen, which is a separate,
already-built subsystem.

## 2. Scope boundary: what this spec does NOT include

A global visa-requirements dataset (citizenship × destination → visa
category) was discussed and intentionally deferred to a **separate spec**.
It requires real research (not something to hand-author or improvise
alongside this UI work — see §7). This flow ships with a generic,
link-out-only visa reminder and is designed so the real dataset can be
wired in later behind the same data-module boundary, with no UI changes.

## 3. Data model changes

### 3.1 `TripDetails` (new, on-device, mirrors `data/profile.ts`)

New file `data/trip-details.ts`:

```ts
export interface TripDetails {
  checkingBag: boolean;      // default false
  hasBoardingPass: boolean;  // default false
  hasPreCheck: boolean;      // default false
  isInternational: boolean;  // default false
}

export const defaultTripDetails: TripDetails = {
  checkingBag: false,
  hasBoardingPass: false,
  hasPreCheck: false,
  isInternational: false,
};

export async function getTripDetails(): Promise<TripDetails>;
export async function saveTripDetails(details: TripDetails): Promise<void>;
```

Same AsyncStorage pattern as `Profile` and `SavedFlight` — no new persistence
mechanism.

### 3.2 Checkpoint lanes (mock data, finally using the existing unused
`CheckpointWait` type from `data/types.ts`)

`Airport` gains a `checkpointLanes: CheckpointWait[]` field (parallel to
`places`). `sfoAirport` in `data/mock/sfo.ts` gets two lanes for Checkpoint B:

```ts
checkpointLanes: [
  { checkpoint: 'Checkpoint B — General', waitMinutes: 18, queueStatus: 'moderate', retrievedAt: '2026-10-23T07:00:00-07:00' },
  { checkpoint: 'Checkpoint B — PreCheck/CLEAR', waitMinutes: 6, queueStatus: 'low', retrievedAt: '2026-10-23T07:00:00-07:00' },
]
```

### 3.3 New `PlaceType` value: `'food'`

`PlaceType` becomes `'quiet' | 'loud' | 'service' | 'food'`. Today's "Food
Court" stays a `loud` zone (it's correctly modeled as busy) — add one or two
small `food` places (e.g. a grab-and-go kiosk near the C gates) so there's
something to actually route a hungry traveler *to*.

**Knock-on effect on the Map screen:** `map.tsx` currently filters places via
`activeFilters[place.type]`, with exactly three filter chips (Quiet spots /
Loud areas / Services) and three initial keys in `activeFilters`. Adding
`food` without updating that screen means food places would silently never
render (the lookup returns `undefined`, which is falsy). This design
includes adding a fourth "Food" filter chip, a `food: true` initial filter
key, and a food pin icon (e.g. `fork.knife`) to `map.tsx` as part of this
work — not a separate follow-up.

### 3.4 `Itinerary` (new, computed — not persisted)

New file `data/itinerary.ts` exports the shape and the builder:

```ts
export interface Itinerary {
  recommendedArrival: { time: string; bufferMinutes: number };
  recommendedCheckpoint: CheckpointWait | null;          // null if lane data missing
  tsaReminder: { text: string; links: { label: string }[] };
  visaReminder: { text: string; links: { label: string }[] } | null; // null unless international
  postSecurity: {
    minutesUntilBoarding: number;
    quietOption: { place: Place; canMakeIt: boolean } | null;
    foodOption: { place: Place; canMakeIt: boolean } | null;
  };
}
```

No changes to `FlightLookup`, `Profile`, or existing `Place`/`Airport` shapes
beyond the additive `checkpointLanes` array and the `food` enum value.
Everything already built (Map, Gate Change, Sensory Profile, flight entry)
keeps working untouched.

## 4. Rule logic — `buildItinerary()`

Lives in `data/itinerary.ts`:

```ts
function buildItinerary(
  airport: Airport,
  flight: FlightLookup,
  tripDetails: TripDetails,
  profile: Profile,
  now: Date,
): Itinerary
```

Pure function, no I/O, no model/LLM call — straight arithmetic and lookups,
consistent with CLAUDE.md §3 ("rules choose the steps, Claude only phrases
them"). Computation order: checkpoint lane (§4.2) is resolved first, since
the arrival-time buffer (§4.1) depends on its `waitMinutes`; post-security
(§4.3) is independent and can be computed in any order relative to the other
two.

### 4.1 Recommended arrival time

```
base = tripDetails.isInternational ? 180 : 120      // minutes before departure
+ 30  if tripDetails.checkingBag
− 15  if tripDetails.hasPreCheck
− 10  if tripDetails.hasBoardingPass                  // added during plan self-review — this
                                                       // field was otherwise collected and unused
+ 20  if profile.firstFlight                          // detailLevel === 'detailed'
+ recommendedCheckpoint.waitMinutes                    // 0 if lane data missing
= bufferMinutes

recommendedArrival.time = flight.scheduledDeparture − bufferMinutes
```

Always rendered with "estimate" language (same convention as loudness and
walk-time elsewhere in the app). Never floored/clamped to hide a negative
buffer — if the math comes out negative (departure is very soon), that's
genuinely urgent information and should read as such, not be hidden.

### 4.2 Recommended checkpoint lane

```
recommendedCheckpoint =
  tripDetails.hasPreCheck
    ? checkpointLanes.find(lane => lane is PreCheck/CLEAR)
    : checkpointLanes.find(lane => lane is General)
  ?? checkpointLanes[0]
  ?? null
```

If no lane data exists at all, `recommendedCheckpoint` is `null` and the UI
shows an honest "checkpoint wait data isn't available" message instead of a
fabricated number — keeping the door open for airports/terminals without
lane-level data.

### 4.3 Post-security quiet/food recommendation

```
GATE_ARRIVAL_BUFFER = 10   // minutes you must have left to actually be at the gate

minutesUntilBoarding = (flight.scheduledDeparture − now) − GATE_ARRIVAL_BUFFER

gateCenter = airport.areaCenters[airport.gateAreas[flight.gate]] ?? YOU_POSITION

for category in ['quiet', 'food']:
  candidate = getNearestPlace(airport, flight.gate, category)   // generalized, see 4.4
  roundTripMinutes = estimateWalkMinutes(gateCenter, candidate) * 2
  canMakeIt = candidate != null && roundTripMinutes <= minutesUntilBoarding
```

Both options are always present in the result (so the UI can show *why*
something isn't offered rather than silently omitting it); `canMakeIt: false`
means the UI disables that option with a "not enough time — the gate is
recommended" note. The gate itself is always a live, unconditional option.

### 4.4 Generalizing the nearest-place rule

`getNearestQuietPlace(airport, gate)` in `data/client.ts` becomes:

```ts
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

export function getNearestQuietPlace(airport: Airport, gate: string): Place | null {
  return getNearestPlace(airport, gate, 'quiet');
}
```

`getNearestQuietPlace` is kept as a thin wrapper so the Map screen's existing
call site is untouched.

## 5. UI / screen structure

`calm-guide.tsx`'s shared shell is unchanged: eyebrow + step-counter `Pill`,
title, Back/Next, the same visual-only-placeholder Listen button, and the
"Need a minute?" `Card` pinned on every step. What changes is the step
*content*, which switches on step type. Five steps, in order:

1. **Trip Details** — four `Chip`-based Yes/No toggles (reusing the `Chip`
   component built for the Sensory Profile screen), all defaulting to "No."
   Next is always enabled — there's nothing to validate.
2. **Arrival time** — large readable time ("Leave by 7:40 AM"), one
   breakdown line ("~2 hr buffer, including an estimated 18 min security
   wait"), labeled estimate.
3. **Checkpoint** — recommended lane name + wait estimate + `Pill` for queue
   status, same visual language as Map's place cards. Honest fallback
   message if `recommendedCheckpoint` is `null`.
4. **TSA reminder** — a `Card`: what to expect at the checkpoint, the
   Sunflower lanyard, link-out rows to TSA Cares / MagnusCards (no
   duplication of their content, per CLAUDE.md §8). A second stacked `Card`
   for the visa reminder only when `tripDetails.isInternational` — generic
   text, link-outs to official checkers, explicitly not a real lookup (§7).
5. **Post-security** — three `Button`s: Gate / Quiet spot / Food. Quiet and
   Food show their target place name + walk time when `canMakeIt`, or a
   disabled state with the "not enough time" note when not. Tapping Quiet or
   Food routes to `/map?focus=<placeId>` (same pattern as Gate Change's
   existing "take me to the quiet spot" action). Tapping Gate ends the flow.

**Home screen preview card** changes from previewing one canned step string
to a generic "Plan your trip" prompt into Calm Guide, since there's no
longer one fixed string to preview before the itinerary is computed for a
specific flight.

No new top-level routes — Trip Details is step 1 of Calm Guide, not a
separate screen, per Tyler's choice during brainstorming.

## 6. Error handling / honesty rules

- Missing checkpoint lane data → `recommendedCheckpoint: null`, UI shows an
  honest unavailable-data message, never a fabricated number.
- A detour that can't round-trip in time → option stays visible but
  disabled, with an explicit reason, rather than silently disappearing.
- Missing flight/airport/profile/trip-details data on screen mount → same
  "return an empty `ThemedView` until loaded" guard already used in
  `gate-change.tsx` and `map.tsx`.
- All time-based recommendations are explicitly labeled "estimate" in the UI
  copy, consistent with the rest of the app's loudness/walk-time labeling.

## 7. Deferred: visa requirements dataset (separate future spec)

Discussed during brainstorming: a real citizenship × destination → visa
category dataset (inspired by Passport Index / VisaHQ / TripMemo-style
checkers) would make the visa reminder step genuinely useful instead of
generic. This was explicitly **not** included here because:

- It's a real research task (compiling accurate data, e.g. from Wikipedia's
  visa-requirement tables), not something to hand-author in-line with UI
  work — doing so risks presenting wrong travel-document guidance, which
  CLAUDE.md §1 explicitly warns against ("never present a guess... as
  verified").
- It's independent of this flow's UI and rule engine — it only needs to slot
  in behind one lookup call once it exists.

When that dataset exists, the integration point is: `visaReminder` in
`Itinerary` gains a real lookup by `(citizenship, destination)` instead of
generic text, with its own "last verified" / source labeling. Tyler should
scope that as its own spec when ready to pursue it.

## 8. Testing / validation approach

No test framework is configured in this project (hackathon time budget;
consistent with how everything else in this codebase has been verified so
far). Validation for this feature:

- `npx tsc --noEmit` and `npx expo lint` clean.
- `npx expo export --platform ios` succeeds (catches bundler/module errors).
- Manual walk-through of all 5 steps with each Trip Details combination that
  matters: bag/no-bag, PreCheck/no-PreCheck, international/domestic, and
  both a "plenty of time" and a "not enough time for a detour" case for the
  post-security step (adjust the mock flight's `scheduledDeparture` or the
  system clock to exercise the tight-time branch).
- Visual check in Expo Go on a real iPhone before calling it done, per this
  project's existing verification standard.
