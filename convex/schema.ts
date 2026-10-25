import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Accessibility data pipeline storage. The app only ever reads
 * `places.published` on places with `status: 'approved'` — scraped fields
 * are reviewer input, never shown to travelers directly.
 */

export const placeType = v.union(v.literal('quiet'), v.literal('loud'), v.literal('service'), v.literal('food'));
export const confidence = v.union(v.literal('low'), v.literal('medium'), v.literal('high'));
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

export default defineSchema({
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

  /** Hand-maintained map metadata (not scraped). Seeded from src/data/mock via `seed:airports`. */
  airports: defineTable({
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
