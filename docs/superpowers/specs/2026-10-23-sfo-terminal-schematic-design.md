# Real SFO airport schematic — design

Date: 2026-10-23
Status: Approved by Tyler (scope expanded to all 4 SFO terminal buildings
after an explicit cost checkpoint — see §1a), pending spec review

## 1. Purpose

Replace the Map screen's placeholder background (a flat colored box with no
real shape) with a custom-drawn schematic of SFO's actual terminal
complex — not a reuse of SFO's proprietary map image (out of scope per
CLAUDE.md §12), but our own artwork informed by SFO's real, public layout.
This also expands the place data from one short concourse to the airport's
real boarding areas across all four terminal buildings, pulling in real
named amenities instead of generic/invented placeholders.

This is new scope beyond CLAUDE.md §4's mockup spec, which only ever assumed
one unnamed concourse, and beyond this spec's own first draft, which covered
Terminal 1 only (see §1a). It fully replaces `MapScreen`'s schematic
background and the `places`/`gateAreas`/`areaCenters` content of
`sfoAirport` in `src/data/mock/sfo.ts`. It does not touch Home's
`MapPreview` (a small, abstract decorative preview, not a literal map — left
as-is), and it does not touch the quiet-spot recommendation rule's logic,
only the data it reads.

### 1a. Scope history (why this covers the whole airport)

The first version of this spec covered Terminal 1 only (Boarding Areas B and
C). Tyler then asked for the schematic to include the international
terminal too. Research surfaced that SFO has four real terminal buildings in
a horseshoe loop — Terminal 1, 2, 3, and the International Terminal — with
inter-terminal walkways connecting all of them airside. Before expanding,
Tyler was shown the concrete cost (5 separate security-checkpoint hubs, 7
piers total, roughly 25–30 new researched places, none of it reachable by
the app's actual flows, which are Terminal-1-only) and explicitly chose to
proceed with the full horseshoe at the same research bar everywhere. That
decision is final for this spec; it is not re-litigated below.

## 2. Real-world facts this design is based on

(Public airport-guide research, October 2026 — not SFO's own architectural
plans. See CLAUDE.md §11: treat as informed-but-unverified, same bar as the
rest of the mock data.)

**Overall layout.** SFO's four terminal buildings sit in a horseshoe around
the airfield, connected airside by walkways, in this loop order: **Terminal
1 → Terminal 2 → Terminal 3 → International Terminal (G side) →
International Terminal (A side) → back to Terminal 1.**

**Checkpoints.** CLAUDE.md §6 already names the real checkpoints: B
(Terminal 1), D (Terminal 2), F1/F3 (Terminal 3), A and G (International
Terminal). Unlike Terminal 1 and Terminal 3, where one checkpoint feeds two
piers, the International Terminal has **two independent checkpoints** (A
and G) — there is no single shared post-security hub between them, even
though their landside check-in hall is shared. This design draws them as
two separate hub+pier clusters for that reason.

**Per-building facts:**

- **Terminal 1 (Harvey Milk Terminal)** — unchanged from the first draft:
  Checkpoint B feeds Boarding Area C (gates C2–C11, shorter) and Boarding
  Area B (gates B6–B27, longer). Real Sensory Room post-security near C2
  (flysfo.com). Real named food: Perry's and Farmerbrown (Area C); Amy's
  Drive Thru, Illy Caffè, Starbird, Mama Go's Filipino Cuisine, Café X (Area
  B).
- **Terminal 2** — Checkpoint D feeds one concourse, Boarding Area D (gates
  D1–D18). Real named food: Peet's Coffee & Tea (near D7), Andalé Mexican
  Restaurant, Burger Joint, near a restroom cluster by "Sunset News."
  (Simplification: real-world D1 and D18 are both near the checkpoint, which
  suggests an unusual concourse shape; this schematic simplifies Boarding
  Area D to one straight pier, D1 at the hub end, D18 at the tip.)
- **Terminal 3** — one checkpoint (Checkpoint F, lanes F1/F3) feeds Boarding
  Area E (gates E1–E13, shorter) and Boarding Area F (gates F1–F22,
  longer). Real named amenity: a Yoga Room in Boarding Area E (near E7) —
  genuinely relevant to this app's purpose, not just color. Sources named a
  United Club and a Rotunda near the F gates but no specific restaurants, so
  Terminal 3's food data is thinner than the others; that gap is noted, not
  papered over with an invented name.
