#!/usr/bin/env tsx
/**
 * CLI scrape runner
 * Usage: npm run scrape -- --csv ./seed.csv
 */
import '../db/client'; // Initialize DB env vars first
import { loadCsv } from './csvLoader';
import { upsertBrand, createRun, finishRun } from '../db/queries';
import { runScrapeQueue } from '../scraper/queue';
import { postRunSummary } from '../slack/notify';
import { closeBrowser } from '../scraper/browser';
import type { ScrapeResult } from '../types';

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);

  const csvPath = getArg(args, '--csv') ?? process.env.CSV_PATH ?? './seed.csv';
  const limitArg = getArg(args, '--limit');
  const offsetArg = getArg(args, '--offset');
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  const offset = offsetArg ? parseInt(offsetArg, 10) : 0;

  console.log(`\n🚀 Ad Library Scraper starting`);
  console.log(`   CSV: ${csvPath}`);
  console.log(`   Concurrency: ${process.env.CONCURRENCY ?? 2}`);
  console.log(`   Headless: ${process.env.HEADLESS ?? 'true'}`);
  if (limit) console.log(`   Limit: ${limit} brands (offset ${offset})`);
  console.log();

  // 1. Load CSV
  let brands = loadCsv(csvPath);
  if (brands.length === 0) {
    console.error('No brands found in CSV. Exiting.');
    process.exit(1);
  }

  // Apply offset/limit for batch processing large CSVs (e.g. 75k rows)
  if (offset > 0 || limit) {
    brands = brands.slice(offset, limit ? offset + limit : undefined);
    console.log(`Processing slice: rows ${offset}–${offset + brands.length} (${brands.length} brands)`);
  }

  // 2. Upsert brands into DB and get their IDs
  console.log(`Upserting ${brands.length} brands into DB...`);
  const brandsWithIds = await Promise.all(
    brands.map(async (b) => {
      const dbBrand = await upsertBrand(b);
      return { ...b, id: dbBrand.id };
    })
  );

  // 3. Create run
  const run = await createRun(brands.length);
  console.log(`\n📋 Run #${run.id} created. Processing ${brands.length} brands...\n`);

  // 4. Run scrape queue
  const { succeeded, failed, results } = await runScrapeQueue(
    brandsWithIds,
    run.id,
    (done, total, result) => {
      const icon = result.error ? '❌' : '✅';
      const count = result.activeAdsCount != null ? ` | ${result.activeAdsCount} ads` : '';
      const adCount = result.ads.length > 0 ? ` (${result.ads.length} captured)` : '';
      console.log(
        `${icon} [${done}/${total}] ${result.domain}${count}${adCount}${
          result.error ? ` — ${result.error.slice(0, 80)}` : ''
        }`
      );
    }
  );

  // 5. Finish run
  await finishRun(run.id, succeeded, failed);

  console.log(`\n✅ Run #${run.id} complete`);
  console.log(`   Brands: ${brands.length} | Success: ${succeeded} | Failed: ${failed}`);

  // 6. Post Slack summary
  if (process.env.SLACK_WEBHOOK_URL) {
    console.log('\n📣 Posting Slack summary...');
    try {
      await postRunSummary(run.id, results, brands.length, succeeded, failed);
      console.log('Slack message sent.');
    } catch (e) {
      console.error('Slack post failed:', e);
    }
  } else {
    console.log('SLACK_WEBHOOK_URL not set — skipping Slack notification.');
  }

  await closeBrowser();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
