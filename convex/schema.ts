import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Mirrors shared/schema.ts (the source of truth for the app types). Keep the two in sync.
// Dates are ISO strings; null means "never verified by a human".

// Shared with the data-pipeline tables below.
export const confidence = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

const source = v.object({ label: v.string(), url: v.string() });

const location = v.object({
  terminalId: v.string(),
  nearGate: v.optional(v.string()),
  postSecurity: v.boolean(),
  description: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
});

const terminal = v.object({
  id: v.string(),
  name: v.string(),
  gates: v.array(v.string()),
});

const quietSpot = v.object({
  id: v.string(),
  kind: v.union(v.literal("sensory_room"), v.literal("quiet_area"), v.literal("other")),
  name: v.string(),
  location,
  hours: v.optional(v.string()),
  notes: v.optional(v.string()),
  verifiedDate: v.union(v.string(), v.null()),
  source,
});

const loudZone = v.object({
  id: v.string(),
  type: v.union(
    v.literal("food_court"),
    v.literal("security_checkpoint"),
    v.literal("train_station"),
    v.literal("announcement_area"),
    v.literal("other"),
  ),
  name: v.string(),
  location,
  estimatedBusyTimes: v.optional(v.string()),
  confidence,
});

const service = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("tsa_cares_meeting_point"),
    v.literal("special_assistance_desk"),
    v.literal("family_accessible_lane"),
    v.literal("restroom"),
    v.literal("water"),
    v.literal("low_stimulation_food"),
  ),
  name: v.string(),
  location,
  hours: v.optional(v.string()),
  notes: v.optional(v.string()),
  verifiedDate: v.union(v.string(), v.null()),
  source,
});

const walkthroughStep = v.object({
  phase: v.union(v.literal("check_in"), v.literal("security"), v.literal("boarding")),
  order: v.number(),
  text: v.string(),
  detailedText: v.optional(v.string()),
  photoUrl: v.optional(v.string()),
  verifiedDate: v.union(v.string(), v.null()),
  source,
});

const externalLink = v.object({
  label: v.string(),
  url: v.string(),
  provider: v.union(
    v.literal("magnuscards"),
    v.literal("kulturecity"),
    v.literal("airport"),
    v.literal("tsa"),
    v.literal("other"),
  ),
});

// Reused by the import mutation so scraped data is validated against the same shape.
export const airportFields = {
  code: v.string(),
  name: v.string(),
  terminals: v.array(terminal),
  lastVerified: v.union(v.string(), v.null()),
  verifiedStatus: v.union(v.literal("verified"), v.literal("basic")),
  quietSpots: v.array(quietSpot),
  loudZones: v.array(loudZone),
  services: v.array(service),
  walkthrough: v.array(walkthroughStep),
  links: v.array(externalLink),
};

// ---- Accessibility data pipeline (scraper → review → published places) ----

/**
 * Accessibility data pipeline storage. The app only ever reads
 * `places.published` on places with `status: 'approved'` — scraped fields
 * are reviewer input, never shown to travelers directly.
 */

export const placeType = v.union(v.literal('quiet'), v.literal('loud'), v.literal('service'), v.literal('food'));
export const securitySide = v.union(v.literal('pre'), v.literal('post'));

/** Latest scraper output for a place. Overwritten on every changed scrape. */
export const scrapedFields = v.object({
  name: v.string(),
  type: v.union(v.literal('quiet'), v.literal('service')),
  hours: v.union(v.string(), v.null()),
  locationHint: v.union(v.string(), v.null()),
  gateHint: v.union(v.string(), v.null()),
  terminalHint: v.union(v.string(), v.null()),
  securitySide: v.union(securitySide, v.null()),
  excerpt: v.string(),
  pageId: v.id('rawPages'),
});

/** What travelers see. Mirrors `Place` in src/data/types.ts. Written only by a reviewer. */
export const publishedFields = v.object({
  type: placeType,
  name: v.string(),
  terminal: v.string(),
  x: v.number(),
  y: v.number(),
  hours: v.string(),
  notes: v.string(),
  confidence,
});

const airportRef = v.object({ code: v.string(), city: v.string() });

/** Mirrors `FlightLookup` in src/data/types.ts. */
export const flightValidator = v.object({
  flight: v.string(),
  status: v.union(
    v.literal('on-time'),
    v.literal('delayed'),
    v.literal('boarding'),
    v.literal('gate-changed'),
    v.literal('cancelled'),
    v.literal('unknown'),
  ),
  scheduledDeparture: v.string(),
  gate: v.union(v.string(), v.null()),
  terminal: v.union(v.string(), v.null()),
  retrievedAt: v.string(),
  isRecorded: v.boolean(),
  origin: airportRef,
  destination: v.union(airportRef, v.null()),
});

