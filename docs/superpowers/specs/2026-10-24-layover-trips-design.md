# Layover trips (multi-flight, connection-aware) — design

**Date:** 2026-10-24
**Status:** Approved design, ready for implementation plan
**Owner:** Tyler (mobile front end)

## 1. Goal

Let a traveler load more than one flight and have Stillgate understand them as a
single journey with a **layover**. The value is the connection itself: when the
traveler reaches the layover airport, the app shows how long the layover is,
which gate the next flight leaves from, and the nearest quiet spot to that gate —
the peak-stress moment for a sensory-sensitive traveler.

A one-leg trip must behave **exactly** as the app does today. This feature
degrades gracefully: it adds a trip layer on top of the existing flow without
changing the single-flight hero demo.

## 2. Decisions (from brainstorm)

- **Connection-aware**, not just a list of flights. The app chains legs and
  recognizes layovers.
- **SFO is flexible** — it may be the origin, the layover, or the final
  destination. The model is a general ordered sequence; any leg's airport can be
  SFO.
- **Entry: add legs, auto-detect connection.** The user adds each flight the same
  way as today (number + departure airport + date). The app orders legs by
  departure time and recognizes a layover when one leg's destination equals the
  next leg's origin. No separate "trip builder" screen.
- **Connection depth: next gate + quiet spot.** The connection view anchors on
  the *next* leg's departure gate (which the app already has). It does **not**
  model the arrival gate or a gate-to-gate walk.

## 3. Scope and what it displaces

This is net-new work layered on the core flow. It touches the data layer, Home,
and flight-lookup, and repoints Map / Calm Guide / gate-change at the active leg.
It does **not** cut into the single-flight demo — a one-leg trip is unchanged.

Per the project's hour-18 cut-off rule: this ships only on top of a solid core
SFO flow. If the core flow is not rock-solid end to end on a real iPhone, this
waits.

**Out of scope for this feature** (tracked separately):

- The Settings screen (dim/dark mode, reduced-motion toggle, text size) is the
  *next* feature, built after this one. Not part of this spec.
- Arrival-gate modeling and gate-to-gate walk timing.
- Automatic schedule/itinerary import (parsing a confirmation email, etc.).
- Live connection re-planning beyond the existing simulated gate change.

## 4. Data model

### 4.1 New storage module: `src/data/saved-trip.ts`

Replaces single-flight storage. Shapes:

```ts
interface SavedLeg {
  flightNumber: string;
  date: string;          // YYYY-MM-DD
  originCode?: string;   // present for saved results
  lookup?: FlightLookup; // resolved flight, saved alongside
}

interface SavedTrip {
  legs: SavedLeg[];      // stored in add order; ordered for display at read time
}
```

`SavedLeg` is the current `SavedFlight` shape, unchanged. Storage key:
`stillgate.savedTrip`.

### 4.2 Migration from single-flight storage

On the first `getSavedTrip()` call: if `stillgate.savedTrip` is absent but the
old `stillgate.savedFlight` key exists and parses, wrap it as
`{ legs: [thatFlight] }`, persist under the new key, and remove the old key.
Existing installs keep their saved flight with no user action.

`src/data/saved-flight.ts` is retired once all callers move to `saved-trip.ts`.

### 4.3 One addition to `FlightLookup`

