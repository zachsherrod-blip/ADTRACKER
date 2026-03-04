export interface CsvRow {
  brand_name?: string;
  domain?: string;
  page_name?: string;
  notes?: string;
  // Support alternate column names from the BROAD ICP list
  [key: string]: string | undefined;
}

export interface NormalizedBrand {
  brandName: string;
  domain: string;
  pageName?: string;
  notes?: string;
  searchQuery: string;
}

export interface ScrapedAd {
  adId?: string;
  startDate?: Date;
  platforms?: string[];
  primaryText?: string;
  headline?: string;
  description?: string;
  cta?: string;
  destinationUrl?: string;
  creativeType?: 'image' | 'video' | 'carousel' | string;
  creativeThumbUrl?: string;
  creativeAssetUrl?: string;
  raw?: Record<string, unknown>;
}

export interface ScrapeResult {
  brandId: number;
  domain: string;
  searchQuery: string;
  sourceUrl?: string;
  activeAdsCount?: number;
  newAds7dCount?: number;
  countMethod?: 'exact' | 'estimated' | 'partial';
  ads: ScrapedAd[];
  error?: string;
  stack?: string;
}

export interface RunStats {
  runId: number;
  total: number;
  succeeded: number;
  failed: number;
}

export interface BrandRow {
  id: number;
  brandName: string | null;
  domain: string;
  pageName: string | null;
  notes: string | null;
  latestSnapshotDate?: string;
  activeAdsCount?: number | null;
  newAds7dCount?: number | null;
  countMethod?: string | null;
  prevActiveAdsCount?: number | null;
  deltaActiveAds?: number | null;
  status?: string;
}

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: unknown[];
}
