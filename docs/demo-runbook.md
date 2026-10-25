# Demo: Apify end to end (about 3 minutes)

**One path:** the official SFO Sensory Room page is scraped by the Apify Actor, arrives as a draft, a person approves it with one click, and it appears as a pin on the traveler map.

**What it shows:** nothing scraped reaches travelers until a human verifies it, and every pin links back to its official source.

Every step has a fallback (see the table at the end), so the demo still finishes if a website, Wi-Fi, or Apify is slow.

---

## 30 minutes before

Open three terminals in `~/stillgate`:

| Terminal | Command | Leave running? |
|---|---|---|
| 1 Backend | `npx convex dev` | Yes. Wait for "Convex functions ready!" |
| 2 App | `npx expo start`, then press **w** | Yes |
| 3 Demo commands | (below) | — |

Put the demo into its starting state (terminal 3):

```bash
npx convex run demo:reset '{"airportCode":"SFO"}'
```

Open four browser tabs, in this order:

1. **Source:** https://www.flysfo.com/passengers/services/sensory-room
2. **Map:** http://localhost:8081/map. It should show the *sample* quiet spots and "Approximate map locations".
3. **Review:** http://localhost:8081/review. Enter the review key now and pick **SFO**. It should say "Nothing waiting for review".
4. **Apify (cloud path only):** https://console.apify.com/actors → stillgate-accessibility-scraper → Runs

Then do one full practice run and reset again.

---

## The demo

**1. The problem (tab 1, 20 s).**
"Airports publish this, but it's buried. Here's SFO's Sensory Room: hours, location, post-security, Gate C2. Travelers who need it most can't find it in the moment."

**2. Before (tab 2, 10 s).**
"Our map today shows example quiet spots, clearly labelled as approximate."

**3. Scrape (30 s).** Use one of these:
- **Cloud path:** on tab 3, click **Run scraper now**, then switch to tab 4 to show the Apify run going.
- **Local path:** in terminal 3, run:
  ```bash
  cd scraper && node dist/main.js
  ```
  Point at `SFO …: 1 blocks, 1 drafts` and `Ingest OK: {… "newDrafts": …}`.

"The Actor reads the official page, finds the sensory room, and pulls out the gate, terminal, security side and hours. It sends the results to our backend as *drafts*."

**4. Human review (tab 3, 40 s).**
The draft appears on its own; the screen updates live. Point at three things:
- the verbatim text from SFO's page, with its link
- "Suggested position: Gate C2 → area-c", worked out from the gate
- the form, already filled in

"Nothing is published automatically. A person checks it against the source and places it." Click **Approve and publish**.

**5. After (tab 2, 30 s).**
Reload the map. The example quiet spots are replaced by **one real pin by the C gates**. Tap it: *Sensory Room · Terminal 1 · 5:00 AM – 11:00 PM · post-security, near Gate C2*.

"Scraped, verified, sourced, and on the map in under a minute."

**6. Optional: it stays fresh (20 s).**
Run the scrape again. It reports `"unchanged": 1` and creates no duplicates. "A weekly cron re-scrapes. If SFO edits the page, the place goes back to review, and travelers keep seeing the verified version until someone re-approves it."

---

## Fallbacks

| If… | Do this | What to say |
|---|---|---|
| SFO's site is slow, times out, or blocks the scrape | `cd scraper && node demo/replay.mjs http://127.0.0.1:3211/ingest <INGEST_SECRET>` | "Here's the same page captured earlier." This sends the exact output the Actor produced, through the same endpoint. |
| The Apify cloud run is slow (container start can take 30–60 s) | Talk over it, or switch to the local path | Same Actor code, running locally. |
| The review screen says "That review key was not accepted" | Click **Try again** and re-type the key | — |
| Nothing loads, or flight lookup says "temporarily unavailable" | Check terminal 1 is running and shows "ready", then reload the tab | — |
| The draft doesn't appear | Reload tab 3. If still nothing, run `npx convex run demo:reset '{"airportCode":"SFO"}'` and scrape again | — |
| The pin isn't on the map | Reload tab 2 with **Cmd+Shift+R**. Check **Quiet spots** is selected | — |

Reset between every rehearsal:

```bash
npx convex run demo:reset '{"airportCode":"SFO"}'
```

---

## Cloud path setup (needed for "Run scraper now" to finish)

Apify runs in the cloud, so it can't reach a backend running at `127.0.0.1` on a laptop. To run the scrape on Apify itself, use a cloud Convex deployment:

```bash
npx convex login
npx convex dev                     # choose "create a new project"; this rewrites .env.local
npx convex env set INGEST_SECRET <random>
npx convex env set REVIEW_KEY <random>
npx convex env set APIFY_TOKEN <apify token>
npx convex env set APIFY_ACTOR_ID aV7ba9TeP4nsUO5n5
npx convex run seed:airports
npx convex run seed:sources
npx convex run airports:upsertAirport "$(cat shared/data/sfo.json)"
```

Then restart `npx expo start` so the app picks up the new backend URL. Rehearse the cloud path at least twice on the Wi-Fi you'll demo on. If it's flaky, use the local path; it's the same Actor code and the same backend flow.

The Actor must be rebuilt on Apify after changes to `scraper/`. Run `cd scraper && npx apify-cli push`.
