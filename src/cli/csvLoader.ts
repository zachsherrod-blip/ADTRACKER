import fs from 'fs';
import Papa from 'papaparse';
import type { CsvRow, NormalizedBrand } from '../types';

/**
 * Column name aliases – maps any known column name variant to canonical form.
 * This makes the CSV flexible enough to handle the "BROAD ICP list" format
 * or any other naming convention.
 */
const COLUMN_ALIASES: Record<string, keyof CsvRow> = {
  // domain variants
  domain: 'domain',
  website: 'domain',
  url: 'domain',
  site: 'domain',
  company_website: 'domain',
  'company website': 'domain',
  homepage: 'domain',

  // brand name variants — including BROAD ICP list "merchant_name"
  brand_name: 'brand_name',
  brand: 'brand_name',
  company: 'brand_name',
  company_name: 'brand_name',
  'company name': 'brand_name',
  name: 'brand_name',
  advertiser: 'brand_name',
  account_name: 'brand_name',
  merchant_name: 'brand_name',   // BROAD ICP list column
  merchant: 'brand_name',
  store_name: 'brand_name',

  // page name variants
  page_name: 'page_name',
  facebook_page: 'page_name',
  'facebook page': 'page_name',
  fb_page: 'page_name',
  page: 'page_name',
  meta_page: 'page_name',

  // notes — BROAD ICP list fields land here
  notes: 'notes',
  note: 'notes',
  comment: 'notes',
  description: 'notes',
  tags: 'notes',
  linkedin_url: 'notes',         // BROAD ICP list — stored for reference
  combined_followers: 'notes',   // BROAD ICP list — stored but not used for search
};

export function loadCsv(filePath: string): NormalizedBrand[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, errors } = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0) {
    console.warn(`CSV parse warnings:`, errors.slice(0, 5));
  }

  const brands: NormalizedBrand[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const rawRow = data[i];

    // Normalize column names
    const row: CsvRow = {};
    for (const [key, val] of Object.entries(rawRow)) {
      const normalized = key.toLowerCase().trim().replace(/\s+/g, '_');
      const canonical = COLUMN_ALIASES[normalized] ?? COLUMN_ALIASES[key.toLowerCase().trim()];
      if (canonical) {
        row[canonical] = val?.trim() ?? '';
      } else {
        // Keep unknown columns for fallback domain detection
        row[key] = val?.trim() ?? '';
      }
    }

    // Try to extract domain
    let domain = row['domain'] ?? '';

    // Fallback: scan all values for something that looks like a domain/URL
    if (!domain) {
      for (const val of Object.values(row)) {
        if (val && looksLikeDomain(val)) {
          domain = val;
          break;
        }
      }
    }

    if (!domain) {
      console.warn(`Row ${i + 1}: no domain found, skipping. Row: ${JSON.stringify(rawRow)}`);
      continue;
    }

    domain = normalizeDomain(domain);

    if (seen.has(domain)) {
      console.warn(`Row ${i + 1}: duplicate domain ${domain}, skipping.`);
      continue;
    }
    seen.add(domain);

    const brandName =
      (row['brand_name'] ?? '').trim() ||
      inferBrandName(domain);

    const pageName = (row['page_name'] ?? '').trim() || undefined;
    const notes = (row['notes'] ?? '').trim() || undefined;

    const searchQuery = pageName ?? brandName;

    brands.push({ brandName, domain, pageName, notes, searchQuery });
  }

  console.log(`Loaded ${brands.length} brands from ${filePath}`);
  return brands;
}

function looksLikeDomain(val: string): boolean {
  return /^(https?:\/\/)?[a-z0-9-]+\.[a-z]{2,}(\/.*)?$/i.test(val.trim());
}

export function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0];
  d = d.split('?')[0];
  return d;
}

export function inferBrandName(domain: string): string {
  // Strip TLD, replace hyphens/underscores with spaces, title-case
  const withoutTld = domain.replace(/\.[^.]+$/, '');
  const withoutSub = withoutTld.replace(/^www\./, '');
  return withoutSub
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
