/**
 * Turns the text of an official accessibility page into *draft* Stillgate
 * places. Everything here is a keyword heuristic, not a verified fact: every
 * draft must be reviewed (and placed on the floor plan) by a person before
 * the app shows it. The output shape is the Convex ingest contract — keep it
 * in sync with `convex/ingest.ts`.
 */

export type DraftPlaceType = 'quiet' | 'service';
export type SecuritySide = 'pre' | 'post';

export interface Block {
  heading: string | null;
  text: string;
}

export interface DraftPlace {
  /** Stable per-airport key so re-scrapes update the same record. */
  key: string;
  type: DraftPlaceType;
  name: string;
  hours: string | null;
  /** The sentence(s) the location came from, e.g. "post-security near Gate C2". */
  locationHint: string | null;
  gateHint: string | null;
  terminalHint: string | null;
  securitySide: SecuritySide | null;
  /** Verbatim text the draft was built from, shown to the reviewer. */
  excerpt: string;
}

interface Rule {
  key: string;
  type: DraftPlaceType;
  label: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  { key: 'sensory-room', type: 'quiet', label: 'Sensory room', pattern: /\bsensory\s+(room|suite|space)\b/i },
  { key: 'quiet-room', type: 'quiet', label: 'Quiet room', pattern: /\bquiet\s+(room|zone|area|space)\b/i },
  { key: 'meditation-room', type: 'quiet', label: 'Meditation room', pattern: /\b(meditation|reflection|relaxation)\s+room\b/i },
  { key: 'yoga-room', type: 'quiet', label: 'Yoga room', pattern: /\byoga\s+room\b/i },
  { key: 'chapel', type: 'quiet', label: 'Chapel / interfaith room', pattern: /\b(chapel|interfaith|prayer\s+room)\b/i },
  {
    key: 'animal-relief',
    type: 'service',
    label: 'Service animal relief area',
    pattern: /\b(service\s+)?(animal|pet)\s+relief\b/i,
  },
  {
    key: 'family-restroom',
    type: 'service',
    label: 'Family / companion care restroom',
    pattern: /\b(family|companion[-\s]care|all[-\s]gender|gender[-\s]neutral)\s+restrooms?\b/i,
  },
  {
    key: 'nursing-room',
    type: 'service',
    label: 'Nursing / lactation room',
    pattern: /\b(nursing|lactation|mamava)\b/i,
  },
  {
    key: 'sunflower-lanyard',
    type: 'service',
    label: 'Sunflower lanyard pickup',
    pattern: /\bsunflower\b/i,
  },
];

const GATE_PATTERN = /\bgates?\s+([A-Z]{0,2}\d{1,3}[A-Z]?)\b/i;
const TERMINAL_PATTERN = /\b(terminal\s+\d+|international\s+terminal|concourse\s+[A-Z]\b)/i;
const POST_SECURITY_PATTERN = /\b(post[-\s]security|after\s+(the\s+)?security|airside)\b/i;
const PRE_SECURITY_PATTERN = /\b(pre[-\s]security|before\s+(the\s+)?security|landside|outside\s+(the\s+)?terminal)\b/i;
const TIME = String.raw`\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)`;
const HOURS_PATTERN = new RegExp(String.raw`${TIME}\s*(?:–|—|-|to)\s*${TIME}|\b24\s*(?:hours|\/7)\b`, 'i');
const LOCATION_WORDS = /\b(gate|terminal|concourse|security|level|floor|near|located|across from|next to)\b/i;

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
}

/**
 * Matching sentences plus the one right after each: pages often say "There
 * are relief areas." and only then "One is post-security near Gate A2."
 */
function withFollowingSentence(sentences: string[], pattern: RegExp): string[] {
  const keep = new Set<number>();
  sentences.forEach((sentence, i) => {
    if (!pattern.test(sentence)) return;
    keep.add(i);
    if (i + 1 < sentences.length) keep.add(i + 1);
  });
  return [...keep].sort((a, b) => a - b).map((i) => sentences[i]);
}

/**
 * One draft per rule per page: if a page mentions relief areas in three
 * places, the reviewer sees one draft with all three excerpts and splits it
 * into separate places when approving. Under-splitting is safer than
 * inventing duplicates.
 */
export function extractDrafts(blocks: Block[]): DraftPlace[] {
  const drafts = new Map<string, DraftPlace>();

  for (const block of blocks) {
    const headingMatches = block.heading ? RULES.filter((rule) => rule.pattern.test(block.heading!)) : [];
    const sentences = splitSentences(block.text);

    // A section headed "Sensory Room" describes that one place; don't also
    // turn its "quiet area" sentence into a separate Quiet room draft.
    for (const rule of headingMatches.length > 0 ? headingMatches : RULES) {
      const matchedHeading = headingMatches.includes(rule);
      const relevant = matchedHeading ? sentences : withFollowingSentence(sentences, rule.pattern);
      if (!matchedHeading && relevant.length === 0) continue;

      // When the heading names the place, the whole section describes it;
      // otherwise only the sentences that mention it do.
      const excerpt = normalizeWhitespace(relevant.join(' ') || block.text).slice(0, 1200);
      const locationSentences = relevant.filter((s) => LOCATION_WORDS.test(s));
      const locationText = locationSentences.join(' ');

      const draft: DraftPlace = {
        key: rule.key,
        type: rule.type,
        name: matchedHeading ? normalizeWhitespace(block.heading!) : rule.label,
        hours: excerpt.match(HOURS_PATTERN)?.[0] ?? null,
        locationHint: locationText ? normalizeWhitespace(locationText).slice(0, 400) : null,
        gateHint: locationText.match(GATE_PATTERN)?.[1]?.toUpperCase() ?? null,
        terminalHint: locationText.match(TERMINAL_PATTERN)?.[1] ?? null,
        securitySide: POST_SECURITY_PATTERN.test(excerpt) ? 'post' : PRE_SECURITY_PATTERN.test(excerpt) ? 'pre' : null,
        excerpt,
      };

      const existing = drafts.get(rule.key);
      drafts.set(rule.key, existing ? mergeDrafts(existing, draft) : draft);
    }
  }

  return [...drafts.values()];
}

function mergeDrafts(a: DraftPlace, b: DraftPlace): DraftPlace {
  return {
    ...a,
    hours: a.hours ?? b.hours,
    locationHint: [a.locationHint, b.locationHint].filter(Boolean).join(' … ') || null,
    gateHint: a.gateHint ?? b.gateHint,
    terminalHint: a.terminalHint ?? b.terminalHint,
    securitySide: a.securitySide ?? b.securitySide,
    excerpt: `${a.excerpt}\n\n${b.excerpt}`.slice(0, 2400),
  };
}
