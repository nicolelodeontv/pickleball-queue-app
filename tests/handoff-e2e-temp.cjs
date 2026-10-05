const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE = 'https://queuezerotwo.vercel.app/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const contexts = await Promise.all([1,2,3].map(() =>
    browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true })
  ));
  const [A,B,V] = contexts;
  const [a,b,v] = await Promise.all(contexts.map(c => c.newPage()));
  const logs = [];
  const result = { checks:{}, consoleErrors:[] };

  for (const [p,label] of [[a,'A'],[b,'B'],[v,'V']]) {
    p.on('console', msg => {
      if (msg.type() === 'error') result.consoleErrors.push({label,text:msg.text()});
    });
    p.on('pageerror', err => result.consoleErrors.push({label,text:'pageerror: '+err.message}));
  }

  const openApp = async page => {
    await page.goto(BASE, {waitUntil:'commit', timeout:15000});
    await page.locator('#nvs').click();
    await page.locator('#pn').waitFor({timeout:15000});
  };

  await openApp(a);
  await a.locator('#pn').fill('Handoff-A, Handoff-B, Handoff-C, Handoff-D');
  await a.locator('#f button').click();
  await a.getByRole('button',{name:'Check in all'}).click();
  await a.locator('#ql li').nth(3).waitFor();
  logs.push('A roster ready');

  await a.locator('#go').click();
  await a.locator('#nvp').click();
  await a.locator('#courts .sbg[aria-label="Plus point, Team 1"]').first().waitFor();
  logs.push('A court active');

  const downloadPromise = a.waitForEvent('download');
  await a.locator('#exp').click();
  const download = await downloadPromise;
  const backup = '/tmp/queuezerotwo-handoff-backup.json';
  await download.saveAs(backup);
  if (!fs.existsSync(backup)) throw new Error('Export failed');

  await a.getByRole('button',{name:'Live View'}).click();
  await a.getByRole('dialog').waitFor();
  await a.getByRole('button',{name:'Move host to another device'}).click();
  await a.getByRole('button',{name:'Show code'}).click();

  const identity = await a.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pickleStackState') || '{}');
    return { sid:s.sid || '', sh:s.sh || '' };
  });
  if (!identity.sid || !identity.sh) throw new Error('Missing source host identity');
  const handoffUrl = BASE + '#h=' + identity.sid + '.' + identity.sh;

  await v.goto(BASE + '#s=' + identity.sid, {waitUntil:'commit', timeout:15000});
  await v.getByText('LIVE · CONNECTED').waitFor({timeout:15000});
  const viewerBefore = await v.locator('#viewer .font-sport').first().innerText();
  if (viewerBefore !== '0') throw new Error('Viewer initial score was '+viewerBefore);
  logs.push('Viewer connected');

  await openApp(b);
  await b.locator('#impbtn').click();
  await b.locator('#imp').setInputFiles(backup);
  await b.getByRole('button',{name:'Confirm'}).click();
  await sleep(500);
  const imported = await b.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pickleStackState') || '{}');
    return { sid:s.sid || '', sh:s.sh || '', queue:s.queue || [], active:(s.courts||[]).filter(c=>c.isActive) };
  });
  if (imported.sid || imported.sh) throw new Error('Import retained Live View identity');
  if (imported.active.length !== 1 || imported.active[0].players.length !== 4) throw new Error('Import did not restore active court');
  result.checks.importFirst = true;

  await b.goto(handoffUrl, {waitUntil:'commit', timeout:15000});
  if (b.url().includes('#h=')) throw new Error('B address bar retained #h fragment');
  await b.getByRole('button',{name:'Confirm'}).click();
  await b.getByText('This device is now the host').waitFor({timeout:10000});
  result.checks.addressBarCleared = true;

  const oldViewerScore = await v.locator('#viewer .font-sport').first().innerText();
  await a.locator('#nvp').click();
  await a.locator('#courts .sbg[aria-label="Plus point, Team 1"]').first().click();
  await a.getByText('Live View host moved to another device.').waitFor({timeout:10000});
  await sleep(1200);
  const oldHostViewerScore = await v.locator('#viewer .font-sport').first().innerText();
  if (oldHostViewerScore !== oldViewerScore) throw new Error('Viewer changed after old-host score');
  result.checks.oldHostRejected = true;
  result.checks.viewerUnchangedOnOldHost = true;

  await b.locator('#nvp').click();
  await b.locator('#courts .sbg[aria-label="Plus point, Team 1"]').first().click();
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const score = await v.locator('#viewer .font-sport').first().innerText().catch(()=>null);
    if (score === '1') break;
    await sleep(250);
  }
  const newHostViewerScore = await v.locator('#viewer .font-sport').first().innerText();
  if (newHostViewerScore !== '1') throw new Error('Viewer did not update from new host; score='+newHostViewerScore);
  result.checks.newHostUpdatesViewer = true;

  await b.goto(handoffUrl, {waitUntil:'commit', timeout:15000});
  if (b.url().includes('#h=')) throw new Error('Replay fragment remained in address bar');
  await b.getByRole('button',{name:'Confirm'}).click();
  await b.getByText('Handoff failed:').waitFor({timeout:10000});
  result.checks.replayFails = true;

  result.passed = Object.values(result.checks).every(Boolean);
  console.log('HANDOFF_E2E_RESULT '+JSON.stringify(result));
  await Promise.all(contexts.map(c => c.close()));
  await browser.close();
  if (!result.passed) process.exitCode = 1;
})().catch(async err => {
  console.error('HANDOFF_E2E_RESULT '+JSON.stringify({passed:false,error:err.message,stack:err.stack}));
  process.exitCode = 1;
});
