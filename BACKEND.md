# Stillgate backend

Convex backend for airport data, gate-change help and data import. Code is in `convex/`; the shared
data shape is in `shared/schema.ts`.

## Run it

```bash
npm install
npx convex dev        # log in, then pick/join the stillgate project; leave it running
```

`npx convex dev` writes the deployment URL to `.env.local` (gitignored). A fresh deployment has no
data, so seed SFO once:

```bash
npx convex run airports:upsertAirport "$(cat shared/data/sfo.json)"
```

Dev deployment currently in use (owner: harry23yu):

| Use | URL |
|---|---|
| App queries and mutations (Convex client) | `https://tame-guanaco-649.convex.cloud` |
| HTTP endpoints (import) | `https://tame-guanaco-649.convex.site` |

Note `.cloud` vs `.site`: they are different hosts.

## Functions the app can call

All are public queries. Try any of them from the repo root with `npx convex run <name> '<json args>'`.

### `airports:getAirport`

```bash
npx convex run airports:getAirport '{"code":"SFO"}'
```

Returns the full airport record (shape: `Airport` in `shared/schema.ts`) or `null` if we have no
record. The code is case-insensitive.

### `airports:listAirports`

```bash
npx convex run airports:listAirports
```

Returns `[{ code, name, verifiedStatus }]`, for an airport picker.

### `gateChange:simulateGateChange`

```bash
npx convex run gateChange:simulateGateChange '{"airportCode":"SFO","flightNumber":"ua 123"}'
```

Demo only. Returns a canned event, always `simulated: true` with a label that the UI must show:

```json
{ "simulated": true, "label": "Simulated gate change (demo data, not a real flight)",
  "airportCode": "SFO", "flightNumber": "UA 123", "fromGate": "B7", "toGate": "C2" }
```

Returns `null` for an airport with no canned change (only SFO has one).

### `gateChange:nearestQuietSpots`

```bash
npx convex run gateChange:nearestQuietSpots '{"airportCode":"SFO","gate":"C2","profile":{"noise":"high","crowds":"medium","lighting":"low","whatHelps":["quiet room"],"firstFlight":false,"detailLevel":"brief"}}'
```

Takes the new gate and the traveler's `SensoryProfile` (sent on each call, never stored) and returns
quiet spots ranked by walk time. A high noise/crowds/lighting setting ranks sensory rooms ahead of
other quiet spots. Optional `limit` (default 3, max 10).

Demo flow: call `simulateGateChange`, then pass its `toGate` here.

Things the UI must handle:

- `walkMinutes` can be `null` (no known walk time for that gate). Show "walk time unknown", not a guess.
- `walkTimesAreEstimates` is always `true`. The walk times are placeholders, not measurements. Label them as estimates.
- `verifiedDate` can be `null`, meaning no human has verified that spot. Show "not yet verified".
- `hours` is free text and is not checked against the current time.
- Returns `null` for an unknown airport.

### `gateChange:gateChangeSteps`

```bash
npx convex run gateChange:gateChangeSteps '{"airportCode":"SFO","gate":"C2","fromGate":"B7","profile":{"noise":"high","crowds":"medium","lighting":"low","whatHelps":[],"firstFlight":false,"detailLevel":"brief"}}'
```

Builds the step sentences for a gate change in plain code, from the database and the walk-time table (no LLM).
Same inputs as `nearestQuietSpots` plus an optional `fromGate`. Returns the same fields plus:

- `steps`: string[]. `brief` gives the gate change and the nearest quiet place. `detailed` adds the hours, the
  notes, and "This information has not been verified yet." when the spot has no verified date.
- `spot`: the top spot (or `null` when the airport has none).
- When the walk time is unknown, the step says so instead of guessing.
- Returns `null` for an unknown airport.

Demo chain: `simulateGateChange` -> `gateChangeSteps` (use its `toGate` and `fromGate`) -> `phrase:phraseSteps` with `steps`.

### `phrase:phraseSteps` (action)

```bash
npx convex run phrase:phraseSteps '{"steps":["Your gate changed to C2. The SFO Sensory Room is about 2 minutes away.","It is open from 5:00 a.m. to 11:00 p.m."],"detailLevel":"brief"}'
```

Claude only rewords steps that code already built; it never decides facts. Send `steps` (up to 8, each up
to 300 characters) and `detailLevel` (`brief`, `standard` or `detailed`). Returns
`{ steps, rewritten, reason }`.

- Build the step text from the data in code (gate, place name, minutes, hours), then call this to soften it.
- Every number and gate token in each step must survive the rewrite, or the original text is returned.
- On any failure (no key, API error, refusal, bad output, failed check) you get the original steps back with
  `rewritten: false` and a `reason`. Always show `steps`; use `rewritten` only for debugging.
