# Stillgate: Project Context for Claude

Give this file to Claude Code as the project's `CLAUDE.md` (or point to it at the start of a session). It is a single, self-contained brief: what we are building, what is decided, what is unverified, and how to work with Tyler on the mobile front end.

---

## 1. How to work on this project

- **Role.** Tyler is building the entire mobile front end. Other teammates own the backend, the AI planning, the data pipeline and the pitch. You are Tyler's pair on the mobile app.
- **Hackathon rule.** The build must start at the event (Cal Hacks). Do not write code, scrapers or designs until Tyler confirms the event has started and the rules allow it. Planning, questions and docs are always fine.
- **Ask, don't assume.** If a choice changes what gets built, ask (use AskUserQuestion when available: 1 to 4 questions, 2 to 4 options, a recommended default). If it does not, pick a sensible default, say so, and move on.
- **Be honest about gaps.** Items in section 11 are unverified. Never present them as fact, never invent API response fields, and say when you are guessing.
- **Scope discipline.** The goal is one flawless SFO flow that runs on a real iPhone, not a broad app. When a request adds a feature, say what it displaces.
- **No secrets in the app or the repo.** API keys live on the backend. Never put a key in the mobile code, a config file in the repo, or a commit.
- **Safety of content.** Never present a guess about a place (a room, hours, a route) as verified. Show "last verified" dates and label estimates.
- **Style.** Short answers, plain language, no jargon the team has not used.

## 2. What Stillgate is

A sensory-aware airport travel app. One portable sensory profile, a verified map of quiet spots and services, calm spoken help, and help the moment a gate changes.

- **Name:** Stillgate (a play on airport gates plus stillness). "Calm Guide" is the name of the voice-guided step-by-step feature inside the app. The name has not been checked for app store, domain or trademark conflicts.
- **Primary user (pitch headline):** autistic and sensory-sensitive adults flying alone.
- **Secondary mode:** first-time travelers (a "Is this your first flight?" profile question turns on more detailed steps; detail level is a profile setting, not a separate app).
- **Goal:** win prizes. Optimize for a flawless 2-minute demo and track fit.
- **Vision vs proof:** the vision is a hub that follows a traveler across airports. The proof is SFO done deeply, with a second airport added live only if the stretch work happens.
- **Draft pitch line (not final):** "Stillgate gives autistic and sensory-sensitive travelers a portable sensory profile, a verified map of quiet spots, and calm, spoken help the moment a gate changes."

## 3. Locked decisions

| Topic | Decision |
|---|---|
| Build window | About 36 hours |
| Demo airport | SFO |
| Platform | iOS, run in Expo Go (so no native modules: no Mapbox) |
| App stack | React Native with Expo |
| Map | Simplified floor-plan image with pins placed by fractional coordinates (0 to 1) |
| Loudness | Estimates by space type and time, labeled "typically busy" with a confidence level |
| Voice | The primary way to use the app (Cartesia) |
| Gate change | Simulated and clearly labeled, plus one real lookup for a single flight, with a recorded response as fallback |
| Real flight data | SFO Flight and Reference Data API first; Aviationstack as fallback |
| Other SFO API | Checkpoint Wait Time API as a stretch item |
| Not using | Parking, Parking Data, Curb To Gate APIs |
| AI role | Rules choose the steps from verified data; Claude only phrases them |
| Privacy | Sensory profile stays on the device; no location collection in the demo |
| Team roles | Tyler: mobile front end. Other roles to be assigned at kickoff (backend, data/Apify, voice and pitch) |

## 4. Front-end scope: screens and behavior

The existing 4-screen mockup ("Stillgate Mockup", SFO sample data) is the spec. Screens:

1. **Sensory profile.** Three questions with three options each (noise, crowds, bright or flickering lights), a "what helps" multi-select (headphones, extra time, quiet room, written steps), and "Is this your first flight?" Saved on the phone. A "Skip for now" option.
2. **Airport map (SFO Terminal 1).** Floor-plan schematic with pins: Sensory Room, restrooms, services, a "You" marker, and loud areas shown as dashed zones labeled "Typically busy (estimate)". Filter chips: Quiet spots, Loud areas, Services. A bottom card shows the selected place: name, location, hours, short description, walk time, "Last verified [date]," a "Take me there" button, and "Report a problem".
3. **Gate change (simulated).** A badge reads "Simulated demo: not a real flight." Shows old gate to new gate, the nearest quiet spot picked from the profile, an option for gentle alerts only, and three actions: take me to the quiet spot, show the way to the new gate, not now. A separate "live lookup" card shows one real flight result (see section 6).
4. **Calm guide (voice).** One step at a time (check-in, security, boarding, gate change) with a step counter, a large Listen button, Back and Next, and a "Need a minute?" card with a phrase to show staff.

