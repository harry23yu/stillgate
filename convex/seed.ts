import { chsAirport } from '../src/data/mock/chs';
import { sfoAirport } from '../src/data/mock/sfo';
import { internalMutation } from './_generated/server';

/**
 * Copies hand-made map metadata (terminals, gate → area, area centers) into
 * the `airports` table so the review queue can suggest positions. Places are
 * NOT seeded: they come through the scraper + review flow.
 *
 *   npx convex run seed:airports
 */
/**
 * Starting crawl list for the weekly scrape (scrape.ts). Add more with
 * `npx convex run scrape:addSource`.
 *
 *   npx convex run seed:sources
 */
const DEFAULT_SOURCES = [
  { airportCode: 'SFO', url: 'https://www.flysfo.com/passengers/services/sensory-room' },
  { airportCode: 'CHS', url: 'https://iflychs.com/passengers/accessibility/' },
];

export const sources = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const source of DEFAULT_SOURCES) {
      const existing = await ctx.db
        .query('sources')
        .withIndex('by_airport_url', (q) => q.eq('airportCode', source.airportCode).eq('url', source.url))
        .unique();
      if (!existing) await ctx.db.insert('sources', source);
    }
  },
});

export const airports = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const airport of [sfoAirport, chsAirport]) {
      const fields = {
        code: airport.code,
        name: airport.name,
        terminals: airport.terminals,
        gateAreas: airport.gateAreas,
        areaCenters: airport.areaCenters,
      };
      const existing = await ctx.db
        .query('airports')
        .withIndex('by_code', (q) => q.eq('code', airport.code))
        .unique();
      if (existing) await ctx.db.replace(existing._id, fields);
      else await ctx.db.insert('airports', fields);
    }
  },
});
