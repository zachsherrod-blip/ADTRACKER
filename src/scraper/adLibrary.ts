import type { BrowserContext, Page, Response } from 'playwright';
import { newContext, newPage } from './browser';
import { parseAdsFromGraphQL, extractTotalCount } from './parseAds';
import type { ScrapeResult, ScrapedAd } from '../types';

const MAX_ADS = parseInt(process.env.MAX_ADS_PER_BRAND ?? '25', 10);

const AD_LIBRARY_BASE =
  'https://www.facebook.com/ads/library/';

/**
 * Main scrape function for a single brand.
 */
export async function scrapeBrand(
  brandId: number,
  domain: string,
  searchQuery: string
): Promise<ScrapeResult> {
  const ctx = await newContext();
  const result: ScrapeResult = {
    brandId,
    domain,
    searchQuery,
    ads: [],
  };

  try {
    const page = await newPage(ctx);
    const { ads, activeAdsCount, newAds7dCount, countMethod, sourceUrl } =
      await scrapeAdLibrary(page, searchQuery);

    result.ads = ads;
    result.activeAdsCount = activeAdsCount;
    result.newAds7dCount = newAds7dCount;
    result.countMethod = countMethod;
    result.sourceUrl = sourceUrl;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.stack = err instanceof Error ? err.stack : undefined;
  } finally {
    await ctx.close();
  }

  return result;
}

interface LibraryResult {
  ads: ScrapedAd[];
  activeAdsCount?: number;
  newAds7dCount?: number;
  countMethod?: 'exact' | 'estimated' | 'partial';
  sourceUrl?: string;
}

async function scrapeAdLibrary(
  page: Page,
  searchQuery: string
): Promise<LibraryResult> {
  const capturedResponses: unknown[] = [];

  // Intercept Ad Library API / GraphQL responses
  page.on('response', async (resp: Response) => {
    const url = resp.url();
    if (
      url.includes('graphql') ||
      url.includes('ads/archive') ||
      url.includes('api/graphql') ||
      url.includes('ads_library_search') ||
      url.includes('ads_library')
    ) {
      try {
        const ct = resp.headers()['content-type'] ?? '';
        if (ct.includes('json')) {
          const body = await resp.json().catch(() => null);
          if (body) capturedResponses.push(body);
        } else if (ct.includes('text')) {
          const text = await resp.text().catch(() => '');
          // Some endpoints return JSON as text
          if (text.startsWith('{') || text.startsWith('[')) {
            try {
              capturedResponses.push(JSON.parse(text));
            } catch {}
          }
        }
      } catch {}
    }
  });

  // Build URL with search params
  const url = buildSearchUrl(searchQuery);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

  // Wait for ads to load
  await page
    .waitForSelector('[data-testid="ad-card"], [class*="adCard"], [role="article"]', {
      timeout: 15000,
    })
    .catch(() => null);

  // Scroll to trigger more loads
  await autoScroll(page, 3);

  // Wait for any pending network requests
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

  // Also try to extract count from DOM as fallback
  const domCount = await extractCountFromDOM(page);

  // Parse all captured JSON responses
  const allAds: ScrapedAd[] = [];
  const seenIds = new Set<string>();
  let totalCount: number | undefined;
  let countMethod: 'exact' | 'estimated' | 'partial' = 'partial';

  for (const body of capturedResponses) {
    const countInfo = extractTotalCount(body);
    if (countInfo && (totalCount === undefined || countInfo.count > (totalCount ?? 0))) {
      totalCount = countInfo.count;
      countMethod = countInfo.method;
    }

    const ads = parseAdsFromGraphQL(body);
    for (const ad of ads) {
      const key = ad.adId ?? `${ad.startDate?.getTime()}-${ad.primaryText?.slice(0, 20)}`;
      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        allAds.push(ad);
      }
      if (allAds.length >= MAX_ADS) break;
    }
    if (allAds.length >= MAX_ADS) break;
  }

  // Use DOM count as fallback
  if (totalCount === undefined && domCount !== null) {
    totalCount = domCount;
    countMethod = 'estimated';
  }

  // If we still have no count but have ads, use ads length as partial
  if (totalCount === undefined && allAds.length > 0) {
    totalCount = allAds.length;
    countMethod = 'partial';
  }

  return {
    ads: allAds.slice(0, MAX_ADS),
    activeAdsCount: totalCount,
    countMethod,
    sourceUrl: url,
  };
}

function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: 'ALL',
    q: query,
    search_type: 'keyword_unordered',
    media_type: 'all',
  });
  return `${AD_LIBRARY_BASE}?${params.toString()}`;
}

async function extractCountFromDOM(page: Page): Promise<number | null> {
  try {
    // Meta shows something like "X active ads" or "Showing X ads"
    const text = await page.evaluate(() => {
      const selectors = [
        '[data-testid="search-result-count"]',
        '[class*="resultCount"]',
        '[class*="result-count"]',
        'span[class*="x1lliihq"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.textContent) return el.textContent;
      }
      // Broader search for text containing number + "ads"
      const spans = document.querySelectorAll('span');
      for (const span of spans) {
        const t = span.textContent ?? '';
        if (/\d[\d,]*\s+(active\s+)?ads?/i.test(t)) return t;
      }
      return null;
    });

    if (text) {
      const match = text.match(/([\d,]+)/);
      if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    }
  } catch {}
  return null;
}

async function autoScroll(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await page.waitForTimeout(1500 + Math.random() * 1000);
  }
  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
}
