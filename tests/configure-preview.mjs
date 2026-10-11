import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const scriptSource = join(here, '..', 'scripts', 'configure-preview.mjs');
const productionUrl = 'https://wochetemsnrysnjrgoed.supabase.co';
const testUrl = 'https://yeytqiyhosoyuassjcef.supabase.co';
const liveCodeGenerator = "const randLiveCode=()=>{const a=new Uint8Array(10);crypto.getRandomValues(a);return Array.from(a,v=>LIVE_ALPH[v%LIVE_ALPH.length]).join('')};";
const originalHtml = "const SB_URL='" + productionUrl + "',SB_KEY='sb_publishable_placeholder';\n" + liveCodeGenerator + '\n';

async function runCase(envOverrides) {
  const dir = await mkdtemp(join(tmpdir(), 'queuezerotwo-preview-guard-'));
  try {
    const scriptPath = join(dir, 'configure-preview.mjs');
    const htmlPath = join(dir, 'index.html');
    await copyFile(scriptSource, scriptPath);
    await writeFile(htmlPath, originalHtml, 'utf8');

    const env = {
      ...process.env,
      VERCEL_ENV: 'preview',
      SB_URL: '',
      SB_KEY: '',
      ...envOverrides
    };

    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath], { cwd: dir, env });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', value => { stdout += value; });
      child.stderr.setEncoding('utf8').on('data', value => { stderr += value; });
      child.on('error', reject);
      child.on('close', code => resolve({ code, stdout, stderr }));
    });

    return { ...output, html: await readFile(htmlPath, 'utf8') };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// With both vars absent, Preview must use the app's supported snapshot-only mode.
const offline = await runCase({});
assert.equal(offline.code, 0, offline.stderr || offline.stdout);
assert.ok(offline.html.includes("const SB_URL='',SB_KEY='';"), 'Offline Preview must clear the production backend config.');
assert.ok(!offline.html.includes(productionUrl), 'Offline Preview must never fall back to Production.');
assert.ok(offline.html.includes("const randLiveCode=()=> 'ZZTEST'+"), 'Offline Preview must keep test-prefixed session codes.');
assert.match(offline.stdout, /snapshot-only mode/);

// When both vars are present, the exact test backend is still required and accepted.
const claims = Buffer.from(JSON.stringify({ role: 'anon', ref: 'yeytqiyhosoyuassjcef' })).toString('base64url');
const fakeAnonJwt = 'eyJhbGciOiJub25lIn0.' + claims + '.test-signature';
const isolated = await runCase({ SB_URL: testUrl, SB_KEY: fakeAnonJwt });
assert.equal(isolated.code, 0, isolated.stderr || isolated.stdout);
assert.ok(isolated.html.includes("const SB_URL=\"" + testUrl + "\",SB_KEY=\"" + fakeAnonJwt + "\";"));
assert.ok(!isolated.html.includes(productionUrl), 'Test Preview must not retain Production URL.');
assert.match(isolated.stdout, /isolated QueueZeroTwo test project/);

// A partially removed pair is a configuration mistake, not an implicit fallback.
const partial = await runCase({ SB_URL: testUrl, SB_KEY: '' });
assert.notEqual(partial.code, 0, 'A half-configured Preview backend must fail closed.');
assert.ok(partial.html.includes(productionUrl), 'Failed configuration must not rewrite the fixture.');
assert.match(partial.stderr, /Set both SB_URL and SB_KEY/);

console.log('Preview backend guard passed: snapshot-only fallback, isolated test backend, and partial-config fail-closed behavior.');
