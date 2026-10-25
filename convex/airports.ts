import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { airportFields } from "./schema";

export const getAirport = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("airports")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
  },
});

export const listAirports = query({
  args: {},
  handler: async (ctx) => {
    const airports = await ctx.db.query("airports").take(100);
    return airports.map((a) => ({
      code: a.code,
      name: a.name,
      verifiedStatus: a.verifiedStatus,
    }));
  },
});

// Insert or replace an airport by code. Internal: used for seeding and, later, the Apify import.
// Example: npx convex run airports:upsertAirport "$(cat shared/data/sfo.json)"
export const upsertAirport = internalMutation({
  args: airportFields,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("airports")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (existing) {
      await ctx.db.replace("airports", existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("airports", args);
  },
});

/**
 * Traveler-facing read: approved places only, in the app's `Place` shape
 * (src/data/types.ts). No review key — this is exactly what the app is
 * allowed to show. Map metadata (terminals, gate areas) stays bundled with
 * the app because the floor-plan layout is drawn against it.
 */
export const get = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const approved = await ctx.db
      .query('places')
      .withIndex('by_airport_status', (q) => q.eq('airportCode', code.toUpperCase()).eq('status', 'approved'))
      .collect();

    return {
      places: approved.flatMap((place) =>
        place.published
          ? [
              {
                id: place._id as string,
                ...place.published,
                lastVerified: place.lastVerified ?? 'unknown',
                source: place.sourceUrl,
              },
            ]
          : [],
      ),
    };
  },
});
