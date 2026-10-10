import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || '';
const SUPABASE_URL = process.env.TEST_SUPABASE_URL || '';
const TEST_PROJECT_REF = 'yeytqiyhosoyuassjcef';
if (!APP_URL) throw new Error('APP_URL must be a protected Vercel Preview share link; production fallback is intentionally disabled.');
if (new URL(SUPABASE_URL).origin !== 'https://' + TEST_PROJECT_REF + '.supabase.co') {
  throw new Error('TEST_SUPABASE_URL must identify the dedicated QueueZeroTwo test project.');
}
if (new URL(APP_URL).hostname === 'queuezerotwo.vercel.app') {
  throw new Error('The production app is forbidden in the BrowserStack workflow.');
}

const USER = process.env.BROWSERSTACK_USERNAME;
const KEY = process.env.BROWSERSTACK_ACCESS_KEY;
const BUILD = 'QueueZeroTwo Release 1 real-device gate ' + new Date().toISOString();

if (!USER || !KEY) {
  throw new Error('Missing BrowserStack Action secrets. Add BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY; never put credentials in source.');
}
function scrub(value) {
  let text = String(value ?? '');
  if (USER) text = text.split(USER).join('[redacted username]');
  if (KEY) text = text.split(KEY).join('[redacted access key]');
  return text;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function caps(options) {
  const result = {
    browser: options.browser,
    osVersion: options.osVersion,
    deviceName: options.deviceName,
    realMobile: 'true',
    'browserstack.username': USER,
    'browserstack.accessKey': KEY,
    'browserstack.debug': 'true',
    'browserstack.networkLogs': 'true',
    build: BUILD,
    name: options.name,
  };
  return result;
}

async function getSessionId(page, name) {
  try {
    const result = await page.evaluate(() => {}, 'browserstack_executor: {"action":"getSessionDetails"}');
    const details = typeof result === 'string' ? JSON.parse(result) : result;
    if (details && (details.hashed_id || details.session_id || details.id)) {
      return details.hashed_id || details.session_id || details.id;
    }
  } catch {}
  const auth = 'Basic ' + Buffer.from(USER + ':' + KEY).toString('base64');
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const response = await fetch('https://api.browserstack.com/automate/sessions.json?status=running', {
      headers: { authorization: auth },
    });
    if (!response.ok) throw new Error('BrowserStack session lookup failed with HTTP ' + response.status);
    const body = await response.json();
    const sessions = Array.isArray(body) ? body : (body.sessions || []);
    for (const item of sessions) {
      const session = item.automation_session || item;
      if (session.name === name && (session.hashed_id || session.id)) {
        return session.hashed_id || session.id;
      }
    }
    await sleep(1000);
  }
  throw new Error('Unable to identify BrowserStack session: ' + name);
}

async function connectDevice(options) {
  const endpoint = 'wss://cdp.browserstack.com/playwright?caps=' + encodeURIComponent(JSON.stringify(caps(options)));
  const browser = await chromium.connect(endpoint, { timeout: 120000 });
  const context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => {});
    throw new Error('No context returned for real device ' + options.name);
  }
  const page = context.pages()[0] || await context.newPage();
  return { browser, context, page, name: options.name, sessionId: await getSessionId(page, options.name) };
}

async function setNetwork(device, networkProfile) {
  const auth = 'Basic ' + Buffer.from(USER + ':' + KEY).toString('base64');
  const response = await fetch(
    'https://api.browserstack.com/automate/sessions/' + encodeURIComponent(device.sessionId) + '/update_network.json',
    {
      method: 'PUT',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ networkProfile }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error('BrowserStack could not switch device network to ' + networkProfile +
      ' (HTTP ' + response.status + '): ' + body.slice(0, 250));
  }
}

async function markStatus(device, status, reason) {
  if (!device) return;
  const command = 'browserstack_executor: ' + JSON.stringify({
    action: 'setSessionStatus',
    arguments: { status, reason: String(reason).slice(0, 240) },
  });
  try { await device.page.evaluate(() => {}, command); } catch {}
}

async function waitUntil(read, description, timeout = 25000, interval = 500) {
  const deadline = Date.now() + timeout;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (value) return value;
      last = String(value);
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(interval);
  }
  throw new Error('Timed out waiting for ' + description + (last ? ': ' + last.slice(0, 200) : ''));
}

async function networkProbe(page) {
  return page.evaluate(async baseUrl => {
    try {
      const response = await fetch(
        baseUrl + '/auth/v1/health?probe=' + Date.now(),
        { cache: 'no-store' },
      );
      return { reachable: true, status: response.status, online: navigator.onLine };
    } catch (error) {
      return { reachable: false, error: String(error), online: navigator.onLine };
    }
  }, SUPABASE_URL);
}

