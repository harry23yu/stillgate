#!/usr/bin/env node
// Demo fallback: send the saved scrape (demo/snapshot.json) to the backend's
// /ingest endpoint, exactly as the Apify Actor does at the end of a run.
// Use when an airport site is slow or blocking during a live demo.
//
//   node demo/replay.mjs <ingest-url> <ingest-secret>
//   node demo/replay.mjs http://127.0.0.1:3211/ingest local-ingest-secret
import { readFile } from 'node:fs/promises';

const [ingestUrl, secret] = process.argv.slice(2);
if (!ingestUrl || !secret) {
  console.error('Usage: node demo/replay.mjs <ingest-url> <ingest-secret>');
  process.exit(1);
}

const snapshot = JSON.parse(await readFile(new URL('./snapshot.json', import.meta.url), 'utf8'));
// Same page content (same content hash), stamped as fetched now.
const now = new Date().toISOString();
const pages = snapshot.pages.map((page) => ({ ...page, fetchedAt: now }));

const response = await fetch(ingestUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
  body: JSON.stringify({ pages, failures: [] }),
});
const body = await response.text();
console.log(`${response.status} ${body}`);
process.exit(response.ok ? 0 : 1);