Behavior rules:
- "Take me there" only highlights the pin and shows the walk time. No turn-by-turn routing.
- Alerts are few, calm and user-controlled.
- The quiet-spot choice is a simple rule: filter spots by profile, pick the nearest to the new gate using a gate-to-area table. No model decides this.
- Loud areas always read as estimates, never as measurements.
- Sample data (walk times, gate numbers, security text) is placeholder until replaced with real data. "Last verified" dates are placeholders until someone checks the source.

### Design tokens (from the mockup)

| Use | Value |
|---|---|
| Background | #F6F3EC |
| Text | #1F2A2E |
| Secondary text | #3B4A4E |
| Primary (buttons, selected) | #2F6B5F |
| Light selected fill | #DCE9E3 |
| Border / unselected outline | #7D7765 |
| Neutral fills | #D8D0BD, #EAE4D6 |
| Estimate / warning fill | #F2D3B3, text #6B3205, border #B4540A |
| "You" marker | #1D4FA8 |
| Font | Atkinson Hyperlegible |

Accessibility is part of the judging, not a polish step: tap targets of at least 44 px, text scaling, screen-reader labels on every control and icon-only button, reduced-motion support, 4.5:1 text contrast, and no information carried by color alone.

## 5. Data layer and internal contract

Build against a mock data layer from hour 0. Put the data behind one small module so swapping local JSON for real calls changes one file. The shapes below are **our own internal contract**, not SFO's response formats (which have not been seen). Agree them with the backend teammate in the first hour.

```
Airport {
  code, name, verified: boolean, lastVerified,
  terminals: [{ id, name, floorPlanImage, boardingAreas: [id] }],
  places: [{ id, type: "quiet" | "loud" | "service",
             name, terminal, x, y,            // x, y are fractions 0 to 1 on the image
             hours, notes, confidence, lastVerified, source }],
  gateAreas: { "<gate>": "<boardingAreaId>" }, // gate-to-area table for the quiet-spot rule
  steps: [{ id, phase, text, audioUrl }]       // check-in, security, boarding, gate change
}

FlightLookup { flight, status, scheduledDeparture, gate, terminal, retrievedAt, isRecorded }

CheckpointWait { checkpoint, waitMinutes, queueStatus, retrievedAt }   // stretch

Profile { noise, crowds, lights, helps: [string], firstFlight: boolean, detailLevel }
```

Rules: pins are stored as fractions so a second airport is a new image plus a new data file; every place has a source and a last-verified date; a missing value shows as "unknown," never as a guess.

## 6. External APIs

All third-party calls go through the backend. Cache responses.

### SFO Flight and Reference Data API
- Server: `https://api.flysfo.com/sfo/v1.0`
- Seen: endpoint paths only. Flight lookup by airline code, flight number and date range under `/movements/aircraft/time/window/airlines/{airline_code}/flight-number/{flight_number}/from/{start_date}/to/{end_date}` (and a `/schedules/` equivalent for planned flights); departures by terminal; reference endpoints for terminals, concourses, gates (`/offerings/facilities/concourses/{id}/gates/`), boarding areas (`/offerings/facilities/terminals/{id}/boardingareas/`), airlines and airports.
- **Not seen:** response fields (does a movement include its gate and boarding area?), sign-up and approval process, authentication method, rate limits, terms of use. Make one test call as soon as a key exists.
- Use: the real lookup for the gate-change moment, and the gate and boarding-area reference data for the gate-to-area table.

### SFO Checkpoint Wait Time API (stretch)
- Base: `https://api.flysfo.com/sfo/v1.0/checkpoints`; API key required; limited to 10,000 requests per month.
- Covers Checkpoint B (Terminal 1), D (Terminal 2), F1 and F3 (Terminal 3), A and G (International Terminal). Returns current wait time, passengers per hour and the status of each screening queue.
- Use: show the live security wait on the matching checkpoint pin, labeled as wait time, **not noise**. Fetch through the backend and cache to stay well under the limit.

### Aviationstack (fallback and the route to other airports)
- Official site: free plan about 100 requests per month; paid from $49.99 per month. A third-party article claimed 10,000 on free, which looks outdated.
- Gate and terminal fields appear in a third-party sample response but were not confirmed in the official docs. HTTPS and real-time access on the free plan are unconfirmed.
- Use: fallback for the single real lookup. Never poll.

## 7. Voice (Cartesia)

- Voice is the main way to use the app, not an add-on. Cartesia's criteria weigh problem, use of Cartesia, execution, and impact and responsibility equally.
- The backend calls Cartesia and returns audio, so no key ships in the app. Pre-generate the audio for the demo steps as a fallback so a slow or failed call does not break the demo.
- Steps are chosen by rules from verified data. Claude only phrases the wording.
- To verify early in Expo Go: audio playback works on a real iPhone, and latency is acceptable.
- Submission needs: a working demo, a 2-minute demo-first presentation (one complete flow, then problem and how it was built), a short README (setup, Cartesia features used, known limitations), and no secrets in the repo.

