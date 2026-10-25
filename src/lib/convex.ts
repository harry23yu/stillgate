import { ConvexReactClient } from 'convex/react';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;

/**
 * Null until EXPO_PUBLIC_CONVEX_URL is set (`npx convex dev` writes it to
 * .env.local). Traveler screens still read mock data through
 * src/data/client.ts, so the app runs without a backend.
 */
export const convex = url ? new ConvexReactClient(url, { unsavedChangesWarning: false }) : null;
