# Real SFO Terminal 1 schematic — design

Date: 2026-10-23
Status: Approved by Tyler, pending spec review

## 1. Purpose

Replace the Map screen's placeholder background (a flat colored box with no
real shape) with a custom-drawn schematic of SFO's actual Harvey Milk
Terminal 1 — not a reuse of SFO's proprietary map image (out of scope per
CLAUDE.md §12), but our own artwork informed by SFO's real, public layout.
This also expands the place data from one short concourse to the terminal's
two real boarding areas, pulling in real named amenities instead of
generic/invented placeholders.

This is new scope beyond CLAUDE.md §4's mockup spec, which only ever assumed
one unnamed concourse. It fully replaces `MapScreen`'s schematic background
and the `places`/`gateAreas`/`areaCenters` content of `sfoAirport` in
`src/data/mock/sfo.ts`. It does not touch Home's `MapPreview` (a small,
abstract decorative preview, not a literal map — left as-is), and it does not
touch the quiet-spot recommendation rule's logic, only the data it reads.

## 2. Real-world facts this design is based on

(Public airport-guide research, October 2026 — not SFO's own architectural
plans. See CLAUDE.md §11: treat as informed-but-unverified, same bar as the
rest of the mock data.)

- Harvey Milk Terminal 1 has one security checkpoint, **Checkpoint B**
  (matches the name used by the real Checkpoint Wait Time API per CLAUDE.md
  §6), feeding two boarding areas:
  - **Boarding Area C**: gates **C2–C11**. Shorter concourse. The real SFO
    Sensory Room is here, post-security, near Gate C2 (source: flysfo.com,
    already in the existing mock data).
  - **Boarding Area B**: gates **B6–B27**. Longer, newly-expanded concourse
    — B1–B4 are ~2 minutes from the checkpoint, B19–B27 are ~10 minutes.
- Real named amenities (source: public SFO terminal/dining guides, not
  flysfo.com):
  - Area C: **Perry's** (full-service restaurant, near C1/C2), **Farmerbrown**
    (Southern comfort food, near C4).
  - Area B: **Amy's Drive Thru** (near B6), **Illy Caffè** (near B9),
    **Starbird** (near B13), **Mama Go's Filipino Cuisine** (near B18),
    **Café X**, 24 hours (near B20).
