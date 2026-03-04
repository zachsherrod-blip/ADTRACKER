'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';

interface Ad {
  id: number;
  adId: string | null;
  startDate: string | null;
  platforms: string[];
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
  destinationUrl: string | null;
  creativeType: string | null;
  creativeThumbUrl: string | null;
  creativeAssetUrl: string | null;
}

interface Snapshot {
  id: number;
  snapshotDate: string;
  activeAdsCount: number | null;
  newAds7dCount: number | null;
  countMethod: string | null;
  adCount: number;
}

interface Brand {
  id: number;
  brandName: string | null;
  domain: string;
  pageName: string | null;
  notes: string | null;
  createdAt: string;
}

interface BrandDetailData {
  brand: Brand;
  latestSnapshot: { id: number; activeAdsCount: number | null; newAds7dCount: number | null; snapshotDate: string } | null;
  snapshots: Snapshot[];
  ads: Ad[];
}

export default function BrandDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<BrandDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedAds, setExpandedAds] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/brands/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleExpand(adId: number) {
    setExpandedAds((prev) => {
      const next = new Set(prev);
      if (next.has(adId)) next.delete(adId);
      else next.add(adId);
      return next;
    });
  }

  function copyAllAdCopy() {
    if (!data) return;
    const text = data.ads
      .map((ad) => {
        const parts = [];
        if (ad.headline) parts.push(`HEADLINE: ${ad.headline}`);
        if (ad.primaryText) parts.push(`BODY: ${ad.primaryText}`);
        if (ad.description) parts.push(`DESC: ${ad.description}`);
        if (ad.cta) parts.push(`CTA: ${ad.cta}`);
        if (ad.destinationUrl) parts.push(`URL: ${ad.destinationUrl}`);
        return parts.join('\n');
      })
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadBrandCsv() {
    if (!data) return;
    const header = ['ad_id', 'start_date', 'platforms', 'primary_text', 'headline', 'description', 'cta', 'destination_url', 'creative_type', 'creative_thumb_url'];
    const rows = data.ads.map((ad) => [
      ad.adId ?? '',
      ad.startDate ? format(new Date(ad.startDate), 'yyyy-MM-dd') : '',
      ad.platforms.join('|'),
      ad.primaryText ?? '',
      ad.headline ?? '',
      ad.description ?? '',
      ad.cta ?? '',
      ad.destinationUrl ?? '',
      ad.creativeType ?? '',
      ad.creativeThumbUrl ?? '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.brand.domain}-ads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-[1400px] mx-auto" style={{ color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-8 max-w-[1400px] mx-auto">
        <div className="rounded-lg p-4" style={{ background: '#2d1515', color: '#f87171' }}>
          {error || 'Brand not found'}
        </div>
        <Link href="/" className="btn-ghost mt-4 inline-flex">← Back</Link>
      </div>
    );
  }

  const { brand, latestSnapshot, snapshots, ads } = data;

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/" style={{ color: 'var(--text-muted)' }} className="text-sm hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Brand header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {brand.brandName ?? brand.domain}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <a
              href={`https://${brand.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
              className="text-sm hover:underline"
            >
              {brand.domain} ↗
            </a>
            {brand.pageName && (
              <span style={{ color: 'var(--text-muted)' }} className="text-sm">
                Page: {brand.pageName}
              </span>
            )}
          </div>
          {brand.notes && (
            <p style={{ color: 'var(--text-muted)' }} className="text-sm mt-1">
              {brand.notes}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={copyAllAdCopy} className="btn-ghost">
            {copied ? '✓ Copied!' : '📋 Copy All Ad Copy'}
          </button>
          <button onClick={downloadBrandCsv} className="btn-primary">
            ↓ Download CSV
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }} className="text-xs uppercase tracking-wide mb-1">
            Active Ads
          </div>
          <div className="text-3xl font-bold text-white">
            {latestSnapshot?.activeAdsCount ?? '—'}
          </div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }} className="text-xs uppercase tracking-wide mb-1">
            New Ads (7d)
          </div>
          <div className="text-3xl font-bold text-white">
            {latestSnapshot?.newAds7dCount ?? '—'}
          </div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }} className="text-xs uppercase tracking-wide mb-1">
            Ads Captured
          </div>
          <div className="text-3xl font-bold text-white">{ads.length}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }} className="text-xs uppercase tracking-wide mb-1">
            Runs Tracked
          </div>
          <div className="text-3xl font-bold text-white">{snapshots.length}</div>
        </div>
      </div>

      {/* Trend table */}
      {snapshots.length > 1 && (
        <div className="card mb-6">
          <h2 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
            Historical Snapshots
          </h2>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Active Ads</th>
                  <th>New Ads (7d)</th>
                  <th>Method</th>
                  <th>Captured</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => {
                  const prev = snapshots[i + 1];
                  const delta =
                    prev?.activeAdsCount != null && s.activeAdsCount != null
                      ? s.activeAdsCount - prev.activeAdsCount
                      : null;
                  return (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-muted)' }} className="text-xs">
                        {format(new Date(s.snapshotDate), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="font-semibold text-white">
                        {s.activeAdsCount ?? '—'}
                        {delta != null && (
                          <span
                            className={`ml-2 text-xs ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'}`}
                          >
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </td>
                      <td>{s.newAds7dCount ?? '—'}</td>
                      <td>
                        {s.countMethod ? (
                          <span className="badge-muted">{s.countMethod}</span>
                        ) : '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.adCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ads table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white text-sm uppercase tracking-wide">
            Ads ({ads.length})
          </h2>
        </div>

        {ads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">
            No ads captured yet. Run a scrape first.
          </p>
        ) : (
          <div className="space-y-3">
            {ads.map((ad) => {
              const expanded = expandedAds.has(ad.id);
              return (
                <div
                  key={ad.id}
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    {ad.creativeThumbUrl && (
                      <div className="shrink-0">
                        <img
                          src={ad.creativeThumbUrl}
                          alt="Ad creative"
                          className="w-20 h-20 rounded-lg object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {ad.headline && (
                            <div className="font-semibold text-white text-sm mb-1">
                              {ad.headline}
                            </div>
                          )}
                          <div
                            className="text-sm"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {ad.primaryText
                              ? expanded
                                ? ad.primaryText
                                : ad.primaryText.slice(0, 150) +
                                  (ad.primaryText.length > 150 ? '…' : '')
                              : <em>No body copy</em>}
                          </div>
                          {ad.primaryText && ad.primaryText.length > 150 && (
                            <button
                              onClick={() => toggleExpand(ad.id)}
                              style={{ color: 'var(--accent)' }}
                              className="text-xs mt-1 hover:underline"
                            >
                              {expanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {ad.creativeType && (
                            <span className="badge-muted">{ad.creativeType}</span>
                          )}
                          {ad.cta && (
                            <span
                              className="badge text-xs"
                              style={{ background: 'var(--bg-input)', color: 'var(--text)' }}
                            >
                              {ad.cta}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {ad.startDate && (
                          <span>Started {format(new Date(ad.startDate), 'MMM d, yyyy')}</span>
                        )}
                        {ad.platforms.length > 0 && (
                          <span>{ad.platforms.join(', ')}</span>
                        )}
                        {ad.destinationUrl && (
                          <a
                            href={ad.destinationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)' }}
                            className="hover:underline truncate max-w-xs"
                          >
                            {ad.destinationUrl}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
