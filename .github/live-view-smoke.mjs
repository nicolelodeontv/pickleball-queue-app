import { chromium } from 'playwright';

const baseUrl = process.env.PICKLESTACK_PREVIEW;
if (!baseUrl) throw new Error('PICKLESTACK_PREVIEW is required');

const browser = await chromium.launch({ headless: true });
const organizer = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

try {
  const response = await organizer.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

  await organizer.getByRole('button', { name: 'Live View' }).click();
  await organizer.getByRole('button', { name: 'Copy link' }).waitFor({ timeout: 10000 });
  const liveUrl = (await organizer.locator('.fixed .break-all').innerText()).trim();

  if (!/^https?:\/\/.+#s=[a-z0-9]{4,10}$/i.test(liveUrl)) {
    throw new Error('Generated Live View URL was not found: ' + liveUrl);
  }

  const viewer = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await viewer.goto(liveUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await viewer.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 15000 });
  await viewer.getByText('Up Next', { exact: true }).waitFor({ timeout: 15000 });
  await viewer.getByText('The Stack', { exact: true }).waitFor({ timeout: 15000 });
  await viewer.getByText('Leaderboard', { exact: true }).waitFor({ timeout: 15000 });

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