- **International Terminal, Boarding Area G** — gates G1–G14, used by United
  for international flights. Real named food: Napa Farms Market, Mustards
  Bar & Grill.
- **International Terminal, Boarding Area A** — gates A1–A15, used by
  international carriers other than United. Real named food: Boudin Bakery,
  Gott's Roadside.
- Membership lounges (Delta Sky Club, Alaska Lounge, Admirals Club, The Club
  SFO, United Club, United Polaris Lounge, Air Canada Maple Leaf Lounge) and
  retail shops are intentionally **excluded everywhere** — not usable by a
  general sensory-sensitive traveler without membership/purchase, and
  outside what this app helps with.

## 3. Shape & layout

One logical canvas, rendered as SVG, `viewBox="0 0 4050 420"` (1 unit = 1
point, so pixel math and fraction math stay in the same units). It reads
left to right as the horseshoe "unrolled" into a straight strip, in the
airport's real loop order, connected by a single horizontal walkway spine
at `y=195–225` running from the Terminal 1 hub to the International
Terminal A hub.

Five hub-and-pier clusters sit along that spine. Each hub is a rounded rect,
110×100, centered on the spine; each pier is a straight concourse strip,
width 70, branching off its hub at an angle (alternating up/down per
cluster purely for visual legibility — it is not a claim about true compass
direction). All positions below are **approximate — implementers may adjust
by up to ~10% for visual spacing/legibility**; they are not a blueprint.

| Cluster | Hub center | Pier(s): centerline hub→tip | Gates (hub end → tip) |
|---|---|---|---|
| Terminal 1 (Checkpoint B) | `(160, 210)` | C: `(200,180)→(470,70)` · B: `(200,240)→(920,380)` | C2…C11 (10) · B6…B27 (22) |
| Terminal 2 (Checkpoint D) | `(1060, 210)` | D: `(1100,220)→(1600,350)` | D1…D18 (18) |
| Terminal 3 (Checkpoint F) | `(1960, 210)` | E: `(2000,180)→(2150,90)` · F: `(2000,240)→(2500,380)` | E1…E13 (13) · F1…F22 (22) |
| International, Boarding Area G (Checkpoint G) | `(2860, 210)` | G: `(2900,240)→(3200,350)` | G1…G14 (14) |
| International, Boarding Area A (Checkpoint A) | `(3760, 210)` | A: `(3800,180)→(3900,90)` | A1…A15 (15) |

A short dashed stub extends right from the Area A pier tip to the canvas
edge (around `(3950, 100)`), labeled **"Walkway loops back to Terminal
1"** — this closes the real loop without requiring an actual circular
layout, which would be far harder to lay out and label on a phone screen.

**Gate tick marks**: short perpendicular lines on each pier's outer edge,
evenly spaced from `t=0.08–0.12` (hub end) to `t=0.95–0.97` (tip) along the
centerline. Labeled ticks on every pier: the first gate, the last gate, and
every 3rd gate in between. Full labeled sets:

- C (C2–C11): C2, C5, C8, C11
- B (B6–B27): B6, B9, B12, B15, B18, B21, B24, B27
- D (D1–D18): D1, D4, D7, D10, D13, D16, D18
- E (E1–E13): E1, E4, E7, E10, E13
- F (F1–F22): F1, F4, F7, F10, F13, F16, F19, F22
- G (G1–G14): G1, G4, G7, G10, G13, G14
- A (A1–A15): A1, A4, A7, A10, A13, A15

Floor fill: `Colors.neutralFillAlt`. Wall/spine stroke: `Colors.border`,
width 2. This is drawn by one new component and nothing else — it does not
render place pins, loud-zone dashes, or the "You" marker; those stay in
`MapScreen` exactly as they work today, just fed new coordinates.

A small caption near the schematic (same visual weight as the existing
"Last verified" text): **"Drawn from public layout info, not SFO's official
architectural plans."**

