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
