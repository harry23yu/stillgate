import { defineApp } from "convex/server";
import { v } from "convex/values";

// IMPORT_SECRET: shared secret the Apify Actor sends in the x-import-secret header.
//   Set with: npx convex env set IMPORT_SECRET <long random string>
// ANTHROPIC_API_KEY: used by the phrasing action. Set with: npx convex env set ANTHROPIC_API_KEY <key>
const app = defineApp({
  env: {
    IMPORT_SECRET: v.optional(v.string()),
    ANTHROPIC_API_KEY: v.optional(v.string()),
  },
});

export default app;
