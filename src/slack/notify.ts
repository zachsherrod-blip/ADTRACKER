import axios from 'axios';
import { format } from 'date-fns';
import { getLatestRunSummary } from '../db/queries';
import type { ScrapeResult } from '../types';

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? '';
const UI_BASE = process.env.UI_BASE_URL ?? 'http://localhost:3000';

export async function postRunSummary(
  runId: number,
  results: ScrapeResult[],
  total: number,
  succeeded: number,
  failed: number
): Promise<void> {
  if (!WEBHOOK_URL) {
    console.warn('SLACK_WEBHOOK_URL not configured');
    return;
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  // Sort by active ads desc
  const sorted = [...results]
    .filter((r) => !r.error && r.activeAdsCount != null)
    .sort((a, b) => (b.activeAdsCount ?? 0) - (a.activeAdsCount ?? 0));

  const top10ActiveAds = sorted.slice(0, 10);

  const top10NewAds = [...results]
    .filter((r) => !r.error && (r.newAds7dCount ?? 0) > 0)
    .sort((a, b) => (b.newAds7dCount ?? 0) - (a.newAds7dCount ?? 0))
    .slice(0, 10);

  const failedResults = results.filter((r) => !!r.error).slice(0, 10);

  // Big movers (delta >= +20 active ads) — needs DB lookup
  const bigMovers = await findBigMovers(results);

  const blocks = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `✅ Ad Library Scrape — ${today}`,
      emoji: true,
    },
  });

  // Summary line
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Brands processed:* ${total}  |  *Success:* ${succeeded}  |  *Failed:* ${failed}\n<${UI_BASE}|View full results in UI>`,
    },
  });

  blocks.push({ type: 'divider' });

  // Top 10 by Active Ads
  if (top10ActiveAds.length > 0) {
    const lines = top10ActiveAds
      .map((r, i) => `${i + 1}. *${r.domain}* — ${r.activeAdsCount} active ads`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*🏆 Top 10 by Active Ads:*\n${lines}` },
    });
  }

  // Top 10 New Ads (7d)
  if (top10NewAds.length > 0) {
    const lines = top10NewAds
      .map((r, i) => `${i + 1}. *${r.domain}* — ${r.newAds7dCount} new ads (7d)`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*📈 Top 10 New Ads (7d):*\n${lines}` },
    });
  }

  blocks.push({ type: 'divider' });

  // Big movers
  if (bigMovers.length > 0) {
    const lines = bigMovers
      .slice(0, 10)
      .map(
        (r) =>
          `🚀 *${r.domain}* — +${r.delta} active ads (now ${r.current})`
      )
      .join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*🚀 Big Movers (delta ≥ +20):*\n${lines}` },
    });
  }

  // Brands with newAds7d >= 10 alerts
  const newAdsAlerts = results
    .filter((r) => (r.newAds7dCount ?? 0) >= 10)
    .slice(0, 10);
  if (newAdsAlerts.length > 0) {
    const lines = newAdsAlerts
      .map((r) => `⚡ *${r.domain}* — ${r.newAds7dCount} new ads in 7d`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*⚡ New Ads Surge (≥10 in 7d):*\n${lines}` },
    });
  }

  // Failed brands
  if (failedResults.length > 0) {
    const lines = failedResults
      .map((r) => `❌ *${r.domain}* — ${r.error?.slice(0, 60)}`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*❌ Failed Brands (${failed} total):*\n${lines}${
          failed > 10 ? `\n_...and ${failed - 10} more. See UI._` : ''
        }`,
      },
    });
  }

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Run ID: ${runId} | <${UI_BASE}/api/export/latest.csv|Download CSV>`,
      },
    ],
  });

  // Ensure message isn't too long — Slack has 50-block limit
  const payload = { blocks: blocks.slice(0, 50) };

  await axios.post(WEBHOOK_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });
}

interface BigMover {
  domain: string;
  brandId: number;
  delta: number;
  current: number;
}

async function findBigMovers(results: ScrapeResult[]): Promise<BigMover[]> {
  const { getBrandById, getSnapshotsForBrand } = await import('../db/queries');
  const movers: BigMover[] = [];

  for (const r of results) {
    if (r.error || r.activeAdsCount == null) continue;
    try {
      const snapshots = await getSnapshotsForBrand(r.brandId, 2);
      if (snapshots.length < 2) continue;
      const current = snapshots[0].activeAdsCount ?? 0;
      const prev = snapshots[1].activeAdsCount ?? 0;
      const delta = current - prev;
      if (delta >= 20) {
        movers.push({ domain: r.domain, brandId: r.brandId, delta, current });
      }
    } catch {}
  }

  return movers.sort((a, b) => b.delta - a.delta);
}
