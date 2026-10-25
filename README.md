# Stillgate
Airports can be loud, crowded, and unpredictable, which can make travel harder for neurodivergent and sensory-sensitive people. A 2025 research study from Trinity college with a sample of over 300 families found that for most people, stress drops after security, but for neuro divergent travelers, it stays high the whole trip. Some airports have sensory rooms and support programs, but they’re scattered. Skillgate aims to fill that gap. Ultimate goal is one website and one app for every airport. That’s the gap Stillgates fills.

Stillgate is a sensory-aware airport companion designed for autistic and other neurodivergent travelers. It helps travelers prepare for an airport visit, find sensory-relevant places and services, and follow calm, step-by-step trip guidance.

This is a hackathon prototype, not an airline or airport-operated service. Flight examples and gate changes are simulated. Check the labels and source/verification details in the app; walking times and some airport information are estimates or sample data.

## What the prototype does

- **Personal sensory profile:** travelers can record how noise, crowds and lighting affect them, choose what helps, and set the amount of guide detail. The profile is saved on the device and is not sent to Convex.
- **Airport map and places:** the app shows airport places such as sensory rooms, quiet areas and services. Reviewed place records are fetched from Convex, cached on the device, and combined with clearly identified bundled sample data when needed.
- **Trip and Calm Guide:** the app builds a step-by-step plan from the selected flight, trip details, profile and airport information. Rules in the app determine the facts and recommendations.
- **Gate-change demo:** the demo can simulate a gate change and show a next step. It is not a live gate-change alert from an airline.
- **Spoken guide:** the app sends a guide transcript to the Convex `voice:speak` action. The backend calls Cartesia, stores the generated MP3 in Convex file storage, and returns a URL for the app's `expo-audio` player. Repeated text with the same voice can reuse a stored clip.
- **Calm phrasing:** an Anthropic Claude action can reword rule-generated guide steps. The action checks that gate and number facts are preserved and falls back to the original text if it cannot safely rewrite them. Claude does not choose airport facts or routes.
- **Airport-data review pipeline:** an Apify Actor collects information from configured airport webpages and sends candidate updates to Convex for human review. Scraped changes are drafts; they do not become traveler-facing approved information automatically.
- **Flight lookup:** when configured, the app can request flight data through the Convex/Apify backend. Labeled sample flights are available for the demo and local development.

## Technology

| Area | Technology | Role |
| --- | --- | --- |
| Mobile app | React Native, Expo SDK 58, Expo Router, TypeScript | Screens and mobile navigation |
| Audio playback | `expo-audio` | Plays generated guide audio in the app |
| Backend and storage | Convex | Airport records, app actions, scheduled jobs, and generated audio files |
| Spoken audio | Cartesia | Converts guide text into speech on the backend |
| Guide phrasing | Anthropic Claude | Rephrases rule-generated steps with fact checks |
| Data collection | Apify Actor, Crawlee and Playwright | Collects configured airport-page content for review |
| Local profile storage | AsyncStorage | Keeps sensory preferences on the device |

## Run the mobile app

Requirements: Node.js and npm.

From the repository root:

```bash
npm install
npm start
```

The Expo development server will show options for opening the app. For the backend-connected experience, start the team's Convex development deployment in a second terminal:

```bash
npx convex dev
```

Convex setup, deployment selection, data seeding, environment variables and backend commands are documented in [BACKEND.md](BACKEND.md). Backend API keys belong in Convex environment variables, never in the mobile app, README, or committed `.env` files. The mobile app can use bundled sample data when Convex is not configured or unavailable.

In Windows PowerShell, if script execution blocks `npm` or `npx`, use the command shims instead (for example, `npm.cmd start` and `npx.cmd convex dev`).

## Useful project commands

```bash
npm run lint       # Lint the Expo project
npm run validate   # Validate shared airport JSON data against its schema
npm run schema     # Regenerate the JSON schema from shared/schema.ts
```

## Project structure

```text
stillgate/
├── src/                         # Expo / React Native mobile app
│   ├── app/                     # Expo Router screens and navigation
│   │   ├── (tabs)/              # Home, map, profile and Calm Guide tabs
│   │   ├── flight-lookup.tsx    # Flight search screen
│   │   ├── gate-change.tsx      # Gate-change demo flow
│   │   └── review.tsx           # Place review screen
│   ├── components/              # Reusable interface components
│   ├── contexts/                # Shared React context
│   ├── data/                    # Airport, flight, profile and narration logic
│   │   └── mock/                # Bundled sample airports and flights
│   ├── hooks/                   # Reusable app hooks, including audio playback
│   ├── lib/                     # App helpers and Convex client
│   └── constants/               # Theme and app constants
├── convex/                      # Convex backend
│   ├── airports.ts              # Airport records and lookup
│   ├── flights.ts               # Optional live flight lookup
│   ├── gateChange.ts            # Gate-change and nearby-place logic
│   ├── voice.ts                 # Cartesia speech generation and audio storage
│   ├── phrase.ts                # Guarded Claude guide rephrasing
│   ├── scrape.ts, ingest.ts     # Scrape scheduling and incoming data
│   ├── review.ts, reports.ts    # Human review and accuracy reports
│   ├── schema.ts                # Convex database schema
│   └── _generated/              # Generated Convex types and API files
├── shared/
│   ├── data/                    # Sample airport records
│   ├── schema.ts                # Shared airport data types
│   └── airport.schema.json      # JSON validation schema
├── scraper/
│   └── src/                     # Apify Actor and extraction tests
├── voice-test/                  # Standalone Cartesia speech experiment
├── assets/                      # App images and other static assets
├── docs/                        # Project design notes and specifications
├── scripts/                     # Repository utility scripts
├── app.json                     # Expo app configuration
├── package.json                 # Mobile app dependencies and commands
├── BACKEND.md                   # Backend setup and function reference
└── README.md
```



## Data, privacy and prototype boundaries

- The sensory profile is stored locally on the device. The backend receives only information needed for a specific request; the profile is not stored in a Convex profile table.
- The detailed map layouts currently supported by the app are SFO and CHS. Convex-seeded airport records may have narrower coverage; see [BACKEND.md](BACKEND.md).
- Scraped information is a candidate for review, not proof that a room or service is currently available. Use the source and verification information shown in the app.
- Walk times and some flight or gate scenarios are estimates or demo data. The app does not provide guaranteed indoor navigation or live airline gate-change notifications.
- The prototype should not be treated as emergency, security, visa, or official airport advice. Follow airport, airline and government instructions.
- Before a public launch, review access controls, rate limits, data verification, moderation, and third-party API costs. Current public demo actions may need additional protections.


