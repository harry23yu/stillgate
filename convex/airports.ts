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