Place pins keep using the exact same fractional `x`/`y` + `Pressable`
overlay mechanism already in `map.tsx` (`left: ${x*100}%`, `top:
${y*100}%`); only the coordinate values and the container's underlying
aspect ratio change. A place's fraction is its pixel position on the
4050×420 canvas divided by 4050 (x) / 420 (y).

## 4. Data model changes (`src/data/mock/sfo.ts`)

### 4.1 `gateAreas`

Extend the existing `Object.fromEntries` pattern with one block per new
boarding area:

```ts
function rangeToArea(prefix: string, from: number, to: number, area: string) {
  const gates = Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);
  return Object.fromEntries(gates.map((g) => [g, area]));
}

gateAreas: {
  ...rangeToArea('C', 2, 11, 'area-c'),
  ...rangeToArea('B', 6, 27, 'area-b'),
  ...rangeToArea('D', 1, 18, 'area-d'),
  ...rangeToArea('E', 1, 13, 'area-e'),
  ...rangeToArea('F', 1, 22, 'area-f'),
  ...rangeToArea('G', 1, 14, 'area-g'),
  ...rangeToArea('A', 1, 15, 'area-a'),
}
```

`rangeToArea` is a small local helper in `sfo.ts` (not exported) that fully
enumerates each gate — every range above is complete and literal once
generated, nothing is left abbreviated at runtime.
`sampleFlight`/`sampleFlightAfterGateChange` in `data/mock/flight.ts` use
gates C2 and C7 — both remain valid, no change needed there.

### 4.2 `areaCenters`

Tip of each pier, as a fraction of the 4050×420 canvas:

```ts
areaCenters: {
  'area-c': { x: 470 / 4050, y: 70 / 420 },
  'area-b': { x: 920 / 4050, y: 380 / 420 },
  'area-d': { x: 1600 / 4050, y: 350 / 420 },
  'area-e': { x: 2150 / 4050, y: 90 / 420 },
  'area-f': { x: 2500 / 4050, y: 380 / 420 },
  'area-g': { x: 3200 / 4050, y: 350 / 420 },
  'area-a': { x: 3900 / 4050, y: 90 / 420 },
}
```

### 4.3 `places` — full replacement list

All existing Terminal 1 places are repositioned onto the new wider canvas
(new `x`/`y` only — `id`, `notes`, `hours`, `confidence`, `source`,
`lastVerified` unchanged, same as the first draft of this spec). All new
places use `confidence: 'medium'`, `source: 'public airport guides, Oct
2026'`, `lastVerified: '2026-10-23'`.

**Terminal 1 — unchanged from the first draft** (7 existing + 2 new in Area
C, 8 new in Area B — see that section above for the full per-place list).
Total for Terminal 1: 17 places.

**Terminal 2 — Boarding Area D (6 new):**

| id | type | near | name / notes |
|---|---|---|---|
| `checkpoint-d` | loud | hub | Security Checkpoint D. Estimate, not a measurement. |
| `restroom-d9` | service | D9 | Restroom, near "Sunset News." |
| `peets-d7` | food | D7 | Peet's Coffee & Tea. |
| `andale-d12` | food | D12 | Andalé Mexican Restaurant. |
| `burger-joint-d16` | food | D16 | Burger Joint. |
| `dining-cluster-d7` | loud | D7–D9 | Dining cluster. Busy around meal times near Peet's and Andalé. Estimate, not a measurement. |

**Terminal 3 — Boarding Areas E & F (5 new):**

| id | type | near | name / notes |
|---|---|---|---|
| `checkpoint-f` | loud | hub | Security Checkpoint F (lanes F1/F3). Estimate, not a measurement. |
| `yoga-room-e7` | quiet | E7 | Yoga Room, Boarding Area E. |
| `restroom-e-mid` | service | E7 | Restroom. |
| `restroom-f-mid` | service | F15 | Restroom. |
| `dining-cluster-f-rotunda` | loud | F Gates Rotunda | Dining cluster. Busy near the F Gates Rotunda. Estimate, not a measurement. |

No named real restaurant is added for Terminal 3 — sources described "dining
options" generically but didn't name any, and inventing a name would
violate the "never present a guess as verified" rule.

**International Terminal, Boarding Area G (5 new):**

