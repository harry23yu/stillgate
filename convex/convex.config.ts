import { defineApp } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

// IMPORT_SECRET: shared secret the Apify Actor sends in the x-import-secret header.
//   Set with: npx convex env set IMPORT_SECRET <long random string>
// ANTHROPIC_API_KEY: used by the phrasing action. Set with: npx convex env set ANTHROPIC_API_KEY <key>
//
// Accessibility data pipeline (scraper/, convex/ingest.ts, review.ts, scrape.ts, flights.ts):
// INGEST_SECRET: bearer token the accessibility scraper sends to POST /ingest.
// REVIEW_KEY: shared key for the internal /review screen (replace with real auth before launch).
// APIFY_TOKEN: Apify API token, used to start the weekly scrape and live flight lookups.
// APIFY_ACTOR_ID: the deployed accessibility scraper, e.g. "<username>~stillgate-accessibility-scraper".
// FLIGHT_ACTOR_ID: optional override for the flight-status Actor (default parseforge~flightstats-scraper).
const app = defineApp({
  env: {
    IMPORT_SECRET: v.optional(v.string()),
    ANTHROPIC_API_KEY: v.optional(v.string()),
    INGEST_SECRET: v.optional(v.string()),
    REVIEW_KEY: v.optional(v.string()),
    APIFY_TOKEN: v.optional(v.string()),
    APIFY_ACTOR_ID: v.optional(v.string()),
    FLIGHT_ACTOR_ID: v.optional(v.string()),
  },
});

// Rate limits are defined in convex/limits.ts.
app.use(rateLimiter);

export default app;