Add `scheduledArrival?: string` (ISO datetime) to `FlightLookup` in
`src/data/types.ts`. It is needed only to compute layover duration ("2h 15m
between flights") from the inbound leg's arrival. It is optional: when absent, the
connection card omits the duration and labels it unknown — never a guess, per the
project's data rules.

Populate `scheduledArrival` on the demo sample flight(s) that form the demo
layover so the duration shows in the demo. Other mock flights may leave it unset.

## 5. Derivation rules (pure, no model decides anything)

A single helper builds the display model from a `SavedTrip`:

```ts
interface Connection {
  fromLegIndex: number;     // index into the ordered legs
  toLegIndex: number;
  airportCode: string;      // the layover airport (shared code)
  airportMapped: boolean;   // true for SFO / CHS
  layoverMinutes: number | null; // null when inbound arrival time is unknown
}

interface TripView {
  legs: { leg: SavedLeg; flight: FlightLookup | null }[]; // departure order
  connections: Connection[];
  activeLegIndex: number | null; // null when no legs resolve
}

async function buildTripView(trip: SavedTrip, now: Date): Promise<TripView>;
```

Rules:

- **Resolve** each leg's flight: use `leg.lookup` if present, else
  `getFlightStatus(flightNumber, date, originCode)` (same fallback Home uses
  today). A leg whose flight does not resolve is kept and marked unresolved.
- **Order** resolved legs by `scheduledDeparture` ascending. Unresolved legs sort
  last (stable by add order).
- **Connection** between consecutive ordered legs `i` and `i+1` exists when both
  resolve and `legs[i].flight.destination?.code === legs[i+1].flight.origin.code`.
  The layover airport is that shared code. `airportMapped` is true when the code
  is `SFO` or `CHS`.
- **Layover duration** = `legs[i+1].scheduledDeparture − legs[i].scheduledArrival`.
  When the inbound leg has no `scheduledArrival`, `layoverMinutes` is `null`.
- **Active leg** = the earliest resolved leg whose `scheduledDeparture` is in the
  future; if all are in the past, the last resolved leg; `null` if none resolve.

## 6. `saved-trip.ts` public API

```ts
getSavedTrip(): Promise<SavedTrip>              // migrates legacy key; {legs:[]} if none
saveTrip(trip: SavedTrip): Promise<void>
addLeg(leg: SavedLeg): Promise<SavedTrip>       // append; dedupe; returns updated trip
removeLeg(key: LegKey): Promise<SavedTrip>      // returns updated trip
replaceLeg(key: LegKey, leg: SavedLeg): Promise<SavedTrip> // for edit mode
clearTrip(): Promise<void>
getActiveLeg(now?: Date): Promise<{ leg: SavedLeg; flight: FlightLookup } | null>
```

- **Leg identity / dedupe key** (`LegKey`): normalized
  `flightNumber` + `date` + `originCode` (uppercased flight number and origin,
  whitespace-collapsed), matching the normalization used in `flight-provider.ts`.
  `addLeg` is a no-op append when a leg with the same key already exists.
- `getActiveLeg` is the convenience the single-airport screens use (Map, Calm
  Guide): it builds the trip view and returns the active leg's resolved flight.

## 7. Home screen (`src/app/(tabs)/index.tsx`)

The single flight card becomes a **trip stack**:

- **Zero legs:** today's empty state ("Add your flight").
- **One leg:** today's single flight card, unchanged (status pill, route,
  boards/gate/terminal stats, "Simulate gate change" when a gate exists).
- **Two+ legs:** render the ordered legs as cards, with a **connection card**
  rendered between the two legs of each detected connection. The **active leg**
  card carries an "Up next" marker. Consecutive legs with no detected connection
  render as separate cards with a subtle "Separate flights — not a connection"
  note between them.
- An **"Add another flight"** button is shown whenever there is at least one leg;
  it routes to flight-lookup.

Each leg card keeps today's behaviors: tapping the flight number opens
flight-lookup in edit mode for that leg; "Simulate gate change" (when the leg has
a gate) routes to `/gate-change` with that leg's `flight` + `date`.

### 7.1 Connection card content ("next gate + quiet spot")

Built from `Connection` + `recommendPostSecurityOptions(layoverAirport, toLeg,
now)` (reused as-is; it already computes boards-in and the nearest-quiet-spot
make-it timing relative to a gate):

- Heading: `Layover at {airportCode}` + duration (`{Xh Ym} between flights`) when
  `layoverMinutes` is known; when unknown, show the heading and label the duration
  as "arrival time not posted."
