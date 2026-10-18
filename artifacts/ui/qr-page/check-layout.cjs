const { chromium } = require('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const cssFile = fs.readdirSync('dist/assets').find(name => name.endsWith('.css'));
  const css = fs.readFileSync(`dist/assets/${cssFile}`, 'utf8');
  const rows = [];
  for (const state of ['dormant', 'active', 'draft', 'public-off']) {
    for (const width of [320, 393, 620, 1280]) {
      for (const colorScheme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width, height: 852 }, colorScheme });
        await page.route('**/src/styles.css', route => route.fulfill({ contentType: 'text/css', body: css }));
        await page.route('**/src/ui/pages/hostQr.css', route => route.fulfill({ contentType: 'text/css', body: '' }));
        await page.goto(`http://127.0.0.1:5190/artifacts/ui/qr-page/${state}.html`);
        await page.evaluate(() => document.fonts.ready);
        const result = await page.evaluate(() => ({
          width: innerWidth, documentWidth: document.documentElement.scrollWidth,
          buttons: [...document.querySelectorAll('.qr-wall-actions .btn, .qr-wall-configure, .qr-access-notice > .btn')].map(el => ({ name: el.textContent.trim() || el.getAttribute('aria-label'), height: el.getBoundingClientRect().height })),
          wallHeight: document.querySelector('.qr-page-walls').getBoundingClientRect().height,
          billingWidth: document.querySelector('.qr-access-notice > .btn')?.getBoundingClientRect().width
        }));
        if (result.documentWidth > width || result.buttons.some(b => b.height < 44)) throw new Error(JSON.stringify({ state, width, colorScheme, ...result }));
        rows.push({ state, colorScheme, ...result });
        if (state === 'dormant' && [393, 1280].includes(width)) {
          await page.screenshot({ path: `artifacts/ui/qr-page/${state}-${width}-${colorScheme}.png`, fullPage: true });
        }
        await page.close();
      }
    }
  }
  fs.writeFileSync('artifacts/ui/qr-page/layout-results.json', JSON.stringify(rows, null, 2));
  console.log(`${rows.length} responsive cases passed: no horizontal overflow; wall and billing controls at least 44px high.`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
