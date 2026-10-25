import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// Application-level rate limits (Convex rate-limiter component). The app has no accounts, so these are
// global or per-pin limits that protect credits and data quality, not per-user quotas. Numbers are
// generous enough for a live demo with several people tapping at once.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Claude rewording (phrase.ts): each call spends Anthropic credits.
  phraseSteps: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 10 },
  // Cartesia speech: each uncached clip spends Cartesia credits. Defined here for voice actions to use:
  //   const { ok } = await rateLimiter.limit(ctx, "synthesizeSpeech");
  synthesizeSpeech: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
  // "Was this accurate?" reports (reports.ts): overall ceiling, plus a per-pin limit so spam on one
  // pin cannot bury the others.
  submitReport: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 20 },
  submitReportPerSpot: { kind: "token bucket", rate: 6, period: MINUTE, capacity: 6 },
});