- Next flight: `Gate {toLeg.gate} · {toLeg.terminal}` and `Boards in {…}`.
- When `airportMapped`: the nearest quiet spot to `toLeg.gate` with its walk time
  and a make-it indicator ("You have time ✓" or a short-connection warning —
  see §9), plus **Take me there** (highlights the pin) and **Open map**, and a
  **Simulate gate change on this leg** action (routes to `/gate-change` for
  `toLeg`).
- When not `airportMapped`: text-only (duration + next gate + boards-in),
  explicitly labeled that detailed guidance isn't available for that airport.

## 8. flight-lookup screen (`src/app/flight-lookup.tsx`)

Becomes **"Add a flight."** The search UI is unchanged. Changes:

- Saving a found flight calls `addLeg(...)` (append + dedupe) instead of
  overwriting a single flight.
- A compact **"Flights in this trip"** list at the bottom shows current legs with
  a remove (×) control per leg (`removeLeg`).
- **Edit mode:** when navigated with a leg key param (from tapping a leg on Home),
  the screen prefills that leg and Save calls `replaceLeg(key, …)`; remove calls
  `removeLeg(key)`.
- Primary action label reflects mode: "Add this flight" (new) / "Update flight"
  (edit).

## 9. Map / Calm Guide / gate-change

- **Map** (`(tabs)/map.tsx`) and **Calm Guide** (`(tabs)/calm-guide.tsx`): replace
  `getSavedFlight()` with `getActiveLeg()`. They continue to operate on one
  airport — the active leg's.
- **gate-change** (`gate-change.tsx`): no change. It already resolves from
  `flight` + `date` route params via `getFlightStatus`; callers pass the relevant
  leg's values.

## 10. Edge cases

- **Unknown destination** (e.g. the DCA sample has `destination: null`): cannot
  form a connection; the leg renders standalone.
- **Unmapped layover airport** (not SFO/CHS): text-only connection card (§7.1).
- **Unknown inbound arrival time:** omit the duration number, label it.
- **Short connection:** when the round trip to the nearest quiet spot does not fit
  before boarding (`recommendPostSecurityOptions(...).quietOption.canMakeIt ===
  false`), show a clear "Short connection — head straight to Gate {gate}" message
  instead of inviting the detour. If boards-in is negative (already departed),
  treat the leg as past for active-leg selection.
- **Duplicate add:** deduped by `LegKey`.
- **Unresolved flight number:** the leg is kept, shown as unresolved (reusing
  today's "we couldn't find {flightNumber}" treatment), and sorted last.

## 11. Accessibility

Matches the project bar: every new control (Add another flight, per-leg remove,
Take me there, Open map, Simulate gate change) has a screen-reader label; tap
targets ≥ 44 px; no information by color alone (the make-it indicator and
"separate flights" note carry text, not just color); the "Up next" marker is
conveyed in the leg card's accessibility label. The connection and duration
estimates are labeled as estimates, consistent with the rest of the app.

## 12. Testing

- **Pure logic** (`buildTripView` and helpers): ordering by departure; connection
  detection (match vs. no-match vs. null destination); layover-duration present vs.
  unknown; active-leg selection (future vs. all-past vs. none-resolve);
  `airportMapped` flag; dedupe by `LegKey`.
- **Migration:** legacy `stillgate.savedFlight` becomes a one-leg trip and the old
  key is removed; absent legacy key yields `{ legs: [] }`.
- **Manual on device:** build the demo layover trip (two legs that connect through
  SFO), confirm the connection card shows duration, next gate, quiet spot, and
  make-it timing; confirm Map and Calm Guide follow the active leg; confirm a
  one-leg trip is identical to today.

## 13. Demo trip data

Add demo sample flights that form a connection through a mapped airport (SFO or
CHS) so the connection card is fully populated in the demo, including
`scheduledArrival` on the inbound leg. Keep all sample flights clearly labeled as
demo data (`isRecorded: true`), consistent with existing samples.