// SensoryProfile is intentionally not a table: it stays on-device.
export default defineSchema({
  airports: defineTable(airportFields).index("by_code", ["code"]),
  // "Was this accurate?" reports from travelers. One row per report, newest by _creationTime.
  // Reports are signals for a human to re-verify; they never change an airport record by themselves.
  reports: defineTable({
    airportCode: v.string(),
    spotId: v.string(), // id of a quiet spot, loud zone or service in that airport's record
    verdict: v.union(v.literal("accurate"), v.literal("wrong")),
    note: v.optional(v.string()),
    // Random per-install id (src/data/device-id.ts), so one device counts once per spot per day.
    // Optional only so reports written before it existed stay valid.
    deviceId: v.optional(v.string()),
  })
    .index("by_airportCode", ["airportCode"])
    .index("by_airportCode_and_spotId", ["airportCode", "spotId"])
    .index("by_airportCode_and_spotId_and_deviceId", ["airportCode", "spotId", "deviceId"]),

  sources: defineTable({
    airportCode: v.string(),
    url: v.string(),
    lastHash: v.optional(v.string()),
    lastFetchedAt: v.optional(v.string()),
    lastChangedAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
  }).index('by_airport_url', ['airportCode', 'url']),

  /** Snapshot per content change, so every approved place can point at the text it came from. */
  rawPages: defineTable({
    sourceId: v.id('sources'),
    airportCode: v.string(),
    url: v.string(),
    fetchedAt: v.string(),
    contentHash: v.string(),
    title: v.string(),
    text: v.string(),
  }).index('by_source', ['sourceId']),

  places: defineTable({
    airportCode: v.string(),
    sourceId: v.id('sources'),
    /** Scraper rule key ("sensory-room"). Split-off places use `${parentKey}~n`. */
    key: v.string(),
    /** Set when a reviewer split one scraped mention ("three relief areas") into several places. */
    parentKey: v.optional(v.string()),
    status: v.union(v.literal('draft'), v.literal('approved'), v.literal('rejected')),
    /** True until a reviewer looks at the latest scrape. */
    needsReview: v.boolean(),
    /** The source page no longer mentions this place. */
    missingFromSource: v.optional(v.boolean()),
    /** The source text changed after this place was approved. */
    sourceChanged: v.optional(v.boolean()),
    /** `lastVerified` is older than the re-verification window (see maintenance.ts). */
    reverifyDue: v.optional(v.boolean()),
    /** A traveler reported this place as wrong (reports.ts). */
    travelerReported: v.optional(v.boolean()),
    scraped: scrapedFields,
    published: v.optional(publishedFields),
    lastVerified: v.optional(v.string()),
    sourceUrl: v.string(),
  })
    .index('by_source', ['sourceId'])
    .index('by_airport_review', ['airportCode', 'needsReview'])
    .index('by_airport_status', ['airportCode', 'status']),

  /** One row per scheduled or manual Apify run started from Convex (scrape.ts). */
  scrapeRuns: defineTable({
    startedAt: v.string(),
    trigger: v.union(v.literal('schedule'), v.literal('manual')),
    status: v.union(v.literal('started'), v.literal('failed'), v.literal('skipped')),
    apifyRunId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),

  /**
   * Short-lived cache of live flight lookups (flights.ts), so repeated
   * searches don't each start a paid Apify run, and so a changed gate can be
   * noticed by comparing with the previous lookup.
   */
  flightLookups: defineTable({
    /** `${flightCode}|${date}|${originCode}`, e.g. "UA1|2026-10-24|SFO". */
    key: v.string(),
    fetchedAt: v.number(),
    flight: v.union(flightValidator, v.null()),
    /** Gate from the lookup before this one, kept to detect gate changes. */
    previousGate: v.optional(v.union(v.string(), v.null())),
  }).index('by_key', ['key']),

  /**
   * Cartesia clips saved in file storage (voice.ts), one per text and voice,
   * so a repeated step plays without calling Cartesia again.
   */
  voiceClips: defineTable({
    /** SHA-256 of model, voice ID and text. */
    key: v.string(),
    storageId: v.id('_storage'),
  }).index('by_key', ['key']),

  /**
   * Hand-maintained floor-plan metadata (terminals, gate → area, area
   * centers) used to suggest pin positions in the review queue. Not the
   * traveler-facing `airports` record above. Seeded via `seed:airports`.
   */
  airportMaps: defineTable({
    code: v.string(),
    name: v.string(),
    terminals: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        floorPlanImage: v.union(v.string(), v.null()),
        boardingAreas: v.array(v.string()),
      }),
    ),
    gateAreas: v.record(v.string(), v.string()),
    areaCenters: v.record(v.string(), v.object({ x: v.number(), y: v.number() })),
  }).index('by_code', ['code']),
});
