import { NextResponse } from 'next/server';
import prisma from '@/src/db/client';

export async function GET() {
  try {
    // Get latest run
    const latestRun = await prisma.run.findFirst({
      where: { status: 'completed' },
      orderBy: { startedAt: 'desc' },
    });

    if (!latestRun) {
      return NextResponse.json({ error: 'No completed runs found' }, { status: 404 });
    }

    // Get all snapshots + ads for latest run
    const snapshots = await prisma.brandSnapshot.findMany({
      where: { runId: latestRun.id },
      include: { brand: true, ads: true },
    });

    // Build CSV rows
    const header = [
      'brand_name',
      'domain',
      'page_name',
      'snapshot_date',
      'active_ads_count',
      'new_ads_7d_count',
      'count_method',
      'ad_id',
      'start_date',
      'platforms',
      'primary_text',
      'headline',
      'description',
      'cta',
      'destination_url',
      'creative_type',
      'creative_thumb_url',
    ];

    const rows: string[][] = [header];

    for (const snapshot of snapshots) {
      const base = [
        snapshot.brand.brandName ?? '',
        snapshot.brand.domain,
        snapshot.brand.pageName ?? '',
        snapshot.snapshotDate.toISOString(),
        String(snapshot.activeAdsCount ?? ''),
        String(snapshot.newAds7dCount ?? ''),
        snapshot.countMethod ?? '',
      ];

      if (snapshot.ads.length === 0) {
        rows.push([...base, '', '', '', '', '', '', '', '', '', '']);
      } else {
        for (const ad of snapshot.ads) {
          const platforms = ad.platforms
            ? (() => { try { return JSON.parse(ad.platforms).join('|'); } catch { return ad.platforms; } })()
            : '';
          rows.push([
            ...base,
            ad.adId ?? '',
            ad.startDate?.toISOString() ?? '',
            platforms,
            ad.primaryText ?? '',
            ad.headline ?? '',
            ad.description ?? '',
            ad.cta ?? '',
            ad.destinationUrl ?? '',
            ad.creativeType ?? '',
            ad.creativeThumbUrl ?? '',
          ]);
        }
      }
    }

    // Serialize CSV
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ad-library-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
