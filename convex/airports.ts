import { v } from 'convex/values';

import { query } from './_generated/server';

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
