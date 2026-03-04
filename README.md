# AdTracker — Meta Ad Library Scraper + UI

Track Meta Ad Library ad counts, ad copy, and creatives across thousands of brands.
Stores historical snapshots in SQLite, surfaces results in a searchable table UI, and posts daily Slack summaries.

---

## Quick Start (one command)

```bash
cp .env.example .env        # fill in SLACK_WEBHOOK_URL at minimum
npm install
npx playwright install chromium
npx prisma db push          # creates the SQLite database
npm run all -- --csv ./BROAD_ICP_list.csv
```

Then open **http://localhost:3000**

---

## Individual Commands

| Command | Description |
|---|---|
| `npm run scrape -- --csv ./seed.csv` | Scrape all brands in CSV |
| `npm run scrape:headless -- --csv ./BROAD_ICP_list.csv` | Headless scrape (faster) |
| `npm run ui` | Start the UI only (dev mode) |
| `npm run all -- --csv ./seed.csv` | Scrape then start UI |
| `npm run db:push` | Apply schema to SQLite |
| `npm run db:studio` | Open Prisma Studio (DB browser) |

### Batch processing large CSVs (75k+ rows)

The included `BROAD_ICP_list.csv` has ~75,900 domains. At 2 concurrent scrapes with 2.5s delay, a full run takes ~26 hours. Use `--limit` and `--offset` to process in batches:

```bash
# Batch 1: first 500 brands
npm run scrape -- --csv ./BROAD_ICP_list.csv --limit 500 --offset 0

# Batch 2: next 500
npm run scrape -- --csv ./BROAD_ICP_list.csv --limit 500 --offset 500

# Or run a quick sample of 50
npm run scrape -- --csv ./BROAD_ICP_list.csv --limit 50
```

---

## Input CSV Format

The scraper accepts any CSV with at least a domain column. Supported column names:

| Your column | Maps to |
|---|---|
| `domain`, `website`, `url`, `site` | Domain (required) |
| `brand_name`, `brand`, `company`, `merchant_name`, `name` | Brand name |
| `page_name`, `facebook_page`, `fb_page` | Facebook page name (improves search) |
| `linkedin_url` | Stored as notes |
| `combined_followers` | Stored as notes |
| `notes`, `comment`, `tags` | Notes |

### BROAD ICP List (included)

`BROAD_ICP_list.csv` has columns: `domain`, `combined_followers`, `linkedin_url`, `merchant_name`

These are auto-mapped: `merchant_name` → brand name used for Ad Library search.

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...   # required for Slack
CSV_PATH=./BROAD_ICP_list.csv                             # default CSV
DB_PATH=./data/app.db                                     # SQLite path
CONCURRENCY=2                                             # parallel scrapes
REQUEST_DELAY_MS=2500                                     # delay between brands
MAX_ADS_PER_BRAND=25                                      # ads captured per brand
HEADLESS=true                                             # false to watch browser
UI_BASE_URL=http://localhost:3000                         # used in Slack links
```

---

## UI Features

### Dashboard (/)

```
┌─────────────────────────────────────────────────────────────────────┐
│ AdTracker                              [▶ Run Scrape] [↓ Export CSV] │
├─────────────────────────────────────────────────────────────────────┤
│ Search…  Min active ads  Min new ads  Count method  □ Only failures  │
├────────────────┬───────────┬──────────┬────────┬──────────┬─────────┤
│ Brand          │ Domain    │ Act Ads  │ New 7d │ Delta    │ Status  │
├────────────────┼───────────┼──────────┼────────┼──────────┼─────────┤
│ Nike           │ nike.com  │ 1,247    │ 43     │ +12      │ ok      │
│ Apple          │ apple.com │ 892      │ 18     │ -5       │ ok      │
│ Shopify        │ shopify.com│ 341     │ 7      │ 0        │ ok      │
└────────────────┴───────────┴──────────┴────────┴──────────┴─────────┘
```

- Click any brand name to open the detail view
- Sort by any column
- Filter by active ads count, new ads, status, count method
- "Run Scrape" button triggers a background scrape job
- "Export CSV" downloads all ads from the latest run

### Brand Detail (/brands/:id)

- Snapshot metrics: active ads, new ads 7d, ads captured, runs tracked
- Historical trend table (last 10 runs with delta)
- Full ads table with expand/collapse for long copy
- "Copy All Ad Copy" — copies all text to clipboard
- "Download CSV" — exports this brand's ads

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/brands` | List brands with filters/sort |
| `GET /api/brands/:id` | Brand detail + latest ads |
| `POST /api/run` | Trigger a scrape (body: `{"csv": "./path.csv"}`) |
| `GET /api/export/latest.csv` | Download all ads from latest run |
| `GET /api/runs` | List all runs |

---

## Slack Notifications

After each run, posts a summary with:
- Run stats (total / success / failed)
- Top 10 brands by active ads
- Top 10 brands by new ads (7d)
- Big movers (delta ≥ +20 ads)
- Brands with ≥10 new ads in 7d
- Failed brands

Example Slack message:
```
✅ Ad Library Scrape — 2024-07-15
Brands processed: 500 | Success: 487 | Failed: 13 | View full results in UI

🏆 Top 10 by Active Ads:
1. nike.com — 1,247 active ads
2. apple.com — 892 active ads
...

🚀 Big Movers (delta ≥ +20):
🚀 eightsleep.com — +47 active ads (now 312)
```

---

## Database Schema

| Table | Description |
|---|---|
| `brands` | One row per unique domain |
| `runs` | One row per scrape run |
| `brand_snapshots` | Per-brand data per run (active count, new 7d, etc.) |
| `ads` | Individual ads captured per snapshot |
| `scrape_errors` | Per-brand errors per run |

---

## Scraping Strategy

1. Opens `facebook.com/ads/library/?q=<search_query>&active_status=active`
2. Intercepts **all GraphQL / network JSON responses** (not fragile DOM scraping)
3. Parses ad data from Meta's Ad Library API responses
4. Extracts: ad count, ad copy, headlines, CTAs, destination URLs, creative thumbnails
5. Falls back to DOM count extraction if JSON totals aren't present
6. Rate limits: 2.5s delay + 60% jitter between brands, exponential backoff on failures
7. 3 retries per brand before marking as failed

---

## Troubleshooting

**"No ads found" for a brand**
- Meta may require login for some pages — try `HEADLESS=false` to observe
- The `page_name` field improves search accuracy over domain-derived queries
- Some brands have no active ads (count = 0 is valid)

**Rate limiting / CAPTCHAs**
- Increase `REQUEST_DELAY_MS` (try 5000)
- Lower `CONCURRENCY` to 1
- Run with `HEADLESS=false` to solve CAPTCHAs manually

**Database issues**
```bash
rm -rf data/app.db && npx prisma db push    # reset DB
npx prisma studio                            # browse DB visually
```

**CSV not loading**
- Ensure the file has a `domain` or `website` or `merchant_name` column (or see COLUMN_ALIASES in `src/cli/csvLoader.ts`)
- Check for BOM or encoding issues: `file your.csv`
