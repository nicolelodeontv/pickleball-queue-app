import { chromium } from 'playwright';

const baseUrl = process.env.PICKLESTACK_PREVIEW;
if (!baseUrl) throw new Error('PICKLESTACK_PREVIEW is required');

const browser = await chromium.launch({ headless: true });
const organizer = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

try {
  const response = await organizer.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const consoleLines = []; const pageErrors = []; const responses = []; organizer.on('console', m => consoleLines.push(m.type()+': '+m.text())); organizer.on('pageerror', e => pageErrors.push(e.message)); organizer.on('response', async r => { if (r.url().includes('wochetemsnrysnjrgoed.supabase.co')) responses.push({url:r.url(), status:r.status(), method:r.request().method()}); });
  console.log('page', JSON.stringify({
    url: organizer.url(),
    status: response?.status(),
    title: await organizer.title()
  }));

  try {
    await organizer.locator('#pn').waitFor({ state: 'visible', timeout: 15000 });
  } catch (e) {
    console.log('diagnostic body', (await organizer.locator('body').innerText()).slice(0, 6000));
    throw e;
  }

  await organizer.locator('#pn').fill('Ana, Bea, Cara, Dani');
  await organizer.locator('#f button').click();
  await organizer.getByRole('button', { name: 'Check in all' }).waitFor();
  await organizer.getByRole('button', { name: 'Check in all' }).click();
  await organizer.waitForFunction(() => {
    const el = document.getElementById('qc');
    return el && el.textContent === '4';
  }, null, { timeout: 10000 });

  await organizer.locator('button[title="Open a read-only live view for players"]').click();
  await organizer.waitForTimeout(3000);
  console.log('runtime', JSON.stringify({supabase: await organizer.evaluate(() => typeof window.supabase),
    qrcode: await organizer.evaluate(() => typeof window.qrcode), body: (await organizer.locator('body').innerText()).slice(0,3000), responses, consoleLines, pageErrors}, null, 2));
  await organizer.getByRole('button', { name: 'Copy link' }).waitFor({ timeout: 10000 });
  const liveUrl = (await organizer.locator('.fixed .break-all').innerText()).trim();

  if (!/^https?:\/\/.+#s=[a-z0-9]{4,10}$/i.test(liveUrl)) {
    throw new Error('Generated Live View URL was not found: ' + liveUrl);
  }

  const viewer = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const viewerUrl = new URL(liveUrl);
  const shareToken = new URL(baseUrl).searchParams.get('_vercel_share');
  if (shareToken) viewerUrl.searchParams.set('_vercel_share', shareToken);
  await viewer.goto(viewerUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await viewer.locator('#viewer').getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 15000 });
  await viewer.locator('#viewer').getByRole('heading', { name: 'Up Next' }).waitFor({ timeout: 15000 });
  await viewer.locator('#viewer').getByRole('heading', { name: 'The Stack' }).waitFor({ timeout: 15000 });
  await viewer.locator('#viewer').getByRole('heading', { name: 'Leaderboard' }).waitFor({ timeout: 15000 });

  const organizerControls = await viewer.locator('#go, #rs, #f, #tg').count();
  if (organizerControls !== 0) throw new Error('Viewer exposed organizer controls');

  const viewerText = await viewer.locator('body').innerText();
  for (const expected of ['Ana', 'Bea', 'Cara', 'Dani']) {
    if (!viewerText.includes(expected)) throw new Error('Viewer missing player: ' + expected);
  }

  console.log(JSON.stringify({
    pass: true,
    liveUrl,
    viewport: '390x844',
    viewerReadOnly: organizerControls === 0,
    playersVisible: true,
    sections: ['Up Next', 'The Stack', 'Leaderboard']
  }, null, 2));
  await viewer.close();
} finally {
  await organizer.close();
  await browser.close();
}
