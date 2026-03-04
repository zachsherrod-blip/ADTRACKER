import type { ScrapedAd } from '../types';

/**
 * Parses ads from Meta Ad Library network JSON responses.
 * Meta uses GraphQL – the response shape varies but key paths are consistent.
 */
export function parseAdsFromGraphQL(jsonBody: unknown): ScrapedAd[] {
  if (!jsonBody || typeof jsonBody !== 'object') return [];

  const ads: ScrapedAd[] = [];

  // Walk the object tree looking for ad nodes
  walkObject(jsonBody as Record<string, unknown>, (node) => {
    const ad = tryParseAdNode(node);
    if (ad) ads.push(ad);
  });

  return ads;
}

/**
 * Try to parse a single ad node from Meta's Ad Library GraphQL response.
 * Handles multiple known response shapes.
 */
function tryParseAdNode(node: Record<string, unknown>): ScrapedAd | null {
  // Must have an ad_archive_id or id to be considered an ad node
  const adId =
    safeStr(node['ad_archive_id']) ??
    safeStr(node['adArchiveID']) ??
    safeStr(node['id']);

  if (!adId) return null;

  // Snap dates
  const startDate = parseAdDate(
    node['ad_delivery_start_time'] ??
    node['startDate'] ??
    node['start_date']
  );

  // Platforms
  const platforms = parsePlatforms(
    node['publisher_platforms'] ??
    node['publisherPlatforms'] ??
    node['platforms']
  );

  // Creative snapshot
  const snapshot = (node['snapshot'] as Record<string, unknown>) ?? node;

  const primaryText =
    safeStr(snapshot['body']?.toString()) ??
    extractNestedStr(snapshot, ['body', 'text']) ??
    extractNestedStr(snapshot, ['bodies', '0', 'text']) ??
    safeStr(node['ad_creative_bodies']?.toString()) ??
    extractFirstFromArray(node['ad_creative_bodies']) ??
    null;

  const headline =
    extractNestedStr(snapshot, ['title']) ??
    extractNestedStr(snapshot, ['titles', '0', 'text']) ??
    safeStr(node['ad_creative_link_titles']?.toString()) ??
    extractFirstFromArray(node['ad_creative_link_titles']) ??
    null;

  const description =
    extractNestedStr(snapshot, ['caption']) ??
    extractNestedStr(snapshot, ['link_description']) ??
    safeStr(node['ad_creative_link_descriptions']?.toString()) ??
    extractFirstFromArray(node['ad_creative_link_descriptions']) ??
    null;

  const cta =
    extractNestedStr(snapshot, ['cta_text']) ??
    extractNestedStr(snapshot, ['cta', 'text']) ??
    null;

  const destinationUrl =
    safeStr(node['ad_creative_link_url']) ??
    extractNestedStr(snapshot, ['link_url']) ??
    extractNestedStr(snapshot, ['landing_page_url']) ??
    extractNestedStr(snapshot, ['cta', 'value', 'link', 'url']) ??
    null;

  // Creative
  const { creativeType, creativeThumbUrl, creativeAssetUrl } =
    parseCreative(snapshot, node);

  return {
    adId,
    startDate: startDate ?? undefined,
    platforms: platforms.length > 0 ? platforms : undefined,
    primaryText: primaryText ?? undefined,
    headline: headline ?? undefined,
    description: description ?? undefined,
    cta: cta ?? undefined,
    destinationUrl: destinationUrl ?? undefined,
    creativeType: creativeType ?? undefined,
    creativeThumbUrl: creativeThumbUrl ?? undefined,
    creativeAssetUrl: creativeAssetUrl ?? undefined,
    raw: node as Record<string, unknown>,
  };
}

