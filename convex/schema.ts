import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Mirrors shared/schema.ts (the source of truth for the app types). Keep the two in sync.
// Dates are ISO strings; null means "never verified by a human".

const confidence = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

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

// SensoryProfile is intentionally not a table: it stays on-device.
export default defineSchema({
  airports: defineTable(airportFields).index("by_code", ["code"]),
});
