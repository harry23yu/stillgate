import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery } from './_generated/server';

/**
 * Convex owns the schedule and the source list; Apify just crawls.
 * crons.ts calls `startRun` weekly, which starts the Actor with every row in
 * `sources` and tells it to POST back to this deployment's /ingest.
 *
 * Deployment env vars:
 *   APIFY_TOKEN      Apify API token (Console → Settings → API & Integrations)
 *   APIFY_ACTOR_ID   "<username>~stillgate-accessibility-scraper" or the Actor ID
 *   INGEST_SECRET    same value checked by http.ts
 */

const trigger = v.union(v.literal('schedule'), v.literal('manual'));

export const startRun = internalAction({
  args: { trigger },
  handler: async (ctx, { trigger }) => {
    const startedAt = new Date().toISOString();
    const token = process.env.APIFY_TOKEN;
    const actorId = process.env.APIFY_ACTOR_ID;
    const ingestSecret = process.env.INGEST_SECRET;
    const siteUrl = process.env.CONVEX_SITE_URL;

    if (!token || !actorId || !ingestSecret || !siteUrl) {
      const error = 'Set APIFY_TOKEN, APIFY_ACTOR_ID and INGEST_SECRET on the deployment to enable scheduled scrapes';
      await ctx.runMutation(internal.scrape.recordRun, { startedAt, trigger, status: 'skipped', error });
      return;
    }

    const sources = await ctx.runQuery(internal.scrape.listSources, {});
    if (sources.length === 0) {
      await ctx.runMutation(internal.scrape.recordRun, {
        startedAt,
        trigger,
        status: 'skipped',
        error: 'No sources — run seed:sources or scrape:addSource',
      });
      return;
    }

    const response = await fetch(`https://api.apify.com/v2/actors/${encodeURIComponent(actorId)}/runs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: sources.map(({ airportCode, url }) => ({ airportCode, url })),
        ingestUrl: `${siteUrl}/ingest`,
        ingestSecret,
      }),
    });

    if (!response.ok) {
      const error = `Apify responded ${response.status}: ${(await response.text()).slice(0, 500)}`;
      await ctx.runMutation(internal.scrape.recordRun, { startedAt, trigger, status: 'failed', error });
      return;
    }

    const run = (await response.json()) as { data?: { id?: string } };
    await ctx.runMutation(internal.scrape.recordRun, {
      startedAt,
      trigger,
      status: 'started',
      apifyRunId: run.data?.id,
    });
  },
});

export const listSources = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query('sources').collect(),
});

export const recordRun = internalMutation({
  args: {
    startedAt: v.string(),
    trigger,
    status: v.union(v.literal('started'), v.literal('failed'), v.literal('skipped')),
    apifyRunId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, run) => {
    await ctx.db.insert('scrapeRuns', run);
  },
});

/**
 *   npx convex run scrape:addSource '{"airportCode":"SFO","url":"https://..."}'
 */
export const addSource = internalMutation({
  args: { airportCode: v.string(), url: v.string() },
  handler: async (ctx, { airportCode, url }) => {
    const code = airportCode.toUpperCase();
    const existing = await ctx.db
      .query('sources')
      .withIndex('by_airport_url', (q) => q.eq('airportCode', code).eq('url', url))
      .unique();
    return existing?._id ?? (await ctx.db.insert('sources', { airportCode: code, url }));
  },
});

/**
 * Stops crawling a URL. Places already approved from it stay published, so
 * remove those in the review screen if the page is gone for good.
 */
export const removeSource = internalMutation({
  args: { airportCode: v.string(), url: v.string() },
  handler: async (ctx, { airportCode, url }) => {
    const source = await ctx.db
      .query('sources')
      .withIndex('by_airport_url', (q) => q.eq('airportCode', airportCode.toUpperCase()).eq('url', url))
      .unique();
    if (source) await ctx.db.delete(source._id);
  },
});
