import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/nguyenphucphu/.gemini/antigravity/brain/2ca1b6ec-6f57-4f8c-82c9-0dc9dec9743b';
const PORT = 9444;

async function waitForHttp(port, retries = 25) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path: '/json/version' }, (r) => {
          let body = '';
          r.on('data', d => body += d);
          r.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.end();
      });
      return res;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new Error(`Chrome debug port ${port} did not become ready`);
}

async function run() {
  console.log(`Starting headless Chrome on port ${PORT}...`);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome-after-verification',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  try {
    await waitForHttp(PORT);
    console.log('Chrome is ready!');

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

    await send('Page.enable');
    await send('Runtime.enable');

    async function capture(name) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`Saved screenshot: ${filePath}`);
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      return res?.result?.value;
    }

    // 1. DESKTOP HERO & 3D CANVAS (1440x900)
    console.log('\n--- Capturing Desktop Hero & 3D Stage ---');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await evaluate(`window.scrollTo(0, 0)`);
    await new Promise(r => setTimeout(r, 2500)); // wait for Three.js render
    await capture('after_desktop_hero_3d');

    // 2. DESKTOP FEATURED PRODUCTS BENTO GRID
    console.log('\n--- Capturing Desktop Featured Products ---');
    await evaluate(`
      const el = document.getElementById('showroom-san-pham');
      if (el) el.scrollIntoView({ behavior: 'instant' });
      else window.scrollTo(0, 750);
    `);
    await new Promise(r => setTimeout(r, 1200));
    await capture('after_desktop_featured_products');

    // 3. DESKTOP IN-THEO-FILE (3D FDM SLICER PREVIEW)
    console.log('\n--- Capturing Desktop /in-theo-file with 3D Slicer ---');
    await send('Page.navigate', { url: 'http://localhost:3000/in-theo-file' });
    await new Promise(r => setTimeout(r, 2500));
    await capture('after_desktop_in_theo_file_3d_slicer');

    // 4. MOBILE HERO (390x844 - iPhone 14)
    console.log('\n--- Capturing Mobile Hero & 3D ---');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: 'http://localhost:3000/' });
    await new Promise(r => setTimeout(r, 2500));
    await capture('after_mobile_hero_3d');

    // 5. MOBILE BO-SUU-TAP (HEADER OVERLAP VERIFICATION & BOTTOM BAR)
    console.log('\n--- Capturing Mobile /bo-suu-tap (Clean Header & Bottom Bar) ---');
    await send('Page.navigate', { url: 'http://localhost:3000/bo-suu-tap' });
    await new Promise(r => setTimeout(r, 2000));
    await capture('after_mobile_bo_suu_tap_clean_header');

    // 6. MOBILE IN-THEO-FILE (CLEAN HEADER & 3D SLICER)
    console.log('\n--- Capturing Mobile /in-theo-file (Clean Header & 3D Slicer) ---');
    await send('Page.navigate', { url: 'http://localhost:3000/in-theo-file' });
    await new Promise(r => setTimeout(r, 2500));
    await capture('after_mobile_in_theo_file_clean_header');

    console.log('All verification captures completed successfully!');

  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Verification capture error:', err);
  process.exit(1);
});
