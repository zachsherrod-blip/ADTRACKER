import { NextRequest, NextResponse } from 'next/server';
import {
  getBrandById,
  getLatestSnapshotForBrand,
  getSnapshotsForBrand,
  getAdsForSnapshot,
} from '@/src/db/queries';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const brandId = parseInt(params.id, 10);
    if (isNaN(brandId)) {
      return NextResponse.json({ error: 'Invalid brand ID' }, { status: 400 });
    }

    const brand = await getBrandById(brandId);
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const latestSnapshot = await getLatestSnapshotForBrand(brandId);
    const snapshots = await getSnapshotsForBrand(brandId, 10);

    let ads: Awaited<ReturnType<typeof getAdsForSnapshot>> = [];
    if (latestSnapshot) {
      ads = await getAdsForSnapshot(latestSnapshot.id, 100);
    }

    // Parse platforms JSON
    const adsNormalized = ads.map((ad) => ({
      ...ad,
      platforms: ad.platforms ? (() => {
        try { return JSON.parse(ad.platforms!); } catch { return [ad.platforms]; }
      })() : [],
    }));

    return NextResponse.json({
      brand,
      latestSnapshot,
      snapshots: snapshots.map((s) => ({
        id: s.id,
        snapshotDate: s.snapshotDate,
        activeAdsCount: s.activeAdsCount,
        newAds7dCount: s.newAds7dCount,
        countMethod: s.countMethod,
        adCount: s._count.ads,
      })),
      ads: adsNormalized,
    });
  } catch (err) {
    console.error(`GET /api/brands/${params.id} error:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
