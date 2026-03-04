'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface BrandRow {
  id: number;
  brandName: string | null;
  domain: string;
  pageName: string | null;
  snapshotDate: string | null;
  activeAdsCount: number | null;
  newAds7dCount: number | null;
  countMethod: string | null;
  prevActiveAdsCount: number | null;
  deltaActiveAds: number | null;
  status: string;
}

interface SortConfig {
  key: string;
  dir: 'asc' | 'desc';
}

const SORT_LABELS: Record<string, string> = {
  brand_name: 'Brand',
  active_ads: 'Active Ads',
  new_ads_7d: 'New Ads 7d',
  delta: 'Delta',
  last_scraped: 'Last Scraped',
};

export default function Dashboard() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [q, setQ] = useState('');
  const [minActiveAds, setMinActiveAds] = useState('');
  const [minNewAds7d, setMinNewAds7d] = useState('');
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [countMethodFilter, setCountMethodFilter] = useState('');

  // Sort
  const [sort, setSort] = useState<SortConfig>({ key: 'brand_name', dir: 'asc' });

  // Run state
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q,
        min_active_ads: minActiveAds || '0',
        min_new_ads_7d: minNewAds7d || '0',
        only_failures: String(onlyFailures),
        count_method: countMethodFilter,
        sort_by: sort.key,
        sort_dir: sort.dir,
      });
      const res = await fetch(`/api/brands?${params.toString()}`);
      const data = await res.json();
      setBrands(data.brands ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [q, minActiveAds, minNewAds7d, onlyFailures, countMethodFilter, sort]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' }
    );
  }

  function SortIcon({ k }: { k: string }) {
    if (sort.key !== k) return <span style={{ color: 'var(--text-muted)' }}>↕</span>;
    return <span style={{ color: 'var(--accent)' }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  }

  async function triggerRun() {
    setRunning(true);
    setRunMsg('');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setRunMsg(data.message ?? 'Scrape started!');
    } catch (e) {
      setRunMsg(`Error: ${e}`);
    } finally {
      setRunning(false);
    }
  }

  function statusBadge(status: string) {
    if (status === 'ok') return <span className="badge-ok">ok</span>;
    if (status === 'error') return <span className="badge-error">error</span>;
    return <span className="badge-muted">{status}</span>;
  }

  function deltaCell(delta: number | null) {
    if (delta == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    if (delta > 0) return <span className="text-green-400 font-medium">+{delta}</span>;
    if (delta < 0) return <span className="text-red-400 font-medium">{delta}</span>;
    return <span style={{ color: 'var(--text-muted)' }}>0</span>;
  }

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ad Library Tracker</h1>
          <p style={{ color: 'var(--text-muted)' }} className="text-sm mt-0.5">
            {total} brand{total !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runMsg && (
            <span
              className="text-sm px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
            >
              {runMsg}
            </span>
          )}
          <button onClick={triggerRun} disabled={running} className="btn-primary">
            {running ? '⏳ Starting…' : '▶ Run Scrape'}
          </button>
          <a href="/api/export/latest.csv" className="btn-ghost">
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <input
            className="input col-span-2 md:col-span-1"
            placeholder="Search brand or domain…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            className="input"
            type="number"
            placeholder="Min active ads"
            value={minActiveAds}
            onChange={(e) => setMinActiveAds(e.target.value)}
          />
          <input
            className="input"
            type="number"
            placeholder="Min new ads (7d)"
            value={minNewAds7d}
            onChange={(e) => setMinNewAds7d(e.target.value)}
          />
          <select
            className="select"
            value={countMethodFilter}
            onChange={(e) => setCountMethodFilter(e.target.value)}
          >
            <option value="">All count methods</option>
            <option value="exact">Exact</option>
            <option value="estimated">Estimated</option>
            <option value="partial">Partial</option>
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={onlyFailures}
              onChange={(e) => setOnlyFailures(e.target.checked)}
              className="w-4 h-4"
            />
            Only failures
          </label>
        </div>
      </div>

      {/* Table */}
      {error && (
        <div
          className="rounded-lg p-4 mb-4 text-sm"
          style={{ background: '#2d1515', color: '#f87171', border: '1px solid #7f1d1d' }}
        >
          Error: {error}
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort('brand_name')}
              >
                Brand <SortIcon k="brand_name" />
              </th>
              <th>Domain</th>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort('active_ads')}
              >
                Active Ads <SortIcon k="active_ads" />
              </th>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort('new_ads_7d')}
              >
                New Ads (7d) <SortIcon k="new_ads_7d" />
              </th>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort('delta')}
              >
                Delta <SortIcon k="delta" />
              </th>
              <th>Method</th>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort('last_scraped')}
              >
                Last Scraped <SortIcon k="last_scraped" />
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  Loading…
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  No brands found. Run a scrape first or adjust filters.
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr key={brand.id}>
                  <td className="font-medium">
                    <Link
                      href={`/brands/${brand.id}`}
                      style={{ color: 'var(--accent)' }}
                      className="hover:underline"
                    >
                      {brand.brandName ?? brand.domain}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }} className="text-xs">
                    <a
                      href={`https://${brand.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {brand.domain}
                    </a>
                  </td>
                  <td className="font-semibold text-white">
                    {brand.activeAdsCount ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {brand.newAds7dCount != null ? (
                      <span style={{ color: 'var(--text)' }}>{brand.newAds7dCount}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>{deltaCell(brand.deltaActiveAds)}</td>
                  <td>
                    {brand.countMethod ? (
                      <span className="badge-muted">{brand.countMethod}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }} className="text-xs">
                    {brand.snapshotDate
                      ? format(new Date(brand.snapshotDate), 'MMM d, yyyy HH:mm')
                      : '—'}
                  </td>
                  <td>{statusBadge(brand.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Showing {brands.length} of {total} brands
      </div>
    </div>
  );
}