- Membership lounges (Delta Sky Club, Alaska Lounge, Admirals Club, The Club
  SFO) and retail shops (L'Occitane, iStore, NYS Eyewear) are intentionally
  **excluded** — not usable by a general sensory-sensitive traveler without
  membership/purchase, and outside what this app helps with.

## 3. Shape & layout

A single logical canvas, wider than tall, rendered as SVG
(`viewBox="0 0 960 420"`, 1 unit = 1 point so pixel math and fraction math
stay in the same units):

- **Hub** (the checkpoint region): a rounded rect centered at `(160, 210)`,
  110×100. This is where the existing `checkpoint-b` place pin sits.
- **Area C pier** (short): a straight concourse strip, centerline from
  `(200, 180)` to `(470, 70)`, width 70. Represents the shorter, more
  established concourse.
- **Area B pier** (long): a straight concourse strip, centerline from
  `(200, 240)` to `(920, 380)`, width 70. Represents the longer, newer
  concourse.
- Floor fill: `Colors.neutralFillAlt`. Wall stroke: `Colors.border`,
  width 2. This is drawn by one new component and nothing else — it does not
  render place pins, loud-zone dashes, or the "You" marker; those stay in
  `MapScreen` exactly as they work today, just fed new coordinates.
- **Gate tick marks**: short perpendicular lines on each pier's outer edge.
  - Area C: 10 ticks (C2..C11) evenly spaced from `t=0.12` to `t=0.95` along
    the centerline (`t=0` at the hub end). Labeled ticks: first (C2), last
    (C11), and every 3rd in between (C5, C8).
  - Area B: 22 ticks (B6..B27) evenly spaced from `t=0.08` to `t=0.97`.
    Labeled ticks: first (B6), last (B27), and every 3rd in between (B9,
    B12, B15, B18, B21, B24).
- A small caption near the schematic (same visual weight as the existing
  "Last verified" text): **"Drawn from public layout info, not SFO's
  official architectural plans."**

Place pins keep using the exact same fractional `x`/`y` + `Pressable`
overlay mechanism already in `map.tsx` (`left: ${x*100}%`, `top:
${y*100}%`); only the coordinate values and the container's underlying
aspect ratio change. A place's fraction is its pixel position on the
960×420 canvas divided by 960 (x) / 420 (y).

## 4. Data model changes (`src/data/mock/sfo.ts`)

### 4.1 `gateAreas`

Replace the current `C1`–`C9` → `area-c` map with the real ranges:

```ts
gateAreas: {
  ...Object.fromEntries(['C2','C3','C4','C5','C6','C7','C8','C9','C10','C11'].map((g) => [g, 'area-c'])),
  ...Object.fromEntries(
    ['B6','B7','B8','B9','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','B21','B22','B23','B24','B25','B26','B27'].map((g) => [g, 'area-b']),
  ),
}
```

`sampleFlight`/`sampleFlightAfterGateChange` in `data/mock/flight.ts` use
gates C2 and C7 — both remain valid under the new range, no change needed
there.

### 4.2 `areaCenters`

```ts
areaCenters: {
  'area-c': { x: 470 / 960, y: 70 / 420 },   // tip of the C pier
  'area-b': { x: 920 / 960, y: 380 / 420 },  // tip of the B pier
}
```

(Matches the existing convention: the nearest-quiet-place rule measures from
a boarding area's approximate center/tip, not the hub.)

### 4.3 `places` — full replacement list

All existing places are repositioned (new `x`/`y` only; `id`, `notes`,
`hours`, `confidence`, `source`, `lastVerified` unchanged unless noted) onto
the new canvas. New places use `confidence: 'medium'`, `source: 'public
airport guides, Oct 2026'`, `lastVerified: '2026-10-23'`.

**Area C (existing, repositioned):**

| id | type | near | change |
|---|---|---|---|
| `sensory-room-t1` | quiet | C2, just past hub | reposition only |
| `quiet-nook-c9` | quiet | C9, pier tip | reposition only |
| `restroom-c-mid` | service | C2, near hub | reposition only |
| `info-desk-t1` | service | hub | reposition only |
| `checkpoint-b` | loud | hub | reposition only (now serves both piers) |
| `grab-and-go-c5` | food | C5 | reposition only |
| `food-court-t1` | loud | was generic; now sits at the real C1–C4 dining cluster | reposition + notes updated to "Busy around meal times near the Perry's/Farmerbrown cluster" |

**Area C (new):**

| id | type | near | name | notes |
|---|---|---|---|---|
| `perrys-c2` | food | C2, hub end of the pier | Perry's | Full-service restaurant: chopped salad, burgers, breakfast. Public guides cite it as "near Gate C1," but C1 isn't in this terminal's current gate range — placed at the C2/hub end instead. |
| `farmerbrown-c4` | food | C4 | Farmerbrown | Southern comfort food. |

**Area B (all new):**

| id | type | near | name | notes |
|---|---|---|---|---|
| `restroom-b9` | service | B9 | Restroom | — |
| `restroom-b20` | service | B20 | Restroom | Area B is a ~10 minute walk end to end; a second restroom reflects that length. |
| `amys-drive-thru-b6` | food | B6 | Amy's Drive Thru | 5:00 AM – 11:00 PM. |
| `illy-caffe-b9` | food | B9 | Illy Caffè | 4:30 AM – 8:30 PM. |
| `starbird-b13` | food | B13 | Starbird | 4:00 AM – 11:30 PM. |
| `mama-gos-b18` | food | B18 | Mama Go's Filipino Cuisine | 3:30 AM – 11:30 PM. |
| `cafe-x-b20` | food | B20 | Café X | Open 24 hours. |
| `dining-cluster-b20` | loud | B19–B21 | Dining cluster | Busy around meal times near Café X and the B20 restaurant cluster. Estimate, not a measurement. |

No `quiet`-type place is added in Area B — nothing in the research confirms
one exists there, and inventing one would violate CLAUDE.md's "never present
a guess as verified" rule. The quiet-spot recommendation rule therefore
stays honestly concentrated in Area C, which matches the real terminal (the
real Sensory Room is there, not in Area B).

Total: 17 places (up from 7).

## 5. Component architecture

- **New** `src/components/terminal-schematic.tsx`: a presentational SVG
  component (`react-native-svg`, new dependency — Expo Go compatible, no dev
  client needed) implementing §3's hub/piers/ticks/labels. Takes no data
  props; it is pure background art sized to fill its parent.
- **`src/app/(tabs)/map.tsx`**: replace the `ThemedView type="neutralFillAlt"
  style={styles.schematic}` box with a horizontally-scrolling `ScrollView`
  containing a fixed-size (960×420-ratio) wrapper that stacks
  `TerminalSchematic` underneath the existing pin/loud-zone/You-marker
  `View`s, unchanged in their own logic. The screen keeps vertically
  scrolling as a whole; only the schematic area scrolls horizontally, so
  Area B's 22 gates have room without shrinking tap targets below 44px.
- No changes to `gate-change.tsx`, `index.tsx`, filters, the place card, or
  any data-fetching code — this is a rendering + data-content change only.

## 6. Verification

No automated test covers SVG layout. Verification is manual, per CLAUDE.md's
"verify on a real iPhone" rule:

- Run in Expo Go on a real iPhone.
- Confirm both piers are visibly distinct, gate labels are legible, and the
  horizontal scroll reaches both pier tips.
- Confirm every pin (17 places) lands on/near its intended pier and remains
  tappable at ≥44×44pt.
- Confirm the "Take me there" highlight ring, filters, and the place card
  still work unchanged for a sample of old and new places.
- Confirm VoiceOver reads the new caption and gate labels sensibly (no
  decorative SVG text exposed as unlabeled images).

## 7. Explicitly out of scope

- Real architectural accuracy beyond what's described in §2 — this is a
  stylized schematic, not a blueprint.
- Retail shops and membership lounges (§2).
- Any change to Home's `MapPreview`, the quiet-spot rule's logic, or gate
  data outside `area-b`/`area-c`.
- A second airport (unrelated, already tracked as a separate stretch item in
  CLAUDE.md §9).
