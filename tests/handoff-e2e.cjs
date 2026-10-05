const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE = 'https://queuezerotwo.vercel.app/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({headless: true});
  const A = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true});
  const B = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true});
  const V = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true});
  const a = await A.newPage();
  const b = await B.newPage();
  const v = await V.newPage();
  const result = {steps:[],sessionCode:null,checks:{}};

  function ok(name, extra={}) {
    result.steps.push({name, pass:true, ...extra});
    console.log('PASS', name, extra);
  }
  function fail(name, extra={}) {
    result.steps.push({name, pass:false, ...extra});
    throw new Error(name + ' ' + JSON.stringify(extra));
  }

  for (const [p,label] of [[a,'A'],[b,'B'],[v,'V']]) {
    p.on('console', m => {
      if (m.type() === 'error') console.log('BROWSER_CONSOLE_ERROR', label, m.text());
    });
    p.on('pageerror', e => console.log('PAGE_ERROR', label, e.message));
  }

  await a.goto(BASE, {waitUntil:'networkidle'});
  await a.locator('#pn').fill('Handoff-A, Handoff-B, Handoff-C, Handoff-D');
  await a.locator('#f button').click();
  await a.locator('#ql li').nth(3).waitFor();
  ok('A added four players');

  const dl = await Promise.all([
    a.waitForEvent('download'),
    a.locator('#exp').click()
  ]);
  const backup = '/tmp/queuezerotwo-handoff-backup.json';
  await dl[0].saveAs(backup);
  if (!fs.existsSync(backup)) fail('Backup was not exported');
  ok('A exported backup', {path: backup});

  await a.locator('#go').click();
  await a.locator('#courts .sbg[aria-label="Plus point, Team 1"]').first().waitFor();
  ok('A sent four players to court');

  await a.getByRole('button', {name:'Live View'}).click();
  await a.getByRole('dialog').waitFor();
  await a.getByRole('button', {name:'Move host to another device'}).click();
  await a.getByRole('button', {name:'Show code'}).click();
  await a.getByRole('dialog').filter({hasText:'Scan on the new host'}).waitFor();

  const session = await a.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pickleStackState') || '{}');
    return {sid:s.sid, sh:s.sh};
  });
  if (!session.sid || !session.sh) fail('A did not retain Live View identity', session);
  result.sessionCode = session.sid;
  const handoffHash = '#h=' + session.sid + '.' + session.sh;
  ok('A displayed handoff code', {sid:session.sid});

  await v.goto(BASE + '#s=' + session.sid, {waitUntil:'networkidle'});
  await v.getByText('LIVE · CONNECTED').waitFor({timeout:15000});
  const initialViewerScore = await v.locator('#viewer .font-sport').first().innerText();
  if (initialViewerScore !== '0') fail('Viewer did not start at 0', {initialViewerScore});
  ok('Viewer connected at 0');

  await b.goto(BASE, {waitUntil:'networkidle'});
  await b.locator('#impbtn').click();
  await b.locator('#imp').setInputFiles(backup);
  await b.getByRole('button', {name:'Confirm'}).click();
  await b.locator('#ql li').nth(3).waitFor();
  const imported = await b.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pickleStackState') || '{}');
    return {sid:s.sid || '', sh:s.sh || '', queue:s.queue || []};
  });
  if (imported.sid || imported.sh) fail('Import preserved Live View identity unexpectedly', imported);
  if (imported.queue.length !== 4) fail('Import did not restore stack', imported);
  ok('B imported backup before takeover');

  await b.goto(BASE + handoffHash, {waitUntil:'networkidle'});
  await sleep(500);
  if (b.url().includes('#h=')) fail('B address bar still contains handoff fragment', {url:b.url()});
  await b.getByRole('button', {name:'Confirm'}).click();
  await b.getByText('This device is now the host').waitFor({timeout:10000});
  ok('B took over and fragment disappeared', {url:b.url()});

  const beforeOldHostScore = await v.locator('#viewer .font-sport').first().innerText();
  await a.getByRole('dialog').getByRole('button', {name:'Done'}).click().catch(()=>{});
  await a.locator('#courts .sbg[aria-label="Plus point, Team 1"]').first().click();
  await a.getByText('Live View host moved to another device.').waitFor({timeout:10000});
  await sleep(1500);
  const afterOldHostScore = await v.locator('#viewer .font-sport').first().innerText();
  if (afterOldHostScore !== beforeOldHostScore) fail('Viewer moved after old host score change', {beforeOldHostScore,afterOldHostScore});
  ok('Old host was rejected and viewer did not move');

  await b.locator('#courts .sbg[aria-label="Plus point, Team 1"]').first().click();
  await v.locator('#viewer .font-sport').first().waitFor({state:'visible'});
  await expectScore(v, '1');
  ok('New host score reached viewer', {score:'1'});

  await b.goto(BASE + handoffHash, {waitUntil:'networkidle'});
  await sleep(500);
  if (b.url().includes('#h=')) fail('Replay fragment remained in address bar', {url:b.url()});
  await b.getByRole('button', {name:'Confirm'}).click();
  await b.getByText('Handoff failed:').waitFor({timeout:10000});
  ok('Replay of the same handoff code failed');

  result.checks = {
    importFirst: true,
    addressBarCleared: true,
    oldHostRejected: true,
    viewerUnchangedOnOldHost: true,
    newHostUpdatesViewer: true,
    replayFails: true
  };
  console.log('RESULT_JSON ' + JSON.stringify(result));
  await browser.close();
})().catch(async err => {
  console.error('RESULT_JSON ' + JSON.stringify({pass:false,error:err.message}));
  process.exitCode = 1;
});

async function expectScore(page, expected) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const val = await page.locator('#viewer .font-sport').first().innerText().catch(()=>null);
    if (val === expected) return;
    await sleep(250);
  }
  const actual = await page.locator('#viewer .font-sport').first().innerText().catch(()=>null);
  throw new Error('Expected viewer score ' + expected + ', got ' + actual);
}
