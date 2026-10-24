import { v } from "convex/values";
import { query } from "./_generated/server";

// Gate-change help: given the new gate and the traveler's profile, rank the nearest quiet spots.
// Plain rules only (no LLM, no graph routing). A wrong answer is worse than none, so a spot with
// no known walk time is returned with walkMinutes: null instead of a guess.

// The profile lives on-device. The app sends it with each call; it is never stored.
const sensoryProfile = v.object({
  noise: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  crowds: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  lighting: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  whatHelps: v.array(v.string()),
  firstFlight: v.boolean(),
  detailLevel: v.union(v.literal("brief"), v.literal("detailed")),
});

// PLACEHOLDER walk times in minutes: airport code -> gate -> quiet spot id.
// Not measured. Replace with real values (walk it, or read the airport map) before verifying.
// A missing entry means "unknown".
const WALK_MINUTES: Record<string, Record<string, Record<string, number>>> = {
  SFO: {
    C2: { "sfo-sensory-room-t1": 2 },
  },
};

// How much a sensory room is preferred (in minutes of walking) when the traveler is sensitive.
const SENSORY_ROOM_BONUS_MINUTES = 3;

export const nearestQuietSpots = query({
  args: {
    airportCode: v.string(),
    gate: v.string(),
    profile: sensoryProfile,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const code = args.airportCode.toUpperCase();
    const gate = args.gate.trim().toUpperCase();
    const airport = await ctx.db
      .query("airports")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!airport) return null;

    const sensitive =
      args.profile.noise === "high" ||
      args.profile.crowds === "high" ||
      args.profile.lighting === "high";
    const minutesForGate = WALK_MINUTES[code]?.[gate] ?? {};

    const ranked = airport.quietSpots
      .map((spot) => {
        const walkMinutes = minutesForGate[spot.id] ?? null;
        const bonus = sensitive && spot.kind === "sensory_room" ? SENSORY_ROOM_BONUS_MINUTES : 0;
        return {
          spot,
          walkMinutes,
          // Unknown walk times sort last.
          score: walkMinutes === null ? Number.POSITIVE_INFINITY : walkMinutes - bonus,
        };
      })
      .sort((a, b) => a.score - b.score);

    const limit = Math.max(1, Math.min(args.limit ?? 3, 10));
    return {
      airportCode: code,
      gate,
      // The walk times are estimates until someone measures them; the UI should say so.
      walkTimesAreEstimates: true,
      results: ranked.slice(0, limit).map(({ spot, walkMinutes }) => ({
        id: spot.id,
        name: spot.name,
        kind: spot.kind,
        location: spot.location,
        hours: spot.hours ?? null,
        notes: spot.notes ?? null,
        verifiedDate: spot.verifiedDate,
        walkMinutes,
      })),
    };
  },
});
