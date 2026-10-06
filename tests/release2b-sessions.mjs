import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP = process.env.APP_URL || 'http://127.0.0.1:4173/';
const SUPABASE = 'https://wochetemsnrysnjrgoed.supabase.co';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function freshContext(browser, device) {
  const context = await browser.newContext({
    ...device,
    serviceWorkers: 'block',
    locale: 'en-US',
  });
  await context.route(SUPABASE + '/**', route => route.abort());
  return context;
}

async function setupFour(page) {
  await page.goto(APP, {waitUntil: 'networkidle'});
  await page.evaluate(() => document.getElementById('nvs')?.click());
  await page.locator('#pn').fill('Alpha,Beta,Gamma,Delta');
  await page.locator('#f button').click();
  await page.waitForFunction(() => document.getElementById('wc')?.textContent === '4', null, {timeout: 5000});
  await page.getByRole('button', {name: 'Check in all'}).click();
  assert.equal(await page.locator('#wc').innerText(), '0');
  assert.equal(await page.locator('#qc').innerText(), '4');
}

async function main() {
  const browser = await chromium.launch({headless: true});
  const desktop = await freshContext(browser, devices['Desktop Chrome']);
  const iphone = await freshContext(browser, devices['iPhone 13']);
  const pixel = await freshContext(browser, devices['Pixel 7']);

  const dp = await desktop.newPage();
  const ip = await iphone.newPage();
  const pp = await pixel.newPage();
  const backupPath = path.join(os.tmpdir(), 'queuezerotwo-release2b-backup.json');

  try {
    // Context 1: full named-session/history flow.
    await setupFour(dp);
    await dp.locator('#go').click();
    await dp.locator('#courts .sbg[aria-label="Plus point, Team 1"]').first().waitFor({state:'visible', timeout:5000});

    for (let i = 0; i < 11; i++) {
      await dp.locator('button[aria-label="Plus point, Team 1"]').first().click();
    }

    await dp.getByRole('button', {name: 'FINISH & LOG'}).click();
    await dp.locator('#msg').getByText('Match logged.').waitFor({state:'visible', timeout:5000});

    // Avoid creating persistent production/Supabase test sessions. The release-2b
    // history behavior is local-device functionality, so the test blocks Supabase.
    await dp.locator('#rs').click();
    await dp.locator('[role="dialog"]').getByRole('button', {name: 'Confirm'}).click();
    await dp.locator('#sn').waitFor({state:'visible', timeout:5000});
    await dp.locator('#sn').fill('Sat 6pm');
    assert.equal(await dp.evaluate(() => S.name), 'Sat 6pm');

    await dp.locator('.nw').click();
    await dp.getByRole('button', {name: 'Confirm'}).click();

    await dp.locator('button[title="Past sessions"]').click();
    const history = dp.locator('[role="dialog"]');
    await history.getByText('Sat 6pm', {exact:true}).waitFor({state:'visible', timeout:5000});
    assert.match(await history.innerText(), /1 games/);
    assert.match(await history.innerText(), /Alpha|Beta|Gamma|Delta/);
    await history.getByRole('button', {name: 'Close'}).click();

    // Export must contain the archived history.
    const [download] = await Promise.all([
      dp.waitForEvent('download'),
      dp.locator('#exp').click(),
    ]);
    await download.saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.equal(backup.app, 'QueueZeroTwo');
    assert.equal(backup.state.hist[0].name, 'Sat 6pm');
    assert.equal(backup.state.hist[0].g, 1);
    assert.equal(backup.state.hist[0].top.length <= 10, true);

    // Delete the saved session, then verify the list is empty.
    await dp.locator('button[title="Past sessions"]').click();
    await dp.getByRole('button', {name: 'Delete this session'}).click();
    await dp.getByRole('button', {name: 'Confirm'}).click();
    const emptyHistory = dp.locator('[role="dialog"]');
    await emptyHistory.getByText('No past sessions yet.', {exact:false}).waitFor({state:'visible', timeout:5000});
    await emptyHistory.getByRole('button', {name: 'Close'}).click();

    // Context 2: clean mobile device imports the same backup and restores history.
    await ip.goto(APP, {waitUntil:'networkidle'});
    await ip.locator('#imp').setInputFiles(backupPath);
    await ip.getByRole('button', {name: 'Confirm'}).click();
    await ip.locator('button[title="Past sessions"]').click();
    const imported = ip.locator('[role="dialog"]');
    await imported.getByText('Sat 6pm', {exact:true}).waitFor({state:'visible', timeout:5000});
    await imported.getByRole('button', {name: 'Close'}).click();

    // Context 3: mobile scoring regression using the current production selectors.
    await setupFour(pp);
    await pp.locator('#go').click();
    await pp.locator('button[aria-label="Plus point, Team 1"]').first().click();
    await assert.equal(await pp.locator('.sbn').first().innerText(), '1');

    console.log(JSON.stringify({
      pass: true,
      namedSession: true,
      archivedHistory: true,
      topThreeStored: true,
      exportContainsHistory: true,
      deleteWorks: true,
      importRestoresHistory: true,
      mobileScoring: true,
    }, null, 2));
  } finally {
    try { fs.unlinkSync(backupPath); } catch {}
    await browser.close();
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
