import prisma from './client';
import type { NormalizedBrand, ScrapeResult } from '../types';

// ─── Brands ──────────────────────────────────────────────────────────────────

export async function upsertBrand(brand: NormalizedBrand) {
  return prisma.brand.upsert({
    where: { domain: brand.domain },
    update: {
      brandName: brand.brandName,
      pageName: brand.pageName ?? null,
      notes: brand.notes ?? null,
    },
    create: {
      domain: brand.domain,
      brandName: brand.brandName,
      pageName: brand.pageName ?? null,
      notes: brand.notes ?? null,
    },
  });
}

export async function getAllBrands() {
  return prisma.brand.findMany({ orderBy: { brandName: 'asc' } });
}

export async function getBrandById(id: number) {
  return prisma.brand.findUnique({ where: { id } });
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export async function createRun(totalBrands: number) {
  return prisma.run.create({
    data: { totalBrands, status: 'running' },
  });
}

export async function finishRun(
  runId: number,
  succeeded: number,
  failed: number,
  status: 'completed' | 'failed' = 'completed'
) {
  return prisma.run.update({
    where: { id: runId },
    data: { finishedAt: new Date(), status, succeeded, failed },
  });
}

export async function getLatestRun() {
  return prisma.run.findFirst({ orderBy: { startedAt: 'desc' } });
}

export async function getAllRuns() {
  return prisma.run.findMany({ orderBy: { startedAt: 'desc' }, take: 50 });
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

export async function saveSnapshot(result: ScrapeResult, runId: number) {
  const snapshot = await prisma.brandSnapshot.create({
    data: {
      brandId: result.brandId,
      runId,
      snapshotDate: new Date(),
      activeAdsCount: result.activeAdsCount ?? null,
      newAds7dCount: result.newAds7dCount ?? null,
      countMethod: result.countMethod ?? null,
      queryUsed: result.searchQuery,
      sourceUrl: result.sourceUrl ?? null,
    },
  });

  // Save ads
  if (result.ads.length > 0) {
    await prisma.ad.createMany({
      data: result.ads.map((ad) => ({
        brandSnapshotId: snapshot.id,
        adId: ad.adId ?? null,
        startDate: ad.startDate ?? null,
        platforms: ad.platforms ? JSON.stringify(ad.platforms) : null,
        primaryText: ad.primaryText ?? null,
        headline: ad.headline ?? null,
        description: ad.description ?? null,
        cta: ad.cta ?? null,
        destinationUrl: ad.destinationUrl ?? null,
        creativeType: ad.creativeType ?? null,
        creativeThumbUrl: ad.creativeThumbUrl ?? null,
        creativeAssetUrl: ad.creativeAssetUrl ?? null,
        rawJson: ad.raw ? JSON.stringify(ad.raw) : null,
      })),
    });
  }

  return snapshot;
}

export async function getLatestSnapshotForBrand(brandId: number) {
  return prisma.brandSnapshot.findFirst({
    where: { brandId },
    orderBy: { snapshotDate: 'desc' },
    include: { ads: true },
  });
}

export async function getSnapshotsForBrand(brandId: number, limit = 10) {
  return prisma.brandSnapshot.findMany({
    where: { brandId },
    orderBy: { snapshotDate: 'desc' },
    take: limit,
    include: { _count: { select: { ads: true } } },
  });
}

export async function getAdsForSnapshot(snapshotId: number, limit = 100) {
  return prisma.ad.findMany({
    where: { brandSnapshotId: snapshotId },
    take: limit,
    orderBy: { startDate: 'desc' },
  });
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export async function saveScrapeError(
  brandId: number,
  runId: number,
  stage: string,
  error: Error | string
) {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;
  return prisma.scrapeError.create({
    data: { brandId, runId, stage, errorMessage: msg, stack },
  });
}

// ─── Dashboard queries ────────────────────────────────────────────────────────

export interface BrandWithStats {
  id: number;
  brandName: string | null;
  domain: string;
  pageName: string | null;
  notes: string | null;
  snapshotId: number | null;
  snapshotDate: Date | null;
  activeAdsCount: number | null;
  newAds7dCount: number | null;
  countMethod: string | null;
  prevActiveAdsCount: number | null;
  deltaActiveAds: number | null;
  status: string;
}

export async function getBrandsWithLatestStats(): Promise<BrandWithStats[]> {
  // Raw SQL for efficiency – get each brand's latest snapshot + previous
  const rows = await prisma.$queryRaw<BrandWithStats[]>`
    WITH ranked AS (
      SELECT
        bs.*,
        ROW_NUMBER() OVER (PARTITION BY bs.brand_id ORDER BY bs.snapshot_date DESC) AS rn
      FROM brand_snapshots bs
    ),
    latest AS (SELECT * FROM ranked WHERE rn = 1),
    prev   AS (SELECT * FROM ranked WHERE rn = 2)
    SELECT
      b.id,
      b.brand_name        AS brandName,
      b.domain,
      b.page_name         AS pageName,
      b.notes,
      l.id                AS snapshotId,
      l.snapshot_date     AS snapshotDate,
      l.active_ads_count  AS activeAdsCount,
      l.new_ads_7d_count  AS newAds7dCount,
      l.count_method      AS countMethod,
      p.active_ads_count  AS prevActiveAdsCount,
      (l.active_ads_count - p.active_ads_count) AS deltaActiveAds,
      CASE
        WHEN l.id IS NULL THEN 'never_scraped'
        WHEN se.id IS NOT NULL THEN 'error'
        ELSE 'ok'
      END AS status
    FROM brands b
    LEFT JOIN latest l ON l.brand_id = b.id
    LEFT JOIN prev   p ON p.brand_id = b.id
    LEFT JOIN (
      SELECT brand_id, MAX(id) AS id
      FROM scrape_errors
      GROUP BY brand_id
    ) se ON se.brand_id = b.id AND l.id IS NULL
    ORDER BY b.brand_name ASC
  `;
  return rows;
}

export async function getLatestRunSummary() {
  const run = await prisma.run.findFirst({
    orderBy: { startedAt: 'desc' },
    where: { status: 'completed' },
  });
  if (!run) return null;

  const snapshots = await prisma.brandSnapshot.findMany({
    where: { runId: run.id },
    orderBy: { activeAdsCount: 'desc' },
    include: { brand: true },
    take: 50,
  });

  const errors = await prisma.scrapeError.findMany({
    where: { runId: run.id },
    include: { brand: true },
    take: 20,
  });

  return { run, snapshots, errors };
}
