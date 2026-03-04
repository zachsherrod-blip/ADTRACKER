import pLimit from 'p-limit';
import pRetry from 'p-retry';
import type { NormalizedBrand, ScrapeResult } from '../types';
import { scrapeBrand } from './adLibrary';
import { saveSnapshot, saveScrapeError } from '../db/queries';

const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? '2', 10);
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS ?? '2500', 10);
const MAX_RETRIES = 3;

function jitteredDelay(): number {
  return REQUEST_DELAY_MS + Math.random() * REQUEST_DELAY_MS * 0.6;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface QueueResult {
  succeeded: number;
  failed: number;
  results: ScrapeResult[];
}

export async function runScrapeQueue(
  brands: Array<{ id: number } & NormalizedBrand>,
  runId: number,
  onProgress?: (done: number, total: number, result: ScrapeResult) => void
): Promise<QueueResult> {
  const limit = pLimit(CONCURRENCY);
  let done = 0;
  let succeeded = 0;
  let failed = 0;
  const results: ScrapeResult[] = [];

  const tasks = brands.map((brand) =>
    limit(async () => {
      // Jittered delay between requests
      await sleep(jitteredDelay());

      let result: ScrapeResult;

      try {
        result = await pRetry(
          () =>
            scrapeBrand(brand.id, brand.domain, brand.searchQuery),
          {
            retries: MAX_RETRIES,
            onFailedAttempt: async (err) => {
              console.warn(
                `[${brand.domain}] attempt ${err.attemptNumber} failed: ${err.message}. Retrying in ${err.retriesLeft} retries...`
              );
              // Exponential backoff
              await sleep(Math.pow(2, err.attemptNumber) * 1000);
            },
          }
        );
      } catch (err) {
        // All retries exhausted
        const errMsg = err instanceof Error ? err.message : String(err);
        result = {
          brandId: brand.id,
          domain: brand.domain,
          searchQuery: brand.searchQuery,
          ads: [],
          error: errMsg,
          stack: err instanceof Error ? err.stack : undefined,
        };
      }

      // Persist to DB
      if (!result.error) {
        try {
          await saveSnapshot(result, runId);
          succeeded++;
        } catch (dbErr) {
          console.error(`[${brand.domain}] DB save error:`, dbErr);
          result.error = `DB save failed: ${dbErr}`;
          failed++;
          await saveScrapeError(brand.id, runId, 'db_save', dbErr as Error).catch(() => null);
        }
      } else {
        failed++;
        await saveScrapeError(brand.id, runId, 'scrape', result.error).catch(() => null);
      }

      done++;
      results.push(result);
      onProgress?.(done, brands.length, result);

      return result;
    })
  );

  await Promise.all(tasks);

  return { succeeded, failed, results };
}
