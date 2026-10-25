import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { rateLimiter } from "./limits";

const MAX_NOTE_CHARS = 280;
const MAX_LIMIT = 50;
const SUMMARY_SAMPLE = 200; // most recent reports counted per spot
// One report per device per spot per window; reporting again inside it changes the answer instead.
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

// "Was this accurate?" Submit a report about one pin. Public and unauthenticated (no accounts in
// the MVP), so it is kept small: the spot must exist, the note is capped, and each device counts
// once per spot per day. The device id is anonymous and can be reset by clearing app data, so this
// stops casual repeat taps, not a determined abuser; real limits need sign-in.
export const submitReport = mutation({
  args: {
    airportCode: v.string(),
    spotId: v.string(),
    verdict: v.union(v.literal("accurate"), v.literal("wrong")),
    note: v.optional(v.string()),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const overall = await rateLimiter.limit(ctx, "submitReport");
    if (!overall.ok) throw new ConvexError("Too many reports right now. Please try again in a minute.");

    const airportCode = args.airportCode.toUpperCase();
    if (!/^[A-Za-z0-9-]{16,64}$/.test(args.deviceId)) throw new ConvexError("Invalid device id.");

    // Pins published through the scraper → review pipeline are `places` rows,
    // reported by their document id. A "wrong" report puts the place back in
    // the review queue; it stays published until a reviewer decides.
    const placeId = ctx.db.normalizeId("places", args.spotId);
    if (placeId) {
      const place = await ctx.db.get(placeId);
      if (!place || place.status !== "approved" || place.airportCode !== airportCode) {
        throw new ConvexError("Unknown spot for this airport.");
      }
      if (args.verdict === "wrong") {
        await ctx.db.patch(placeId, { needsReview: true, travelerReported: true });
      }
    } else {
      const airport = await ctx.db
        .query("airports")
        .withIndex("by_code", (q) => q.eq("code", airportCode))
        .unique();
      if (!airport) throw new ConvexError("Unknown airport.");

      const known =
        airport.quietSpots.some((s) => s.id === args.spotId) ||
        airport.loudZones.some((z) => z.id === args.spotId) ||
        airport.services.some((s) => s.id === args.spotId);
      if (!known) throw new ConvexError("Unknown spot for this airport.");
    }

    // Per-pin limit, after validation so only real pins create limiter keys.
    const perSpot = await rateLimiter.limit(ctx, "submitReportPerSpot", { key: `${airportCode}:${args.spotId}` });
    if (!perSpot.ok) throw new ConvexError("Too many reports for this spot right now. Please try again in a minute.");

    const note = args.note?.trim();
    if (note && note.length > MAX_NOTE_CHARS) {
      throw new ConvexError(`Note is too long (max ${MAX_NOTE_CHARS} characters).`);
    }

    const previous = await ctx.db
      .query("reports")
      .withIndex("by_airportCode_and_spotId_and_deviceId", (q) =>
        q.eq("airportCode", airportCode).eq("spotId", args.spotId).eq("deviceId", args.deviceId),
      )
      .order("desc")
      .first();
    if (previous && Date.now() - previous._creationTime < REPEAT_WINDOW_MS) {
      // Same device again today: update its answer rather than adding another vote.
      if (previous.verdict !== args.verdict || (note && note !== previous.note)) {
        await ctx.db.patch(previous._id, { verdict: args.verdict, ...(note ? { note } : {}) });
      }
      return previous._id;
    }

    return await ctx.db.insert("reports", {
      airportCode,
      spotId: args.spotId,
      verdict: args.verdict,
      deviceId: args.deviceId,
      ...(note ? { note } : {}),
    });
  },
});

// Most recent reports, newest first. Live: clients subscribed to this update when a report arrives.
export const listRecentReports = query({
  args: {
    airportCode: v.string(),
    spotId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const airportCode = args.airportCode.toUpperCase();
    const limit = Math.max(1, Math.min(args.limit ?? 20, MAX_LIMIT));
    const spotId = args.spotId;
    const rows =
      spotId === undefined
        ? await ctx.db
            .query("reports")
            .withIndex("by_airportCode", (q) => q.eq("airportCode", airportCode))
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("reports")
            .withIndex("by_airportCode_and_spotId", (q) =>
              q.eq("airportCode", airportCode).eq("spotId", spotId),
            )
            .order("desc")
            .take(limit);
    return rows.map((r) => ({
      id: r._id,
      airportCode: r.airportCode,
      spotId: r.spotId,
      verdict: r.verdict,
      note: r.note ?? null,
      createdAt: r._creationTime,
    }));
  },
});

// Counts for one pin, from its most recent reports only (bounded; no whole-table scan).
export const spotReportSummary = query({
  args: { airportCode: v.string(), spotId: v.string() },
  handler: async (ctx, args) => {
    const airportCode = args.airportCode.toUpperCase();
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_airportCode_and_spotId", (q) =>
        q.eq("airportCode", airportCode).eq("spotId", args.spotId),
      )
      .order("desc")
      .take(SUMMARY_SAMPLE);
    const wrong = rows.filter((r) => r.verdict === "wrong").length;
    return {
      airportCode,
      spotId: args.spotId,
      accurate: rows.length - wrong,
      wrong,
      total: rows.length,
      // True when there may be older reports not counted here.
      truncated: rows.length === SUMMARY_SAMPLE,
    };
  },
});
