import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";

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

type Profile = Infer<typeof sensoryProfile>;

// Shared by nearestQuietSpots and gateChangeSteps so both always agree.
async function findQuietSpots(
  ctx: QueryCtx,
  args: { airportCode: string; gate: string; profile: Profile; limit?: number },
) {
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
    walkTimesAreEstimates: true as const,
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
}

export const nearestQuietSpots = query({
  args: {
    airportCode: v.string(),
    gate: v.string(),
    profile: sensoryProfile,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => findQuietSpots(ctx, args),
});

// Builds the step sentences for a gate change from the data, in plain code. The facts (gate, place,
// minutes, hours) come only from the database and the walk-time table; none pass through an LLM.
// The app can then send `steps` to phrase:phraseSteps to soften the wording.
// brief: gate + nearest spot. detailed: also hours, notes, and a caveat when not yet verified.
export const gateChangeSteps = query({
  args: {
    airportCode: v.string(),
    gate: v.string(),
    fromGate: v.optional(v.string()),
    profile: sensoryProfile,
  },
  handler: async (ctx, args) => {
    const found = await findQuietSpots(ctx, { ...args, limit: 1 });
    if (!found) return null;

    const fromGate = args.fromGate?.trim().toUpperCase();
    const steps: string[] = [
      fromGate && fromGate !== found.gate
        ? `Your gate changed from ${fromGate} to ${found.gate}.`
        : `Your gate is now ${found.gate}.`,
    ];

    const top = found.results[0];
    if (!top) {
      steps.push("We do not have a quiet place listed for this airport yet.");
      return { ...found, steps, spot: null };
    }

    steps.push(
      top.walkMinutes === null
        ? `A quiet place near you is the ${top.name}. We do not know the walking time yet.`
        : `The nearest quiet place is the ${top.name}, about ${top.walkMinutes} minutes away (an estimate).`,
    );

    if (args.profile.detailLevel === "detailed") {
      if (top.hours) steps.push(`It is open from ${top.hours}${top.hours.endsWith(".") ? "" : "."}`);
      if (top.notes) steps.push(top.notes);
      if (top.verifiedDate === null) steps.push("This information has not been verified yet.");
    }

    return { ...found, steps, spot: top };
  },
});

// Demo only: we cannot trigger a real gate change, so this returns a canned event.
// It is always labeled simulated; the app must show that label. The new gate is one that has
// a walk-time entry so the follow-up nearestQuietSpots call returns a real (estimated) time.
// No wall clock here (queries shouldn't read it), so there is no timestamp.
const SIMULATED_CHANGES: Record<string, { fromGate: string; toGate: string }> = {
  SFO: { fromGate: "B7", toGate: "C2" },
};

export const simulateGateChange = query({
  args: {
    airportCode: v.string(),
    flightNumber: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const code = args.airportCode.toUpperCase();
    const change = SIMULATED_CHANGES[code];
    if (!change) return null;
    return {
      simulated: true as const,
      label: "Simulated gate change (demo data, not a real flight)",
      airportCode: code,
      flightNumber: args.flightNumber?.trim().toUpperCase() ?? "XX123",
      fromGate: change.fromGate,
      toGate: change.toGate,
    };
  },
});