- Needs `ANTHROPIC_API_KEY` on the deployment (`npx convex env set ANTHROPIC_API_KEY <key>`).
- Public and unauthenticated, so anyone with the URL can spend credits. Fine for the event; add rate limiting before launch.

### `voice:speak` (action)

```bash
npx convex run voice:speak '{"text":"Your gate changed to C2. Take your time."}'
```

Turns text into Cartesia speech (MP3) and returns `{ kind: "audio", uri }`, a Convex file-storage URL the app
plays. Each clip is saved in file storage (table `voiceClips`), so the same text in the same voice is only sent
to Cartesia once. Play each demo step once before presenting and the demo no longer depends on Cartesia.

- Text is trimmed; empty text or more than 600 characters is refused.
- On failure you get `{ kind: "unavailable", message, configured }`. `configured: false` means the env vars below are missing.
- Needs `CARTESIA_API_KEY` and `CARTESIA_VOICE_ID` on the deployment (`npx convex env set ...`).
- The app calls it from `src/data/guide-audio-provider.ts` (Calm Guide "Listen" button).
- Public and unauthenticated, so anyone with the URL can spend Cartesia credits. Fine for the event; add rate limiting before launch.

### Reports ("Was this accurate?")

```bash
npx convex run reports:submitReport '{"airportCode":"SFO","spotId":"sfo-sensory-room-t1","verdict":"wrong","note":"Room was closed for cleaning"}'
npx convex run reports:listRecentReports '{"airportCode":"SFO","spotId":"sfo-sensory-room-t1","limit":5}'
npx convex run reports:spotReportSummary '{"airportCode":"SFO","spotId":"sfo-sensory-room-t1"}'
```

- `reports:submitReport` (mutation): `verdict` is `"accurate"` or `"wrong"`; `note` is optional, max 280 characters.
  `spotId` must be the id of a quiet spot, loud zone or service in that airport's record. Unknown airport or
  spot, an over-long note, or a bad verdict is rejected and nothing is written.
- `reports:listRecentReports` (query): newest first. `spotId` is optional; `limit` defaults to 20, max 50.
  It is live: a client subscribed to it updates when a report arrives.
- `reports:spotReportSummary` (query): `{accurate, wrong, total, truncated}` from the 200 most recent reports for the spot.
- Reports never change an airport record. They are signals for a person to re-verify the pin.
- Unauthenticated, so anyone can submit and nothing limits one person's volume. Fine for the event; add rate limiting and moderation before launch.

## Importing airport data (for the Apify Actor)

```
POST https://tame-guanaco-649.convex.site/importAirport
x-import-secret: <IMPORT_SECRET>
content-type: application/json

<one Airport record>
```

Ask Harry for the secret. Do not commit it or paste it into shared chat history.

```bash
curl -i -X POST https://tame-guanaco-649.convex.site/importAirport \
  -H "x-import-secret: $IMPORT_SECRET" \
  -H "content-type: application/json" \
  --data @shared/data/sfo.json
```

| Status | Meaning |
|---|---|
| 200 | Saved. Body is `{"ok":true,"id":"..."}`. A record with the same `code` is replaced entirely. |
| 400 | Not JSON, not an object, or fails validation. Body has `detail` with the reason. Nothing was written. |
| 401 | Missing or wrong secret. |
| 503 | `IMPORT_SECRET` is not set on the deployment. |

Rules for records:

- One airport per request; loop for several.
- Match `shared/schema.ts` exactly. `sfo.json` is the reference example.
- Always send `lastVerified` and every `verifiedDate`. Use `null` for "never verified by a human", and
  a missing required key is rejected. Only fields marked `?` in the schema (like `hours` or `notes`) may be left out.
- Scraped data should use `"verifiedStatus": "basic"` until a person checks it.
- Validate before sending: `npm run validate` checks `shared/data/*.json` against the schema.

## Data model

- `shared/schema.ts` is the source of truth for the TypeScript types.
- `convex/schema.ts` repeats it as Convex validators (Convex cannot derive them from types). Change both together.
- `npm run schema` regenerates `shared/airport.schema.json` from the types; run it after editing `shared/schema.ts`.
- `SensoryProfile` is a type only. The profile stays on the device and the backend has no table for it.

## Known gaps

- The mobile app does not call this backend yet; it reads local mock data.
- Walk times are a placeholder (one entry: SFO gate C2 to the sensory room).
- SFO data comes from the project brief and has not been re-checked against the SFO page.
- Only SFO is seeded.
