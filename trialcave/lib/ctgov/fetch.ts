import "server-only";

/**
 * ClinicalTrials.gov API v2 client (B8.1). Public, no key, JSON.
 * GET https://clinicaltrials.gov/api/v2/studies
 */

const BASE = "https://clinicaltrials.gov/api/v2/studies";
const REQUEST_DELAY_MS = 300;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

/** Raw study JSON — validated/normalized downstream. */
export type RawStudy = Record<string, unknown>;

export interface FetchTrialsOptions {
  condition?: string; // query.cond — blank = all conditions
  location?: string; // query.locn
  geoFilter?: string; // filter.geo, e.g. distance(42.36,-71.05,150mi)
  maxTrials: number;
  pageSize?: number;
  status?: string; // filter.overallStatus
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(params: URLSearchParams): Promise<{ studies: RawStudy[]; nextPageToken?: string; totalCount?: number }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`ClinicalTrials.gov returned ${res.status}`);
      const json = (await res.json()) as {
        studies?: RawStudy[];
        nextPageToken?: string;
        totalCount?: number;
      };
      return {
        studies: json.studies ?? [],
        nextPageToken: json.nextPageToken,
        totalCount: json.totalCount,
      };
    } catch (err) {
      clearTimeout(timer);
      if (attempt === MAX_RETRIES - 1) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  return { studies: [] };
}

function buildParams(opts: FetchTrialsOptions, useGeo: boolean, pageToken?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (opts.condition) p.set("query.cond", opts.condition);
  if (useGeo && opts.geoFilter) {
    p.set("filter.geo", opts.geoFilter);
  } else if (opts.location) {
    p.set("query.locn", opts.location);
  }
  p.set("filter.overallStatus", opts.status ?? "RECRUITING");
  p.set("pageSize", String(opts.pageSize ?? 100));
  p.set("countTotal", "true");
  if (pageToken) p.set("pageToken", pageToken);
  return p;
}

/**
 * Pages through results until the token runs out or maxTrials is reached (B8.2).
 * Returns the raw studies plus the reported total.
 */
export async function fetchTrials(
  opts: FetchTrialsOptions,
  useGeo = false,
): Promise<{ studies: RawStudy[]; totalCount: number }> {
  const studies: RawStudy[] = [];
  let pageToken: string | undefined;
  let totalCount = 0;

  while (studies.length < opts.maxTrials) {
    const params = buildParams(opts, useGeo, pageToken);
    const page = await fetchPage(params);
    if (page.totalCount !== undefined) totalCount = page.totalCount;
    studies.push(...page.studies);
    if (!page.nextPageToken || page.studies.length === 0) break;
    pageToken = page.nextPageToken;
    await sleep(REQUEST_DELAY_MS);
  }

  return { studies: studies.slice(0, opts.maxTrials), totalCount };
}

/** Fetch a single study by NCT id (used for NCT import and status refresh). */
export async function fetchStudy(nctId: string): Promise<RawStudy | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(nctId)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as RawStudy;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
