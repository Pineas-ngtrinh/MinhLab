import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/nguyenphucphu/.gemini/antigravity/brain/d4e440ad-8590-4f85-8431-087bb12faf2e';
const PORT = 9272;

async function run() {
  console.log('Spawning Headless Chrome on port', PORT);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome-qa-profile',
    '--disable-gpu',
    'about:blank',
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const target = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: PORT,
      path: '/json/new?http://localhost:3000',
      method: 'PUT',
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.end();
  });

  console.log('Connected to target:', target.id);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // 1. DESKTOP (1440x900)
  console.log('\n--- CAPTURING DESKTOP (1440x900) ---');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise(r => setTimeout(r, 1200));

  const desktopOverflow = await send('Runtime.evaluate', {
    expression: '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, overflow: document.documentElement.scrollWidth > window.innerWidth })',
    returnByValue: true,
  });
  console.log('Desktop overflow check:', desktopOverflow.result?.value);

  const sections = [
    'studio-welcome',
    'studio-paths',
    'studio-collection',
    'studio-lab',
    'studio-custom',
    'studio-questions',
    'studio-contact',
  ];

  for (const id of sections) {
    await send('Runtime.evaluate', {
      expression: `document.querySelector("#${id}")?.scrollIntoView({ behavior: "instant", block: "start" })`,
    });
    await new Promise(r => setTimeout(r, 800));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACT_DIR, `v2-desktop-${id}.png`);
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved: v2-desktop-${id}.png`);
  }

  // 2. MOBILE (390x844)
  console.log('\n--- CAPTURING MOBILE (390x844) ---');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 1000));

  const mobileOverflow = await send('Runtime.evaluate', {
    expression: '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, overflow: document.documentElement.scrollWidth > window.innerWidth })',
    returnByValue: true,
  });
  console.log('Mobile overflow check:', mobileOverflow.result?.value);

  const mobileSections = ['studio-welcome', 'studio-paths', 'studio-collection', 'studio-lab'];
  for (const id of mobileSections) {
    await send('Runtime.evaluate', {
      expression: `document.querySelector("#${id}")?.scrollIntoView({ behavior: "instant", block: "start" })`,
    });
    await new Promise(r => setTimeout(r, 800));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACT_DIR, `v2-mobile-${id}.png`);
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved: v2-mobile-${id}.png`);
  }

  chrome.kill();
  console.log('\nAll Visual QA Screenshots Captured Successfully!');
}

run().catch((err) => {
  console.error('Visual QA runner failed:', err);
  process.exit(1);
});