async function verifyPreviewTarget(page) {
  await ready(page);
  const html = await page.content();
  const config = html.match(/const SB_URL=(["'])(https:\/\/[^"']+)\1,SB_KEY=(["'])([^"']+)\3;/);
  assert.ok(config, 'deployed HTML must contain the inline Supabase config');
  assert.equal(new URL(config[2]).origin, SUPABASE_URL, 'preview HTML must target the dedicated test backend');
  assert.notEqual(new URL(config[2]).origin, 'https://wochetemsnrysnjrgoed.supabase.co', 'production Supabase is forbidden');
  assert.equal(config[2], SUPABASE_URL, 'preview backend URL must exactly match TEST_SUPABASE_URL');
  assert.ok(!config[4].startsWith('sb_secret_'), 'a Supabase secret key must never be embedded in browser code');
  const probe = await networkProbe(page);
  assert.equal(probe.reachable, true, 'dedicated test Supabase endpoint must be reachable from the device');
}

async function ready(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitUntil(() => page.locator('#pn').isVisible(), 'app form ready', 30000);
}

async function setupEight(page, navigate = true) {
  if (navigate) await ready(page);
  await page.locator('#nvs').click();
  await page.locator('#pn').fill('Alpha One,Beta Two,Gamma Three,Delta Four,Echo Five,Fox Six,Golf Seven,Hotel Eight');
  await page.locator('#f button').click();
  await waitUntil(() => page.evaluate(() => S.waiting.length === 8), 'eight test players added');
  await page.getByRole('button', { name: 'Check in all' }).click();
  await waitUntil(() => page.evaluate(() => S.queue.length === 8 && S.waiting.length === 0), 'all test players checked in');
  await page.locator('#nvp').click();
  await page.locator('#go').click();
  await waitUntil(() => page.evaluate(() => S.courts.some(c => c.isActive && c.players.length === 4)), 'court started');
  await page.locator('button[aria-label="Plus point, Team 1"]').first().waitFor({ state: 'visible' });
}

async function confirmDialog(page) {
  await page.getByRole('button', { name: 'Confirm' }).click();
}

async function backupAndImportOnIPhone(page) {
  await page.evaluate(() => {
    localStorage.clear();
    history.replaceState(null, '', location.pathname + location.search);
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await ready(page);
  await page.evaluate(() => {
    window.__backupJson = [];
    sb.rpc = async () => ({ data: null, error: new Error('Isolated backup verification: network writes suppressed') });
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      if (blob instanceof Blob && blob.type === 'application/json') blob.text().then(text => window.__backupJson.push(text));
      return create(blob);
    };
  });

  await setupEight(page, false);
  await page.locator('button[aria-label="Plus point, Team 1"]').first().click();
  await waitUntil(
    () => page.evaluate(() => S.courts.some(c => c.isActive && c.score[0] === 1)),
    'score recorded before backup',
  );
  await page.locator('#rs').click();
  await confirmDialog(page);
  await page.locator('[role="dialog"] .bk').waitFor({ state: 'visible', timeout: 15000 });
  await waitUntil(() => page.evaluate(() => window.__backupJson.length >= 1), 'End session backup JSON generated');
  const backup = await page.evaluate(() => window.__backupJson[0]);
  const parsed = JSON.parse(backup);
  assert.equal(parsed.app, 'QueueZeroTwo');
  assert.equal(parsed.state.ended, true);
  assert.ok(parsed.state.log.length >= 1, 'match log survives in exported backup');
  assert.ok(parsed.state.queue.length >= 4, 'stack survives in exported backup');

  // Safari users have a visible fallback action if the automatic download is blocked.
  await page.locator('[role="dialog"] .bk').click();
  await waitUntil(() => page.evaluate(() => window.__backupJson.length >= 2), 'Save backup fallback generated JSON');

  // Import the exact JSON blob produced by the real Safari page.
  await page.evaluate(() => {
    localStorage.clear();
    history.replaceState(null, '', location.pathname + location.search);
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await ready(page);
  await page.evaluate(() => {
    sb.rpc = async () => ({ data: null, error: new Error('Isolated import verification: network writes suppressed') });
  });
  await page.locator('#imp').setInputFiles({
    name: 'queuezerotwo-end-session-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf8'),
  });
  await confirmDialog(page);
  await waitUntil(
    () => page.evaluate(() => !S.ended && S.log.length >= 1 && S.queue.length >= 4),
    'iPhone Safari imported the exported backup',
  );
  const report = await page.evaluate(() => ({
    ended: !!S.ended,
    queue: S.queue.length,
    log: S.log.length,
    courts: S.courts.length,
    score: Math.max(0, ...S.courts.map(c => c.score[0])),
  }));
  assert.equal(report.ended, false);
  assert.ok(report.queue >= 4);
  assert.ok(report.log >= 1);
  await page.evaluate(() => {
    localStorage.clear();
    clearTimeout(PQRetry);
    clearTimeout(st);
  });
  return report;
}

async function main() {
  let phoneA;
  let phoneB;
  let status = 'failed';
  let reason = 'test did not finish';
  try {
    phoneA = await connectDevice({
      browser: 'safari',
      osVersion: '17',
      deviceName: 'iPhone 15 Pro Max',
      name: 'QueueZeroTwo handoff host - real iPhone Safari',
    });
    phoneB = await connectDevice({
      browser: 'chrome',
      osVersion: '13',
      deviceName: 'Samsung Galaxy S22',
      name: 'QueueZeroTwo replacement host - real Android Chrome',
    });
    console.log('Connected to a real iPhone Safari and Android Chrome device pair.');

    // Validate both real devices have the intended Preview build before any writes.
    await verifyPreviewTarget(phoneA.page);
    await verifyPreviewTarget(phoneB.page);
    const startNetwork = await networkProbe(phoneA.page);
    assert.equal(startNetwork.reachable, true, 'iPhone begins online');
    await setupEight(phoneA.page);
    await phoneA.page.evaluate(() => {
      window.__handoffBackupJson = [];
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = blob => {
        if (blob instanceof Blob && blob.type === 'application/json') {
          blob.text().then(text => window.__handoffBackupJson.push(text));
        }
        return create(blob);
      };
    });

    // Generate a real host identity and obtain the handoff code before going offline.
    await phoneA.page.locator('button[title="Open a read-only live view for players"]').click();
    await waitUntil(() => phoneA.page.locator('[role="dialog"] .ho').isVisible(), 'Live View controls');
    await phoneA.page.locator('[role="dialog"] .ho').click();
    await waitUntil(() => phoneA.page.getByRole('button', { name: 'Show code' }).isVisible(), 'handoff confirmation');
    await phoneA.page.getByRole('button', { name: 'Show code' }).click();
    await waitUntil(() => phoneA.page.getByText('Scan on the new host').isVisible(), 'handoff QR ready');
    const handoff = await phoneA.page.evaluate(() => ({
      sid: S.sid,
      sh: S.sh,
      url: location.origin + location.pathname + '#h=' + S.sid + '.' + S.sh,
    }));
    assert.match(handoff.sid, /^ZZTEST[A-Za-z0-9]{4}$/, 'temporary Live View sessions must use the ZZTEST prefix');
    assert.match(handoff.sh, /^[0-9a-f]{64}$/);
    await phoneA.page.locator('[role="dialog"] [data-x]').first().click();

    await waitUntil(
      () => phoneA.page.evaluate(() => PQ.length === 0),
      'initial publishes drained before disconnect',
      30000,
    );
    await setNetwork(phoneA, 'no-network');
    await waitUntil(async () => {
      const probe = await networkProbe(phoneA.page);
      return probe.reachable === false && probe.online === false;
    }, 'iPhone is truly offline', 60000);

    await phoneA.page.locator('button[aria-label="Plus point, Team 1"]').first().click();
    await waitUntil(
      () => phoneA.page.evaluate(() =>
        S.courts.some(c => c.isActive && c.score[0] === 1) &&
        JSON.parse(localStorage.getItem('queuezerotwo-publish-queue-v1') || '{"items":[]}').items.length >= 1),
      'offline score is present in durable publish queue',
    );
    // Use the actual Export action while offline, then import those exact JSON bytes on phone B.
    if (!(await phoneA.page.locator('#qmenu').isVisible())) await phoneA.page.locator('#mnb').click();
    await phoneA.page.locator('#qmenu #exp').click();
    await waitUntil(
      () => phoneA.page.evaluate(() => window.__handoffBackupJson.length >= 1),
      'offline Export action generated backup JSON',
    );
    const offlineBackup = JSON.parse(await phoneA.page.evaluate(() => window.__handoffBackupJson[0]));
    assert.equal(offlineBackup.app, 'QueueZeroTwo');
    assert.equal(offlineBackup.state.courts.find(c => c.isActive).score[0], 1);
    assert.equal(offlineBackup.state.queue.length, 4);

    // Restore on the new host, then use the displayed handoff URL to rotate authority.
    await ready(phoneB.page);
    await phoneB.page.evaluate(() => {
      localStorage.clear();
      history.replaceState(null, '', location.pathname + location.search);
    });
    await phoneB.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await phoneB.page.evaluate(() => {
      window.__rpcBeforeHandoffImport = sb.rpc;
      sb.rpc = async () => ({ data: null, error: new Error('Suppress publish while staging import') });
    });
    await phoneB.page.locator('#imp').setInputFiles({
      name: 'queuezerotwo-offline-host-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(offlineBackup), 'utf8'),
    });
    await confirmDialog(phoneB.page);
    await waitUntil(
      () => phoneB.page.evaluate(() => S.queue.length === 4 && S.courts.some(c => c.isActive && c.score[0] === 1)),
      'offline state restored on phone B',
    );
    await phoneB.page.evaluate(() => {
      clearTimeout(st);
      clearTimeout(PQRetry);
      PQRetry = null;
      PQ = [];
      PQS = 0;
      savePublishQueue();
      S.sid = '';
      S.sh = '';
      S.ho = false;
      S.hoff = 0;
      persistStateOnly();
      sb.rpc = window.__rpcBeforeHandoffImport;
    });

    await phoneB.page.goto(handoff.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitUntil(() => phoneB.page.getByRole('button', { name: 'Confirm' }).isVisible(), 'takeover requires confirmation');
    await confirmDialog(phoneB.page);
    await waitUntil(
      () => phoneB.page.evaluate(sid => S.sid === sid && !!S.sh && !S.ho &&
        S.courts.some(c => c.isActive && c.score[0] === 1) && S.queue.length === 4, handoff.sid),
      'phone B takes control while preserving the offline score',
      30000,
    );
    const newHost = await phoneB.page.evaluate(() => ({
      sid: S.sid,
      sh: S.sh,
      ho: S.ho,
      queue: S.queue.slice(),
      active: S.courts.filter(c => c.isActive).map(c => ({ players: c.players, score: c.score.slice() })),
      storedState: localStorage.getItem('pickleStackState') || '',
      storedQueue: localStorage.getItem('queuezerotwo-publish-queue-v1') || '',
    }));
    assert.equal(newHost.sid, handoff.sid);
    assert.notEqual(newHost.sh, handoff.sh, 'new host key is rotated');
    assert.equal(newHost.ho, false);
    assert.equal(newHost.queue.length, 4);
    assert.equal(newHost.active[0].score[0], 1);
    assert.equal(newHost.storedState.includes(handoff.sh), false, 'old host key is absent from replacement state');
    assert.equal(newHost.storedQueue.includes(handoff.sh), false, 'old host key is absent from replacement sync queue');

    await setNetwork(phoneA, '4g-lte-good');
    await waitUntil(async () => {
      const probe = await networkProbe(phoneA.page);
      return probe.reachable === true && probe.online === true;
    }, 'old iPhone reconnects', 60000);
    await phoneA.page.evaluate(() => flushPublishQueue());
    await waitUntil(
      () => phoneA.page.evaluate(() =>
        S.ho === true &&
        JSON.parse(localStorage.getItem('queuezerotwo-publish-queue-v1') || '{"items":[]}').items.length === 0 &&
        document.getElementById('ct').textContent.includes('No longer host')),
      'old host rejects stale queue and displays No longer host',
      30000,
    );
    console.log('PASS: real-device offline score, host handoff, new host key, and stale-queue rejection.');

    // End the temporary host session, not any user-owned live session.
    await phoneB.page.locator('#nvp').click();
    await phoneB.page.locator('#rs').click();
    await confirmDialog(phoneB.page);
    await waitUntil(() => phoneB.page.evaluate(() => S.ended === true), 'temporary handoff session ended', 20000);

    const backupReport = await backupAndImportOnIPhone(phoneA.page);
    console.log('PASS: real iPhone Safari backup JSON generation, Save backup fallback, and import.');
    console.log('Backup/import assertions: ' + JSON.stringify(backupReport));
    status = 'passed';
    reason = 'real-device handoff and iPhone backup/import assertions passed';
  } catch (error) {
    reason = scrub(error instanceof Error ? error.message : error);
    console.error('REAL DEVICE TEST FAILED: ' + reason);
    throw error;
  } finally {
    if (phoneA) await setNetwork(phoneA, '4g-lte-good').catch(() => {});
    await markStatus(phoneA, status, reason);
    await markStatus(phoneB, status, reason);
    await Promise.all([phoneA, phoneB].filter(Boolean).map(device => device.browser.close().catch(() => {})));
  }
}

main().catch(error => {
  console.error(scrub(error && error.stack ? error.stack : error));
  process.exitCode = 1;
});