## 8. SFO facts to use (verify before the demo)

- SFO Sensory Room: Harvey Milk Terminal 1, post-security, near Gate C2, open 5:00 a.m. to 11:00 p.m. Three spaces: a quiet area, an active area and a practice aircraft cabin. Open to all guests (source: SFO's own site).
- Other resources worth linking: TSA Cares (contact at least 72 hours before travel; support stops after security), the Sunflower lanyard (a signal, not a fast pass), and MagnusCards, which SFO already offers. Do not duplicate them; link out.
- Loudness proxies, labeled as estimates: space type (food court, security checkpoint, train station, announcement areas), terminal, time of day, day of week.

## 9. Build order and timeline (36 hours)

| Hours | Goal |
|---|---|
| 0-4 | Repo, Expo Go running on a real iPhone, navigation shell, mock data module, agree the data contract, accounts and keys set up on the backend side |
| 4-14 | Profile (saved on the phone), map with pins from local data, bottom card, filters |
| 14-18 | Simulated gate change and the quiet-spot rule |
| 18 | **Cut-off check.** If the core flow is not working end to end on a real iPhone, drop all stretch features and the real lookup |
| 18-28 | Voice-guided steps, real flight lookup, accessibility pass, polish |
| 28-33 | Stretch only if the core is solid; otherwise rehearse |
| 33-36 | Backup demo video, submission text per track, final rehearsal |

**Cut order if behind:** second airport, report button, airline card, search, live checkpoint wait, real lookup. "Take me there" stays a pin highlight.

**Stretch order (all kept):** 1 live security wait on the checkpoint pin; 2 second airport added live; 3 "Was this accurate?" report button; 4 airline accommodation card; 5 search "quietest place near my gate" (only if a track's criteria make it worth it). No stretch work starts until the core demo works end to end on a real iPhone.

### Demo script (2 minutes)

1. Problem and user in about 15 seconds.
2. One complete flow: set up the profile, hear a spoken step, hear the simulated gate change, tap to the quiet spot on the map.
3. A brief look at how it was built and what is verified.
4. Close with the hub vision; if the stretch worked, add a second airport live.

## 10. Tracks (what the README and demo must show)

| Track | Where it lives | Notes |
|---|---|---|
| Anthropic | Claude phrases calm steps; rules choose them; README explains where it could go wrong | Judges want a named community, a real problem, a working demo and thoughtful use of Claude. Prize not listed yet |
| Cartesia | Voice is the main interface | Prize TBD (Meta glasses, not confirmed) |
| Apify | The Actor builds the airport records the app reads | Best Actor is a separate award |
| Microsoft Grand Prize / Customer Impact | The gate-change agent, customer understanding, responsible design, a path to production | Same criteria for both |
| Best People-First Hack (general) | Whole project | |

Not pursuing: Factory Droid, Meta, Spacetime, Notability, Fetch.ai, the finance and shopping tracks. Convex and Elastic stay open until their criteria are posted. Confirm that one project can enter multiple tracks.

## 11. Unverified or open (do not state as fact)

- Whether the SFO Flight API's movement records include the gate and boarding area, and its sign-up process, authentication, rate limits and terms.
- Aviationstack's real plan limits, HTTPS and gate data on the free plan.
- Whether Expo Go handles the chosen audio playback and the backend client without a development build.
- Whether signing up for API keys before the event counts as allowed prep.
- Whether one project can enter several tracks.
- The Stillgate name (app stores, domains, trademarks).
- The Anthropic prize, and the Convex and Elastic criteria.
- All sample data in the mockup (walk times, gate numbers, step text, verified dates).
- Nothing here comes from interviews with neurodivergent travelers; it is research-based, not field-tested. Talk to a few before or at the event if possible.

## 12. Out of scope

Live crowd or noise data (a live security wait time is a stretch item and is wait time, not noise), AR and computer vision, the parking, parking data and curb-to-gate SFO APIs, accounts and login, true "quietest route" routing, many verified airports, a full airline layer, rewriting general flying guides, and reusing the airport's official map image without permission (draw a simplified schematic instead).

## 13. Risks (short)

| Risk | Mitigation |
|---|---|
| One person on the whole front end | Mock data layer, strict build order, hour-18 cut-off |
| Voice breaks on stage | Pre-generated audio fallback, backend proxy, test early |
| Gate data missing or API access slow | Recorded response, Aviationstack fallback, simulated gate change |
| A wrong step in a crisis | Rules from verified data; Claude phrasing only |
| Loudness labels mislead | Always labeled estimates with a confidence level |
| Stale airport data | Last-verified dates on every pin; label unknowns |
| API keys leaking | All calls through the backend |
| Scope creep | Core first; no stretch before the end-to-end flow works on a real iPhone |
