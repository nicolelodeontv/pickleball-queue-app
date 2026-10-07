import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP = process.env.APP_URL || 'http://127.0.0.1:4173/';
const SUPABASE = 'https://wochetemsnrysnjrgoed.supabase.co';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function openMenu(page) {
  if (!(await page.locator('#qmenu').isVisible())) await page.locator('#mnb').click();
}

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
  await page.evaluate(() => {
    if (innerWidth < 1024) document.getElementById('nvs')?.click();
  });
  await page.locator('#pn').fill('Alpha,Beta,Gamma,Delta');
  await page.locator('#f button').click();
  await page.waitForFunction(() => document.getElementById('wc')?.textContent === '4', null, {timeout: 5000});
  await page.getByRole('button', {name: 'Check in all'}).click();
  await page.waitForFunction(() => document.getElementById('wc')?.textContent === '0', null, {timeout: 5000});
  await page.evaluate(() => document.getElementById('nvp')?.click());
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
  const persistencePath = path.join(os.tmpdir(), 'queuezerotwo-release1-persistence.json');
  const hostilePath = path.join(os.tmpdir(), 'queuezerotwo-hostile-backup.json');

  try {
    // Release 1 regression: Win by + court count survive Export/Import and New session.
    await dp.goto(APP, {waitUntil: 'networkidle'});
    await dp.locator('#tg').selectOption('15');
    await dp.locator('#wbs').selectOption('1');
    await dp.locator('#ncs').selectOption('6');
    await dp.waitForFunction(() => S.target === 15 && S.wb === 1 && S.courts.length === 6, null, {timeout: 5000});
    const [persistenceDownload] = await Promise.all([
      dp.waitForEvent('download'),
      (await openMenu(dp), dp.locator('#qmenu #exp').click()),
    ]);
    await persistenceDownload.saveAs(persistencePath);
    const persistedBackup = JSON.parse(fs.readFileSync(persistencePath, 'utf8'));
    assert.equal(persistedBackup.state.target, 15);
    assert.equal(persistedBackup.state.wb, 1);
    assert.equal(persistedBackup.state.courts.length, 6);

    await dp.locator('#rs').click();
    await dp.locator('[role="dialog"]').getByRole('button', {name: 'Confirm'}).click();
    await dp.locator('.nw').click();
    await dp.locator('[role="dialog"]').getByRole('button', {name: 'Confirm'}).click();
    await dp.waitForFunction(() => S.target === 15 && S.wb === 1 && S.courts.length === 6, null, {timeout: 5000});
    assert.equal(await dp.locator('#tg').inputValue(), '15');
    assert.equal(await dp.locator('#wbs').inputValue(), '1');
    assert.equal(await dp.locator('#ncs').inputValue(), '6');

    // Context 2: restore the Release 1 settings backup on a clean device.
    await ip.goto(APP, {waitUntil: 'networkidle'});
    await ip.evaluate(() => localStorage.clear());
    await ip.reload({waitUntil: 'networkidle'});
    await ip.locator('#imp').setInputFiles(persistencePath);
    await ip.getByRole('button', {name: 'Confirm'}).click();
    await ip.waitForFunction(() => S.target === 15 && S.wb === 1 && S.courts.length === 6, null, {timeout: 5000});
    assert.equal(await ip.locator('#tg').inputValue(), '15');
    assert.equal(await ip.locator('#wbs').inputValue(), '1');
    assert.equal(await ip.locator('#ncs').inputValue(), '6');
    await ip.evaluate(() => localStorage.clear());
    await ip.reload({waitUntil: 'networkidle'});

    // Context 3: hostile backup must remain inert and render as text.
    const hostile='<img src=x onerror=alert(1)>';
    fs.writeFileSync(hostilePath, JSON.stringify({
      app:'QueueZeroTwo',
      version:1,
      exportedAt:new Date().toISOString(),
      state:{
        courts:[
          {id:1,name:hostile,isActive:false,players:[],score:[0,0],mid:'',t:0},
          {id:2,name:'Court 2',isActive:false,players:[],score:[0,0],mid:'',t:0},
          {id:3,name:'Court 3',isActive:false,players:[],score:[0,0],mid:'',t:0},
          {id:4,name:'Court 4',isActive:false,players:[],score:[0,0],mid:'',t:0}
        ],
        log:[{mid:'hostile1',c:hostile,p:['Alice','Bob','Carol','Dave'],s:[11,9],w:0,t:Date.now(),d:600000,tg:11}]
      }
    }), 'utf8');
    let alerts=0;
    pp.on('dialog', async d => { alerts++; await d.dismiss(); });
    await pp.goto(APP, {waitUntil: 'networkidle'});
    await pp.evaluate(() => localStorage.clear());
    await pp.reload({waitUntil: 'networkidle'});
    await pp.locator('#imp').setInputFiles(hostilePath);
    await pp.getByRole('button', {name: 'Confirm'}).click();
    await pp.waitForFunction(() => S.log.length === 1 && S.courts[0].name.includes('<img'), null, {timeout: 5000});
    assert.equal(alerts, 0);
    assert.equal(await pp.locator('#log img').count(), 0);
    assert.equal(await pp.locator('#courts img').count(), 0);
    assert.match(await pp.locator('#log').innerText(), /<img src=x onerror=/);
    await pp.evaluate(() => localStorage.clear());
    await pp.reload({waitUntil: 'networkidle'});

    // Restore the normal 11-point fixture before the named-session flow.
    await dp.locator('#tg').selectOption('11');
    await dp.locator('#wbs').selectOption('2');
    await dp.waitForFunction(() => S.target === 11 && S.wb === 2, null, {timeout: 5000});

    // Release 11: Equal Sit-outs uses fewest games, then longest wait, then queue order.
    await dp.evaluate(() => {
      S = mk();
      S.eq = true;
      S.queue = ['Alpha','Beta','Gamma','Delta','Epsilon'];
      S.gp = {alpha:2,beta:2,gamma:2,delta:2,epsilon:2};
      const now = Date.now();
      S.wt = {
        alpha: now - 1000,
        beta: now - 4000,
        gamma: now - 3000,
        delta: now - 2000,
        epsilon: now - 5000,
      };
      render();
    });
    assert.deepEqual(
      await dp.evaluate(() => pick4().map(i => S.queue[i])),
      ['Beta','Gamma','Delta','Epsilon'],
    );

    await dp.evaluate(() => {
      const same = Date.now() - 10000;
      S.wt = {alpha:same,beta:same,gamma:same,delta:same,epsilon:same};
      render();
    });
    assert.deepEqual(
      await dp.evaluate(() => pick4().map(i => S.queue[i])),
      ['Alpha','Beta','Gamma','Delta'],
    );

    // Wait timestamps are created when players check in, cleared when they go to court,
    // and restarted when they return to the waiting stack.
    await dp.evaluate(() => {
      S = mk();
      S.waiting = ['One','Two','Three','Four'];
      render();
    });
    await dp.getByRole('button', {name:'Check in all'}).click();
    assert.equal(await dp.evaluate(() => Object.keys(S.wt).length), 4);
    await dp.locator('#go').click();
    await dp.waitForFunction(
      () => S.courts.some(c => c.isActive) && S.queue.length === 0 && Object.keys(S.wt).length === 0,
      null,
      {timeout:5000},
    );
    await dp.getByRole('button', {name:'FINISH & LOG'}).click();
    await dp.waitForFunction(
      () => !S.courts.some(c => c.isActive) && S.queue.length === 4 && Object.keys(S.wt).length === 4,
      null,
      {timeout:5000},
    );

    // Return to a clean device state before the existing session regressions.
    await dp.evaluate(() => localStorage.clear());
    await dp.reload({waitUntil:'networkidle'});

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

    await openMenu(dp);
    await dp.locator('#qmenu button[title="Past sessions"]').click();
    const history = dp.locator('[role="dialog"]');
    await history.getByText('Sat 6pm', {exact:true}).waitFor({state:'visible', timeout:5000});
    assert.match(await history.innerText(), /1 games/);
    assert.match(await history.innerText(), /Alpha|Beta|Gamma|Delta/);
    await history.getByRole('button', {name: 'Close'}).click();

    // Export must contain the archived history.
    const [download] = await Promise.all([
      dp.waitForEvent('download'),
      (await openMenu(dp), dp.locator('#qmenu #exp').click()),
    ]);
    await download.saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.equal(backup.app, 'QueueZeroTwo');
    assert.equal(backup.state.hist[0].name, 'Sat 6pm');
    assert.equal(backup.state.hist[0].g, 1);
    assert.equal(backup.state.hist[0].top.length <= 10, true);

    // Delete the saved session, then verify the list is empty.
    await openMenu(dp);
    await dp.locator('#qmenu button[title="Past sessions"]').click();
    await dp.getByRole('button', {name: 'Delete this session'}).click();
    await dp.getByRole('button', {name: 'Confirm'}).click();
    const emptyHistory = dp.locator('[role="dialog"]');
    await emptyHistory.getByText('No past sessions yet.', {exact:false}).waitFor({state:'visible', timeout:5000});
    await emptyHistory.getByRole('button', {name: 'Close'}).click();

    // Context 2: clean mobile device imports the same backup and restores history.
    await ip.goto(APP, {waitUntil:'networkidle'});
    await ip.locator('#imp').setInputFiles(backupPath);
    await ip.getByRole('button', {name: 'Confirm'}).click();
    await openMenu(ip);
    await ip.locator('#qmenu button[title="Past sessions"]').click();
    const imported = ip.locator('[role="dialog"]');
    await imported.getByText('Sat 6pm', {exact:true}).waitFor({state:'visible', timeout:5000});
    await imported.getByRole('button', {name: 'Close'}).click();

    // Release 3 regression: Undo a finished match, then finish it again. All-time Players must count one game.
    await dp.evaluate(() => localStorage.clear());
    await dp.reload({waitUntil: 'networkidle'});
    await dp.locator('#pn').fill('Alpha,Beta,Gamma,Delta');
    await dp.locator('#f button').click();
    await dp.getByRole('button', {name: 'Check in all'}).click();
    await dp.locator('#go').click();
    for (let i = 0; i < 11; i++) {
      await dp.locator('button[aria-label="Plus point, Team 1"]').first().click();
    }
    await dp.getByRole('button', {name: 'FINISH & LOG'}).click();
    await dp.locator('#msg').getByText('Match logged.').waitFor({state:'visible', timeout:5000});
    await dp.locator('#msg').getByRole('button', {name:'Undo'}).click();
    await dp.waitForFunction(() => S.log.length === 0 && S.courts.some(c => c.isActive), null, {timeout:5000});
    await dp.locator('button[aria-label="Plus point, Team 1"]').first().waitFor({state:'visible', timeout:5000});
    for (let i = 0; i < 11; i++) {
      await dp.locator('button[aria-label="Plus point, Team 1"]').first().click();
    }
    await dp.getByRole('button', {name: 'FINISH & LOG'}).click();
    await dp.locator('#msg').getByText('Match logged.').waitFor({state:'visible', timeout:5000});
    await openMenu(dp);
    await dp.locator('#qmenu button[title="Players"]').click();
    const players = dp.locator('[role="dialog"]').last();
    await players.locator('button.pr[data-k="alpha"]').waitFor({state:'visible', timeout:5000});
    await players.locator('button.pr[data-k="alpha"]').click();
    const profile = dp.locator('[role="dialog"]').last();
    const gamesCard = profile.getByText('Games', {exact:true}).locator('..');
    assert.match(await gamesCard.innerText(), /^1\s*Games$/);
    await profile.getByRole('button', {name:'Close'}).click();
    await dp.evaluate(() => localStorage.clear());
    await dp.reload({waitUntil:'networkidle'});

    // Release 4/5/6/8 responsive header + sidebar regression.
    await ip.goto(APP, {waitUntil:'networkidle'});
    await ip.evaluate(() => localStorage.clear());
    await ip.reload({waitUntil:'networkidle'});
    const header = ip.locator('header .container');
    const headerBar = ip.locator('header .container>div:nth-child(2)');
    assert.equal(await header.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    assert.equal(await headerBar.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    assert.equal(await ip.locator('#mnw').count(), 0);
    assert.equal(await ip.locator('#mnb').count(), 1);
    assert.equal(await ip.locator('#mnb').isVisible(), true);
    assert.equal(await headerBar.locator('> button[onclick="live()"]').count(), 1);
    for (const id of ['snb','hpb','thb','tsb']) {
      assert.equal(await headerBar.locator('#'+id).count(), 1);
    }
    const faqHeader = headerBar.locator('> button[onclick="openFaq()"][title="How it works"]');
    assert.equal(await faqHeader.count(), 1);
    assert.equal(await headerBar.locator('> button[onclick="hist()"]').count(), 0);
    assert.equal(await headerBar.locator('> button[onclick="stand()"]').count(), 0);
    assert.equal(await headerBar.locator('#exp').count(), 0);
    assert.equal(await headerBar.locator('#impbtn').count(), 0);

    // The moved utility controls work directly from the header.
    await headerBar.locator('#snb').click();
    if (await headerBar.locator('#hpb').isVisible()) await headerBar.locator('#hpb').click();
    await headerBar.locator('#tsb').click();
    await headerBar.locator('#thb').click();
    assert.equal(await ip.locator('html[data-theme="light"]').count(), 1);
    await headerBar.locator('#thb').click();
    assert.equal(await ip.locator('html[data-theme="light"]').count(), 0);
    await faqHeader.click();
    const faqDialog = ip.locator('#faq');
    await faqDialog.waitFor({state:'visible', timeout:5000});
    assert.equal(await faqDialog.evaluate(d => d.open), true);
    await ip.keyboard.press('Escape');
    await faqDialog.waitFor({state:'hidden', timeout:5000});

    // Only the remaining five items live in the phone drawer.
    await openMenu(ip);
    const menu = ip.locator('#qmenu');
    await menu.waitFor({state:'visible', timeout:5000});
    const menuBox = await menu.boundingBox();
    assert.ok(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= (await ip.evaluate(() => innerWidth)));
    assert.equal(await menu.locator('button').count(), 5);
    for (const title of ['Players','Standings','Past sessions','Export backup','Import backup']) {
      await menu.locator('button[title="'+title+'"]').waitFor({state:'visible', timeout:5000});
    }
    assert.equal(await menu.locator('#snb,#hpb,#thb,#tsb').count(), 0);
    assert.equal(await menu.locator('button[title="How it works"]').count(), 0);

    await menu.locator('button[title="Standings"]').click();
    await ip.getByRole('heading', {name:'Live Standings'}).waitFor({state:'visible', timeout:5000});
    await ip.getByRole('button', {name:'Back to game'}).click();

    await openMenu(ip);
    assert.equal(await menu.isVisible(), true);
    await ip.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
    await openMenu(ip);
    const scrimBox = await ip.locator('#qscrim').boundingBox();
    const drawerBox = await menu.boundingBox();
    assert.ok(scrimBox && drawerBox);
    await ip.mouse.click(Math.min(scrimBox.x + scrimBox.width - 6, drawerBox.x + drawerBox.width + 20), 80);
    assert.equal(await menu.isVisible(), false);

    // Release 11: menu starts hidden and opens on demand at every breakpoint.
    await dp.goto(APP, {waitUntil:'networkidle'});
    await dp.evaluate(() => localStorage.clear());
    await dp.setViewportSize({width:1280,height:800});
    await dp.reload({waitUntil:'networkidle'});
    const dmenu = dp.locator('#qmenu');
    assert.equal(await dmenu.isVisible(), false);
    assert.equal(await dp.locator('#mnw').count(), 0);
    assert.equal(await dp.locator('header button[onclick="live()"]').count(), 1);
    assert.equal(await dp.locator('#mnb').isVisible(), true);
    assert.equal(await dp.locator('#mnb').getAttribute('aria-label'), 'Open menu');
    assert.equal(await dp.evaluate(() => document.body.classList.contains('qw')), false);

    await dp.locator('#mnb').click();
    await dmenu.waitFor({state:'visible', timeout:5000});
    assert.ok((await dmenu.boundingBox())?.width >= 220);
    assert.equal(await dp.locator('#mnb').getAttribute('aria-label'), 'Close menu');
    assert.equal(await dp.locator('#mnb').getAttribute('aria-expanded'), 'true');
    assert.equal(await dp.evaluate(() => document.body.classList.contains('qw')), true);
    const open1280 = await dmenu.boundingBox();
    const stackOpen1280 = await dp.locator('#sstk').boundingBox();
    assert.ok(open1280 && stackOpen1280 && stackOpen1280.x >= open1280.x + open1280.width + 4);
    assert.equal(await dmenu.locator('button').count(), 6);
    for (const title of ['Players','Standings','Past sessions','Export backup','Import backup']) {
      await dmenu.locator('button[title="'+title+'"]').waitFor({state:'visible', timeout:5000});
    }

    // At 1280px+ choosing an item leaves the docked menu open.
    await dmenu.locator('button[title="Standings"]').click();
    await dp.getByRole('heading', {name:'Live Standings'}).waitFor({state:'visible', timeout:5000});
    await dp.getByRole('button', {name:'Back to game'}).click();
    assert.equal(await dmenu.isVisible(), true);
    assert.equal(await dp.locator('#mnb').getAttribute('aria-label'), 'Close menu');
    await dp.keyboard.press('Escape');
    assert.equal(await dmenu.isVisible(), false);
    assert.equal(await dp.locator('#mnb').getAttribute('aria-label'), 'Open menu');
    assert.equal(await dp.evaluate(() => document.body.classList.contains('qw')), false);

    // A reload always returns the menu to closed.
    await dp.locator('#mnb').click();
    assert.equal(await dmenu.isVisible(), true);
    await dp.reload({waitUntil:'networkidle'});
    assert.equal(await dmenu.isVisible(), false);
    assert.equal(await dp.locator('#mnb').getAttribute('aria-label'), 'Open menu');

    // The wide desktop dock works at 1800px too.
    await dp.setViewportSize({width:1800,height:900});
    await dp.reload({waitUntil:'networkidle'});
    assert.equal(await dmenu.isVisible(), false);
    await dp.locator('#mnb').click();
    assert.equal(await dmenu.isVisible(), true);
    const dockWide = await dmenu.boundingBox();
    const stackWide = await dp.locator('#sstk').boundingBox();
    assert.ok(dockWide && stackWide && stackWide.x >= dockWide.x + dockWide.width + 4);
    assert.equal(await dp.evaluate(() => document.body.classList.contains('qw')), true);
    await dp.keyboard.press('Escape');
    assert.equal(await dmenu.isVisible(), false);

    // The 1024px tablet layout uses a temporary overlay, not a rail.
    await dp.setViewportSize({width:1024,height:800});
    await dp.reload({waitUntil:'networkidle'});
    assert.equal(await dmenu.isVisible(), false);
    assert.equal(await dp.locator('#mnb').isVisible(), true);
    const stackClosed1024 = await dp.locator('#sstk').boundingBox();
    await dp.locator('#mnb').click();
    await dmenu.waitFor({state:'visible', timeout:5000});
    assert.ok((await dmenu.boundingBox())?.width >= 220);
    assert.equal(await dp.evaluate(() => document.body.classList.contains('qw')), false);
    const stackOpen1024 = await dp.locator('#sstk').boundingBox();
    assert.ok(stackClosed1024 && stackOpen1024 && Math.abs(stackOpen1024.x - stackClosed1024.x) < 2);

    await dmenu.locator('button[title="Standings"]').click();
    assert.equal(await dmenu.isVisible(), false);
    await dp.getByRole('heading', {name:'Live Standings'}).waitFor({state:'visible', timeout:5000});
    await dp.getByRole('button', {name:'Back to game'}).click();

    await dp.locator('#mnb').click();
    assert.equal(await dmenu.isVisible(), true);
    await dp.mouse.click(900, 120);
    await dmenu.waitFor({state:'hidden', timeout:1000});

    // Context 3: mobile scoring regression using the current production selectors.
    await setupFour(pp);
    await pp.evaluate(() => document.getElementById('nvs')?.click());
    await pp.locator('#go').click();
    await pp.evaluate(() => document.getElementById('nvp')?.click());
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
      equalSitoutWaitTieBreak: true,
      waitTimestampLifecycle: true,
    }, null, 2));
  } finally {
    for (const p of [backupPath, persistencePath, hostilePath]) {
      try { fs.unlinkSync(p); } catch {}
    }
    await browser.close();
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});