function parseCreative(
  snapshot: Record<string, unknown>,
  node: Record<string, unknown>
): {
  creativeType?: string;
  creativeThumbUrl?: string;
  creativeAssetUrl?: string;
} {
  // Try videos first
  const videos =
    (snapshot['videos'] as unknown[]) ??
    (snapshot['video'] ? [snapshot['video']] : null);
  if (Array.isArray(videos) && videos.length > 0) {
    const v = videos[0] as Record<string, unknown>;
    return {
      creativeType: 'video',
      creativeThumbUrl:
        safeStr(v['video_preview_image_url']) ??
        safeStr(v['thumbnailUrl']) ??
        undefined,
      creativeAssetUrl:
        safeStr(v['video_hd_url']) ??
        safeStr(v['video_sd_url']) ??
        safeStr(v['videoUrl']) ??
        undefined,
    };
  }

  // Images
  const images =
    (snapshot['images'] as unknown[]) ??
    (snapshot['image'] ? [snapshot['image']] : null);
  if (Array.isArray(images) && images.length > 0) {
    const img = images[0] as Record<string, unknown>;
    return {
      creativeType: 'image',
      creativeThumbUrl:
        safeStr(img['resized_image_url']) ??
        safeStr(img['url']) ??
        safeStr(img['original_image_url']) ??
        undefined,
      creativeAssetUrl:
        safeStr(img['original_image_url']) ?? safeStr(img['url']) ?? undefined,
    };
  }

  // Carousel
  const cards =
    (snapshot['cards'] as unknown[]) ?? (node['cards'] as unknown[]);
  if (Array.isArray(cards) && cards.length > 0) {
    const first = cards[0] as Record<string, unknown>;
    return {
      creativeType: 'carousel',
      creativeThumbUrl:
        safeStr(first['resized_image_url']) ??
        safeStr(first['original_image_url']) ??
        undefined,
    };
  }

  return {};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeStr(val: unknown): string | null {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  return null;
}

function extractNestedStr(
  obj: Record<string, unknown>,
  path: string[]
): string | null {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return safeStr(cur);
}

function extractFirstFromArray(val: unknown): string | null {
  if (Array.isArray(val) && val.length > 0) return safeStr(val[0]);
  return null;
}

function parseAdDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === 'number') return new Date(val * 1000);
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    const ts = parseInt(val, 10);
    if (!isNaN(ts)) return new Date(ts * 1000);
  }
  return null;
}

function parsePlatforms(val: unknown): string[] {
  if (Array.isArray(val))
    return val.filter((v) => typeof v === 'string') as string[];
  if (typeof val === 'string') return [val];
  return [];
}

/**
 * Walk an object tree and call the visitor for every object node that
 * looks like it could be an ad (has ad_archive_id or similar).
 */
function walkObject(
  obj: Record<string, unknown>,
  visitor: (node: Record<string, unknown>) => void,
  depth = 0
): void {
  if (depth > 12) return;
  visitor(obj);
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            walkObject(item as Record<string, unknown>, visitor, depth + 1);
          }
        }
      } else {
        walkObject(val as Record<string, unknown>, visitor, depth + 1);
      }
    }
  }
}

/**
 * Extract total ad count from a GraphQL response.
 * Meta typically returns: { total_count: N } or paging info.
 */
export function extractTotalCount(
  jsonBody: unknown
): { count: number; method: 'exact' | 'estimated' | 'partial' } | null {
  if (!jsonBody || typeof jsonBody !== 'object') return null;

  let found: number | null = null;
  let method: 'exact' | 'estimated' | 'partial' = 'partial';

  walkObject(jsonBody as Record<string, unknown>, (node) => {
    if (found !== null) return;

    const tc =
      node['total_count'] ??
      node['totalCount'] ??
      node['count'] ??
      node['total'];

    if (typeof tc === 'number' && tc >= 0) {
      found = tc;
      method = 'exact';
    }

    // Paging cursor can tell us "there are more" – use partial
    if (!found && node['page_info']) {
      const pi = node['page_info'] as Record<string, unknown>;
      if (pi['has_next_page']) method = 'partial';
    }
  });

  return found !== null ? { count: found, method } : null;
}
