import { createHash } from 'node:crypto';

import { Actor, log } from 'apify';
import { CheerioCrawler, PlaywrightCrawler, type CheerioCrawlingContext, type Request } from 'crawlee';

import { extractDrafts, normalizeWhitespace, type Block, type DraftPlace } from './extract.js';

interface Input {
  sources: { airportCode: string; url: string }[];
  useBrowser?: boolean;
  ingestUrl?: string;
  ingestSecret?: string;
}

/** One crawled page. This is the body of POST /ingest — see `convex/ingest.ts`. */
interface ScrapedPage {
  airportCode: string;
  url: string;
  fetchedAt: string;
  /** sha256 of the cleaned text, so cosmetic HTML changes don't trigger re-review. */
  contentHash: string;
  title: string;
  text: string;
  drafts: DraftPlace[];
}

interface FailedPage {
  airportCode: string;
  url: string;
  error: string;
}

type Cheerio$ = CheerioCrawlingContext['$'];

/** Convex documents max out at 1 MiB; accessibility pages are far smaller. */
const MAX_TEXT_CHARS = 100_000;

await Actor.init();

const input = await Actor.getInput<Input>();
if (!input?.sources?.length) {
  throw new Error('Input must include at least one { airportCode, url } in "sources".');
}

const pages: ScrapedPage[] = [];
const failures: FailedPage[] = [];

function pageToBlocks($: Cheerio$): Block[] {
  // Single-topic pages (SFO's Sensory Room page) often keep their only heading
  // in a hero banner outside <main>. Use it as the heading of the opening
  // text so the whole page is read as describing that one place.
  const pageHeading =
    normalizeWhitespace($('h1').first().text()) || normalizeWhitespace($('title').text()).replace(/\s*[|–—].*$/, '') || null;

  $('script, style, noscript, svg, iframe, form, nav, header, footer, [role="navigation"], [aria-hidden="true"]').remove();
  const root = $('main').length ? $('main').first() : $('body');

  const blocks: Block[] = [];
  let current: Block = { heading: pageHeading, text: '' };
  root.find('h1, h2, h3, h4, p, li, dt, dd, td').each((_, el) => {
    const text = normalizeWhitespace($(el).text());
    if (!text) return;
    if (/^h[1-4]$/i.test(el.tagName)) {
      if (text === pageHeading && !current.text) return;
      if (current.text) blocks.push(current);
      current = { heading: text, text: '' };
    } else {
      current.text = current.text ? `${current.text} ${text}` : text;
    }
  });
  if (current.text) blocks.push(current);
  return blocks;
}

async function handlePage(request: Request, $: Cheerio$) {
  const airportCode = String(request.userData.airportCode);
  const url = request.loadedUrl ?? request.url;
  const title = normalizeWhitespace($('title').text());
  const blocks = pageToBlocks($);
  const text = blocks.map((b) => [b.heading, b.text].filter(Boolean).join('\n')).join('\n\n').slice(0, MAX_TEXT_CHARS);
  const drafts = extractDrafts(blocks);

  const page: ScrapedPage = {
    airportCode,
    url: request.url,
    fetchedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(text).digest('hex'),
    title,
    text,
    drafts,
  };
  pages.push(page);
  await Actor.pushData(page);
  log.info(`${airportCode} ${url}: ${blocks.length} blocks, ${drafts.length} drafts`);
}

function handleFailure(request: Request, error: Error) {
  failures.push({ airportCode: String(request.userData.airportCode), url: request.url, error: error.message });
  log.error(`Failed ${request.url}: ${error.message}`);
}

const requests = input.sources.map((source) => ({
  url: source.url,
  // Same URL listed for two airports should still be crawled twice.
  uniqueKey: `${source.airportCode}:${source.url}`,
  userData: { airportCode: source.airportCode.toUpperCase() },
}));

const crawler = input.useBrowser
  ? new PlaywrightCrawler({
      maxRequestRetries: 2,
      async requestHandler({ request, page, parseWithCheerio }) {
        await page.waitForLoadState('networkidle');
        await handlePage(request, await parseWithCheerio());
      },
      failedRequestHandler: ({ request }, error) => handleFailure(request, error),
    })
  : new CheerioCrawler({
      maxRequestRetries: 2,
      async requestHandler({ request, $ }) {
        await handlePage(request, $);
      },
      failedRequestHandler: ({ request }, error) => handleFailure(request, error),
    });

await crawler.run(requests);

if (input.ingestUrl) {
  const response = await fetch(input.ingestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.ingestSecret ?? ''}`,
    },
    body: JSON.stringify({ pages, failures }),
  });
  const body = await response.text();
  if (!response.ok) {
    // Fail the run so the Apify console shows it instead of silently dropping data.
    throw new Error(`Ingest failed (${response.status}): ${body}`);
  }
  log.info(`Ingest OK: ${body}`);
} else {
  log.warning('No ingestUrl set; results are only in the Apify dataset.');
}

await Actor.exit();
