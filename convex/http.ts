import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

/**
 * Called by the Apify Actor at the end of each run (scraper/src/main.ts).
 * Body: { pages: ScrapedPage[], failures: FailedPage[] }.
 */
http.route({
  path: '/ingest',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.INGEST_SECRET;
    if (!secret) {
      return new Response('INGEST_SECRET is not set on this deployment', { status: 500 });
    }
    if (request.headers.get('Authorization') !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Body must be JSON', { status: 400 });
    }

    try {
      // The internal mutation's validators check the payload shape.
      const summary = await ctx.runMutation(internal.ingest.ingestPages, body as never);
      return Response.json(summary);
    } catch (error) {
      return new Response(`Ingest rejected: ${(error as Error).message}`, { status: 400 });
    }
  }),
});

export default http;
