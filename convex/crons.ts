import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Monday 14:00 UTC (7am Pacific / 10am Eastern): re-crawl every source.
// Unchanged pages are skipped by ingest, so a weekly run is cheap.
crons.weekly(
  'scrape accessibility pages',
  { dayOfWeek: 'monday', hourUTC: 14, minuteUTC: 0 },
  internal.scrape.startRun,
  { trigger: 'schedule' },
);

crons.daily('flag stale verifications', { hourUTC: 15, minuteUTC: 0 }, internal.maintenance.flagStaleVerifications);

export default crons;
