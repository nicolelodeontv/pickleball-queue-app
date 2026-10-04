import { chromium } from 'playwright';

const baseUrl = process.env.PICKLESTACK_PREVIEW;
if (!baseUrl) throw new Error('PICKLESTACK_PREVIEW is required');

const browser = await chromium.launch({ headless: true });
const organizer = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

try {
  await organizer.goto(baseUrl, { waitUntil: 'networkidle' });
  await organizer.locator('#pn').fill('Ana, Bea, Cara, Dani');
  await organizer.locator('#f button').click();
  await organizer.waitForFunction(() => {
    const el = document.getElementById('qc');
    return el && el.textContent === '4';
  });

  await organizer.getByRole('button', { name: /Live View/i }).click();
  await organizer.getByRole('button', { name: 'Copy link' }).waitFor();
  const liveUrl = await organizer.locator('.fixed .break-all').innerText();

  if (!/^https?:\/\/.+#s=[a-z0-9]{4,10}$/i.test(liveUrl.trim())) {
    throw new Error('Generated Live View URL was not found: ' + liveUrl);
  }

  const viewer = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await viewer.goto(liveUrl.trim(), { waitUntil: 'networkidle' });
  await viewer.getByText('LIVE VIEW', { exact: true }).waitFor();

  await viewer.getByText('Up Next', { exact: true }).waitFor();
  await viewer.getByText('The Stack', { exact: true }).waitFor();
  await viewer.getByText('Leaderboard', { exact: true }).waitFor();

  const organizerControls = await viewer.locator('#go, #rs, #f, #tg').count();
  if (organizerControls !== 0) {
    throw new Error('Viewer exposed organizer controls');
  }

  const viewerText = await viewer.locator('body').innerText();
  for (const expected of ['Ana', 'Bea', 'Cara', 'Dani']) {
    if (!viewerText.includes(expected)) throw new Error('Viewer missing player: ' + expected);
  }

  console.log(JSON.stringify({
    pass: true,
    liveUrl: liveUrl.trim(),
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
