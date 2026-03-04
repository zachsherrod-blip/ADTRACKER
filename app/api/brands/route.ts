import { NextRequest, NextResponse } from 'next/server';
import { getBrandsWithLatestStats } from '@/src/db/queries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = searchParams.get('q')?.toLowerCase() ?? '';
    const minActiveAds = parseInt(searchParams.get('min_active_ads') ?? '0', 10);
    const minNewAds7d = parseInt(searchParams.get('min_new_ads_7d') ?? '0', 10);
    const onlyFailures = searchParams.get('only_failures') === 'true';
    const countMethod = searchParams.get('count_method') ?? '';
    const sortBy = searchParams.get('sort_by') ?? 'brand_name';
    const sortDir = searchParams.get('sort_dir') ?? 'asc';

    let brands = await getBrandsWithLatestStats();

    // Filter
    if (q) {
      brands = brands.filter(
        (b) =>
          b.domain?.toLowerCase().includes(q) ||
          (b.brandName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (minActiveAds > 0) {
      brands = brands.filter((b) => (b.activeAdsCount ?? 0) >= minActiveAds);
    }
    if (minNewAds7d > 0) {
      brands = brands.filter((b) => (b.newAds7dCount ?? 0) >= minNewAds7d);
    }
    if (onlyFailures) {
      brands = brands.filter((b) => b.status === 'error' || b.status === 'never_scraped');
    }
    if (countMethod) {
      brands = brands.filter((b) => b.countMethod === countMethod);
    }

    // Sort
    brands.sort((a, b) => {
      let va: unknown, vb: unknown;
      switch (sortBy) {
        case 'active_ads':
          va = a.activeAdsCount ?? -1;
          vb = b.activeAdsCount ?? -1;
          break;
        case 'new_ads_7d':
          va = a.newAds7dCount ?? -1;
          vb = b.newAds7dCount ?? -1;
          break;
        case 'delta':
          va = a.deltaActiveAds ?? -999;
          vb = b.deltaActiveAds ?? -999;
          break;
        case 'last_scraped':
          va = a.snapshotDate?.toString() ?? '';
          vb = b.snapshotDate?.toString() ?? '';
          break;
        default:
          va = a.brandName ?? a.domain;
          vb = b.brandName ?? b.domain;
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'desc' ? vb - va : va - vb;
      }
      const sa = String(va ?? '');
      const sb = String(vb ?? '');
      return sortDir === 'desc' ? sb.localeCompare(sa) : sa.localeCompare(sb);
    });

    return NextResponse.json({ brands, total: brands.length });
  } catch (err) {
    console.error('GET /api/brands error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
