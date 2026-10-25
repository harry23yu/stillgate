import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { env, mutation, query } from './_generated/server';
import { publishedFields } from './schema';

/**
 * Reviewer API for src/app/review.tsx. Guarded by a shared REVIEW_KEY env var
 * on the deployment — fine for a small team, replace with Convex Auth before
 * anyone outside the team can reach the review screen.
 */
function requireReviewer(reviewKey: string) {
  const expected = env.REVIEW_KEY;
  if (!expected || reviewKey !== expected) {
    throw new ConvexError('Invalid review key');
  }
}

/** A reviewer decision answers every open review reason at once. */
const CLEARED_FLAGS = { missingFromSource: undefined, sourceChanged: undefined, reverifyDue: undefined };

export interface Suggestion {
  terminal: string | null;
  x: number | null;
  y: number | null;
  /** Human-readable reason, e.g. "Gate C2 → area-c". */
  basis: string;
}

/**
 * Turns the scraped gate/terminal hint into a starting map position using
 * the hand-made gate-to-area table. Always an approximation: the reviewer
 * confirms or moves it before approving.
 */
function suggestPosition(airport: Doc<'airportMaps'> | null, place: Doc<'places'>): Suggestion {
  const { gateHint, terminalHint } = place.scraped;
  if (!airport) return { terminal: null, x: null, y: null, basis: 'No airport map metadata — run seed:airports' };

  const areaId = gateHint ? airport.gateAreas[gateHint] : undefined;
  const center = areaId ? airport.areaCenters[areaId] : undefined;
  if (areaId && center) {
    const terminal = airport.terminals.find((t) => t.boardingAreas.includes(areaId));
    return { terminal: terminal?.id ?? null, x: center.x, y: center.y, basis: `Gate ${gateHint} → ${areaId}` };
  }

  if (terminalHint) {
    const hint = terminalHint.toLowerCase();
    const terminal = airport.terminals.find((t) => t.name.toLowerCase().includes(hint));
    if (terminal) return { terminal: terminal.id, x: null, y: null, basis: `Matched "${terminalHint}"` };
  }

  return { terminal: null, x: null, y: null, basis: 'No usable gate or terminal in the source text' };
}

export const queue = query({
  args: {
    reviewKey: v.string(),
    airportCode: v.string(),
    view: v.union(v.literal('needsReview'), v.literal('approved')),
  },
  handler: async (ctx, { reviewKey, airportCode, view }) => {
    requireReviewer(reviewKey);
    const code = airportCode.toUpperCase();
    const airport = await ctx.db
      .query('airportMaps')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique();

    const places =
      view === 'needsReview'
        ? await ctx.db
            .query('places')
            .withIndex('by_airport_review', (q) => q.eq('airportCode', code).eq('needsReview', true))
            .collect()
        : await ctx.db
            .query('places')
            .withIndex('by_airport_status', (q) => q.eq('airportCode', code).eq('status', 'approved'))
            .collect();

    return {
      terminals: airport?.terminals.map((t) => ({ id: t.id, name: t.name })) ?? [],
      places: places.map((place) => ({ ...place, suggestion: suggestPosition(airport, place) })),
    };
  },
});

export const approve = mutation({
  args: {
    reviewKey: v.string(),
    placeId: v.id('places'),
    published: publishedFields,
    /**
     * Publish as a separate place and keep the scraped draft in the queue —
     * for one mention that covers several places ("two relief areas outside
     * and one near Gate A2").
     */
    splitOff: v.boolean(),
  },
  handler: async (ctx, { reviewKey, placeId, published, splitOff }) => {
    requireReviewer(reviewKey);
    const place = await ctx.db.get(placeId);
    if (!place) throw new ConvexError('Place not found');
    if (published.x < 0 || published.x > 1 || published.y < 0 || published.y > 1) {
      throw new ConvexError('x and y are fractions of the floor plan and must be between 0 and 1');
    }

    const lastVerified = new Date().toISOString().slice(0, 10);
    if (splitOff) {
      const rootKey = place.parentKey ?? place.key;
      const siblings = await ctx.db
        .query('places')
        .withIndex('by_source', (q) => q.eq('sourceId', place.sourceId))
        .collect();
      const n = siblings.filter((p) => p.parentKey === rootKey).length + 2;
      return await ctx.db.insert('places', {
        airportCode: place.airportCode,
        sourceId: place.sourceId,
        key: `${rootKey}~${n}`,
        parentKey: rootKey,
        status: 'approved',
        needsReview: false,
        scraped: place.scraped,
        published,
        lastVerified,
        sourceUrl: place.sourceUrl,
      });
    }

    await ctx.db.patch(placeId, {
      status: 'approved',
      needsReview: false,
      ...CLEARED_FLAGS,
      published,
      lastVerified,
    });
    return placeId;
  },
});

/** Rejecting an approved place also unpublishes it. */
export const reject = mutation({
  args: { reviewKey: v.string(), placeId: v.id('places') },
  handler: async (ctx, { reviewKey, placeId }) => {
    requireReviewer(reviewKey);
    await ctx.db.patch(placeId, { status: 'rejected', needsReview: false, ...CLEARED_FLAGS });
  },
});

/** Sources are healthy if fetched without error within this many days. */
const SOURCE_STALE_DAYS = 10;

/** Per-source crawl health for the review screen, plus the latest scheduled/manual run. */
export const sources = query({
  args: { reviewKey: v.string(), airportCode: v.string() },
  handler: async (ctx, { reviewKey, airportCode }) => {
    requireReviewer(reviewKey);
    const code = airportCode.toUpperCase();
    const rows = await ctx.db
      .query('sources')
      .withIndex('by_airport_url', (q) => q.eq('airportCode', code))
      .collect();
    const lastRun = await ctx.db.query('scrapeRuns').order('desc').first();
    const staleBefore = Date.now() - SOURCE_STALE_DAYS * 24 * 60 * 60 * 1000;

    return {
      lastRun,
      sources: rows.map((source) => ({
        _id: source._id,
        url: source.url,
        lastFetchedAt: source.lastFetchedAt ?? null,
        lastChangedAt: source.lastChangedAt ?? null,
        lastError: source.lastError ?? null,
        health: source.lastError
          ? ('error' as const)
          : !source.lastFetchedAt || Date.parse(source.lastFetchedAt) < staleBefore
            ? ('stale' as const)
            : ('ok' as const),
      })),
    };
  },
});

/** Starts an Apify run right away instead of waiting for the weekly cron. */
export const runScrapeNow = mutation({
  args: { reviewKey: v.string() },
  handler: async (ctx, { reviewKey }) => {
    requireReviewer(reviewKey);
    await ctx.scheduler.runAfter(0, internal.scrape.startRun, { trigger: 'manual' });
  },
});
