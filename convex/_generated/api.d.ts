/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as airports from "../airports.js";
import type * as crons from "../crons.js";
import type * as flights from "../flights.js";
import type * as gateChange from "../gateChange.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as limits from "../limits.js";
import type * as maintenance from "../maintenance.js";
import type * as phrase from "../phrase.js";
import type * as reports from "../reports.js";
import type * as review from "../review.js";
import type * as scrape from "../scrape.js";
import type * as seed from "../seed.js";
import type * as voice from "../voice.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  airports: typeof airports;
  crons: typeof crons;
  flights: typeof flights;
  gateChange: typeof gateChange;
  http: typeof http;
  ingest: typeof ingest;
  limits: typeof limits;
  maintenance: typeof maintenance;
  phrase: typeof phrase;
  reports: typeof reports;
  review: typeof review;
  scrape: typeof scrape;
  seed: typeof seed;
  voice: typeof voice;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
