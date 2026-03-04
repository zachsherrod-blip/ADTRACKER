import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const USER_AGENT =
  process.env.USER_AGENT ??
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

export async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Stealth: override navigator.webdriver
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });

  return ctx;
}

export async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage();
  // Block images/fonts for speed (we capture ad thumbs separately)
  await page.route('**/*.{woff,woff2,ttf,otf}', (r) => r.abort());
  return page;
}