| id | type | near | name / notes |
|---|---|---|---|
| `checkpoint-g` | loud | hub | Security Checkpoint G. Estimate, not a measurement. |
| `restroom-g-mid` | service | G7 | Restroom. |
| `napa-farms-market-g` | food | G5 | Napa Farms Market. |
| `mustards-bar-grill-g` | food | G10 | Mustards Bar & Grill. |
| `dining-cluster-g` | loud | G5–G10 | Dining cluster. Busy around meal times near Napa Farms Market and Mustards. Estimate, not a measurement. |

**International Terminal, Boarding Area A (5 new):**

| id | type | near | name / notes |
|---|---|---|---|
| `checkpoint-a` | loud | hub | Security Checkpoint A. Estimate, not a measurement. |
| `restroom-a-mid` | service | A7 | Restroom. |
| `boudin-bakery-a` | food | A4 | Boudin Bakery. |
| `gotts-roadside-a` | food | A10 | Gott's Roadside. |
| `dining-cluster-a` | loud | A4–A10 | Dining cluster. Busy around meal times near Boudin Bakery and Gott's Roadside. Estimate, not a measurement. |

No `quiet`-type place is added outside Terminal 1's Area C and Terminal 3's
Yoga Room — nothing in the research confirms another quiet-specific amenity
exists elsewhere, and inventing one would violate CLAUDE.md's "never
present a guess as verified" rule. The quiet-spot recommendation rule's
*behavior* is unchanged by this spec (§1); it will simply have more real
candidates to choose from if it's ever pointed at a flight gated outside
Terminal 1, which no current flow does.

**Total: 38 places (up from the original 7).**

## 5. Component architecture

- **New** `src/components/terminal-schematic.tsx`: a presentational SVG
  component (`react-native-svg`, new dependency — Expo Go compatible, no dev
  client needed) implementing §3's hubs/piers/spine/ticks/labels/loop-back
  stub. Takes no data props; it is pure background art sized to fill its
  parent.
- **`src/app/(tabs)/map.tsx`**: replace the `ThemedView type="neutralFillAlt"
  style={styles.schematic}` box with a horizontally-scrolling `ScrollView`
  containing a fixed-size (4050×420-ratio) wrapper that stacks
  `TerminalSchematic` underneath the existing pin/loud-zone/You-marker
  `View`s, unchanged in their own logic. The screen keeps vertically
  scrolling as a whole; only the schematic area scrolls horizontally. Given
  the much greater width, consider a lightweight "jump to" chip row above
  the schematic (Terminal 1 / Terminal 2 / Terminal 3 / International) that
  scrolls the horizontal `ScrollView` to that cluster's x-offset — this is a
  usability add-on, not a correctness requirement; if it's cut for time, the
  schematic still works via manual scrolling.
- No changes to `gate-change.tsx`, `index.tsx`, filters, the place card, or
  any data-fetching code — this is a rendering + data-content change only.

## 6. Verification

No automated test covers SVG layout. Verification is manual, per CLAUDE.md's
"verify on a real iPhone" rule:

- Run in Expo Go on a real iPhone.
- Confirm all 5 hubs and 7 piers are visibly distinct, gate labels are
  legible, and the horizontal scroll reaches every pier tip including the
  loop-back stub.
- Confirm every pin (38 places) lands on/near its intended pier and remains
  tappable at ≥44×44pt — pay particular attention to the longer piers (B,
  F) where pins sit closer together.
- Confirm the "Take me there" highlight ring, filters, and the place card
  still work unchanged for a sample of old and new places across multiple
  terminals.
- Confirm VoiceOver reads the new caption and gate labels sensibly (no
  decorative SVG text exposed as unlabeled images), and that the optional
  "jump to" chips (if built) are reachable and labeled.

## 7. Explicitly out of scope

- Real architectural accuracy beyond what's described in §2 — this is a
  stylized, unrolled schematic, not a blueprint, and does not attempt a true
  circular/horseshoe geometry.
- Retail shops and membership lounges everywhere (§2).
- New `checkpointLanes` entries, arrival-time/itinerary logic, or any change
  to the quiet-spot recommendation rule's behavior for terminals other than
  1 — this spec only adds data and drawing, not new rules logic.
- Any change to Home's `MapPreview`.
- A second airport (unrelated, already tracked as a separate stretch item in
  CLAUDE.md §9).
