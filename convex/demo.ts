import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

/**
 * Puts one airport's scraped data back to "never scraped", so a demo run
 * visibly creates fresh drafts instead of reporting "unchanged". Sources
 * themselves are kept. Internal: CLI only.
 *
 *   npx convex run demo:reset '{"airportCode":"SFO"}'
 *
 * Deletes that airport's places (including approved ones), their traveler
 * reports, and raw page snapshots. Never run this against a production
 * deployment.
 */
export const reset = internalMutation({
  args: { airportCode: v.string() },
  handler: async (ctx, { airportCode }) => {
    const code = airportCode.toUpperCase();
    const sources = await ctx.db
      .query('sources')
      .withIndex('by_airport_url', (q) => q.eq('airportCode', code))
      .collect();

    let places = 0;
    let pages = 0;
    let reports = 0;
    for (const source of sources) {
      for (const place of await ctx.db
        .query('places')
        .withIndex('by_source', (q) => q.eq('sourceId', source._id))
        .collect()) {
        // Traveler reports on a pipeline place are keyed by its id (reports.ts).
        for (const report of await ctx.db
          .query('reports')
          .withIndex('by_airportCode_and_spotId', (q) => q.eq('airportCode', code).eq('spotId', place._id))
          .collect()) {
          await ctx.db.delete(report._id);
          reports++;
        }
        await ctx.db.delete(place._id);
        places++;
      }
      for (const page of await ctx.db
        .query('rawPages')
        .withIndex('by_source', (q) => q.eq('sourceId', source._id))
        .collect()) {
        await ctx.db.delete(page._id);
        pages++;
      }
      await ctx.db.patch(source._id, {
        lastHash: undefined,
        lastFetchedAt: undefined,
        lastChangedAt: undefined,
        lastError: undefined,
      });
    }
    return { sources: sources.length, places, pages, reports };
  },
});
