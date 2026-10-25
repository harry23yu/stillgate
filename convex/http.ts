import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { env } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Constant-time-ish comparison so the secret is not leaked through timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// POST /importAirport
// Header: x-import-secret: <IMPORT_SECRET>
// Body: one Airport record (see shared/schema.ts). Replaces any existing record with the same code.
// Invalid records are rejected with 400; nothing is written.
http.route({
  path: "/importAirport",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = env.IMPORT_SECRET;
    if (!secret) return json({ error: "Import is disabled: IMPORT_SECRET is not set." }, 503);
    const sent = req.headers.get("x-import-secret") ?? "";
    if (!safeEqual(sent, secret)) return json({ error: "Unauthorized." }, 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body must be valid JSON." }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json({ error: "Body must be a single airport object." }, 400);
    }

    try {
      // The mutation's argument validators (the airports schema) do the real validation.
      const id = await ctx.runMutation(
        internal.airports.upsertAirport,
        body as (typeof internal.airports.upsertAirport)["_args"],
      );
      return json({ ok: true, id }, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("ArgumentValidationError")) {
        // The full validator dump is huge; keep the reason only.
        const reason = message.split("\n").find((l) => l.includes("ArgumentValidationError")) ?? message;
        return json({ error: "Invalid airport record.", detail: reason.slice(0, 500) }, 400);
      }
      return json({ error: "Import failed." }, 500);
    }
  }),
});

// POST /ingest
// Called by the accessibility scraper Actor at the end of each run (scraper/src/main.ts).
// Header: Authorization: Bearer <INGEST_SECRET>
// Body: { pages: ScrapedPage[], failures: FailedPage[] }. Creates/updates draft places for review;
// nothing reaches travelers until a reviewer approves it (convex/review.ts).
http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = env.INGEST_SECRET;
    if (!secret) return json({ error: "Ingest is disabled: INGEST_SECRET is not set." }, 503);
    const sent = req.headers.get("authorization") ?? "";
    if (!safeEqual(sent, `Bearer ${secret}`)) return json({ error: "Unauthorized." }, 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body must be valid JSON." }, 400);
    }

    try {
      // The internal mutation's validators check the payload shape.
      const summary = await ctx.runMutation(
        internal.ingest.ingestPages,
        body as (typeof internal.ingest.ingestPages)["_args"],
      );
      return json(summary, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return json({ error: "Ingest rejected.", detail: message.slice(0, 500) }, 400);
    }
  }),
});

export default http;
