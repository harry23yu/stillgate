import { v, type Infer } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { securitySide } from './schema';

/** Must match `DraftPlace` in scraper/src/extract.ts. */
const draftValidator = v.object({
  key: v.string(),
  type: v.union(v.literal('quiet'), v.literal('service')),
  name: v.string(),
  hours: v.union(v.string(), v.null()),
  locationHint: v.union(v.string(), v.null()),
  gateHint: v.union(v.string(), v.null()),
  terminalHint: v.union(v.string(), v.null()),
  securitySide: v.union(securitySide, v.null()),
  excerpt: v.string(),
});

/** Must match `ScrapedPage` in scraper/src/main.ts. */
const pageValidator = v.object({
  airportCode: v.string(),
  url: v.string(),
  fetchedAt: v.string(),
  contentHash: v.string(),
  title: v.string(),
  text: v.string(),
  drafts: v.array(draftValidator),
});

const failureValidator = v.object({ airportCode: v.string(), url: v.string(), error: v.string() });

type Draft = Infer<typeof draftValidator>;

/**
 * Change detection rules:
 * - Same content hash as last time: nothing changes.
 * - New mention: inserted as a draft for review.
 * - Changed mention: `scraped` updates, place goes back in the review queue.
 *   `published` is untouched, so travelers keep seeing the last verified
 *   version until a person re-approves it.
 * - Mention gone from the page: flagged `missingFromSource` for review, not deleted.
 */
export const ingestPages = internalMutation({
  args: { pages: v.array(pageValidator), failures: v.array(failureValidator) },
  handler: async (ctx, { pages, failures }) => {
    const now = new Date().toISOString();
    const summary = { unchanged: 0, changedPages: 0, newDrafts: 0, flaggedForReview: 0, failures: failures.length };

    for (const failure of failures) {
      const sourceId = await upsertSource(ctx, failure.airportCode, failure.url);
      await ctx.db.patch(sourceId, { lastFetchedAt: now, lastError: failure.error });
    }

    for (const page of pages) {
      const airportCode = page.airportCode.toUpperCase();
      const sourceId = await upsertSource(ctx, airportCode, page.url);
      const source = (await ctx.db.get(sourceId))!;

      if (source.lastHash === page.contentHash) {
        await ctx.db.patch(sourceId, { lastFetchedAt: page.fetchedAt, lastError: undefined });
        summary.unchanged++;
        continue;
      }

      summary.changedPages++;
      const pageId = await ctx.db.insert('rawPages', {
        sourceId,
        airportCode,
        url: page.url,
        fetchedAt: page.fetchedAt,
        contentHash: page.contentHash,
        title: page.title,
        text: page.text,
      });
      await ctx.db.patch(sourceId, {
        lastHash: page.contentHash,
        lastFetchedAt: page.fetchedAt,
        lastChangedAt: page.fetchedAt,
        lastError: undefined,
      });

      const draftsByKey = new Map(page.drafts.map((draft) => [draft.key, draft]));
      const existing = await ctx.db
        .query('places')
        .withIndex('by_source', (q) => q.eq('sourceId', sourceId))
        .collect();

      for (const place of existing) {
        // Split-off places follow the scraped mention they were split from.
        const draft = draftsByKey.get(place.parentKey ?? place.key);
        if (!draft) {
          if (!place.missingFromSource) {
            await ctx.db.patch(place._id, { missingFromSource: true, needsReview: true });
            if (place.status === 'approved') summary.flaggedForReview++;
          }
          continue;
        }

        const changed =
          draft.excerpt !== place.scraped.excerpt || draft.hours !== place.scraped.hours || !!place.missingFromSource;
        await ctx.db.patch(place._id, {
          scraped: toScraped(draft, pageId),
          missingFromSource: undefined,
          needsReview: place.needsReview || changed,
          sourceChanged: place.sourceChanged || (changed && place.status !== 'draft') || undefined,
        });
        if (changed && place.status === 'approved') summary.flaggedForReview++;
      }

      const existingKeys = new Set(existing.map((place) => place.key));
      for (const draft of page.drafts) {
        if (existingKeys.has(draft.key)) continue;
        await ctx.db.insert('places', {
          airportCode,
          sourceId,
          key: draft.key,
          status: 'draft',
          needsReview: true,
          scraped: toScraped(draft, pageId),
          sourceUrl: page.url,
        });
        summary.newDrafts++;
      }
    }

    return summary;
  },
});

function toScraped(draft: Draft, pageId: Id<'rawPages'>) {
  const { key: _key, ...fields } = draft;
  return { ...fields, pageId };
}

async function upsertSource(ctx: MutationCtx, airportCode: string, url: string): Promise<Id<'sources'>> {
  const code = airportCode.toUpperCase();
  const existing = await ctx.db
    .query('sources')
    .withIndex('by_airport_url', (q) => q.eq('airportCode', code).eq('url', url))
    .unique();
  return existing?._id ?? (await ctx.db.insert('sources', { airportCode: code, url }));
}
