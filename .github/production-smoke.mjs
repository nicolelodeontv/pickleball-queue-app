import { chromium } from 'playwright';

const URL = 'https://pickle-stack-app.vercel.app/';
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 1,
  permissions: ['clipboard-read', 'clipboard-write'],
});
await context.addInitScript(() => {
  window.__nativeShareAvailable = typeof Navigator.prototype.share === 'function';
  window.__shared = null;
  Object.defineProperty(Navigator.prototype, 'share', {
    configurable: true,
    value: async data => {
      window.__shared = {
        title: data?.title || '',
        url: data?.url || '',
        text: data?.text || '',
        fileName: data?.files?.[0]?.name || '',
        hasFiles: !!data?.files?.length
      };
    }
  });
  Object.defineProperty(Navigator.prototype, 'canShare', {
    configurable: true,
    value: data => !!data?.files?.length
  });
});
const page = await context.newPage();

const check = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name); throw e; }
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

await check('production loads', async () => {
  await page.getByRole('heading', { name: /PickleStack/i }).first().waitFor();
});

for (const name of ['Ana', 'Ben', 'Cara', 'Dan']) {
  await page.locator('#pn').fill(name);
  await page.locator('#f').press('Enter');
}
await check('four players can be queued', async () => {
  if (await page.locator('#ql li').count() !== 4) throw new Error('expected 4 queued players');
});

await page.getByRole('button', { name: /SEND NEXT 4 TO COURT/i }).click();
await check('match starts', async () => {
  await page.getByText('LIVE', { exact: true }).first().waitFor();
});

await page.getByRole('button', { name: /Live link/i }).click();
await check('live link popup', async () => {
  await page.getByText('Live session', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Copy link' }).waitFor();
  await page.getByRole('button', { name: 'Share' }).waitFor();
  await page.locator('.qrb svg').waitFor();
});

const liveUrl = await page.locator('.break-all').first().innerText();
await page.getByRole('button', { name: 'Copy link' }).click();
await check('live link clipboard', async () => {
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (copied !== liveUrl) throw new Error('clipboard mismatch');
});

await page.getByRole('button', { name: 'Share' }).click();
await check('live share wiring', async () => {
  const shared = await page.evaluate(() => window.__shared);
  if (!shared?.url || shared.url !== liveUrl) throw new Error('share did not receive live URL');
});

await page.getByRole('button', { name: 'Close' }).click();
await page.getByRole('button', { name: /End session/i }).click();
await page.getByRole('button', { name: 'Confirm' }).click();

await check('session ends into results', async () => {
  await page.getByText('Session Results', { exact: true }).waitFor();
  if (await page.getByRole('button', { name: /Back to session/i }).count()) throw new Error('Back to session still exists');
  await page.getByRole('button', { name: /Share results image/i }).waitFor();
  await page.getByRole('button', { name: /New session/i }).waitFor();
});

const resultsUrl = await page.locator('.break-all').last().innerText();
await page.getByRole('button', { name: 'Copy results link' }).click();
await check('results link clipboard', async () => {
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (copied !== resultsUrl) throw new Error('results clipboard mismatch');
});

await page.getByRole('button', { name: /Share results image/i }).click();
await check('results image share wiring', async () => {
  const shared = await page.evaluate(() => window.__shared);
  if (!shared?.hasFiles || shared.fileName !== 'picklestack-results.png') throw new Error('image was not passed to share');
});

await check('old live link now shows final results', async () => {
  const finalPage = await context.newPage();
  await finalPage.goto(liveUrl, { waitUntil: 'networkidle' });
  await finalPage.getByText('Final Results', { exact: true }).waitFor({ timeout: 15000 });
  await finalPage.close();
});

await check('results survive refresh', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Session Results', { exact: true }).waitFor();
});

console.log('INFO native navigator.share available in CI Chromium:', await page.evaluate(() => window.__nativeShareAvailable));
console.log('INFO mobile viewport:', await page.evaluate(() => `${innerWidth}x${innerHeight}`));
await browser.close();
