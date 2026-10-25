import { internalMutation } from './_generated/server';

/**
 * Official pages can stay identical while the room itself moves or closes,
 * so "verified" expires: approved places older than this go back into the
 * review queue. They stay published (with their real lastVerified date)
 * until someone re-approves or unpublishes them.
 */
export const REVERIFY_AFTER_DAYS = 180;

export const flagStaleVerifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - REVERIFY_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let flagged = 0;

    // Small table (a few hundred places per airport at most); a full scan is fine.
    for await (const place of ctx.db.query('places')) {
      if (place.status !== 'approved' || place.reverifyDue) continue;
      if (!place.lastVerified || place.lastVerified < cutoff) {
        await ctx.db.patch(place._id, { reverifyDue: true, needsReview: true });
        flagged++;
      }
    }
    return { flagged };
  },
});
