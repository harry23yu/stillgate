import { defineApp } from "convex/server";
import { v } from "convex/values";

// Shared secret the Apify Actor sends in the x-import-secret header.
// Set it with: npx convex env set IMPORT_SECRET <long random string>
const app = defineApp({
  env: { IMPORT_SECRET: v.optional(v.string()) },
});

export default app;
