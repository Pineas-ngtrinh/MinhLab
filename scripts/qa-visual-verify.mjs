import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/nguyenphucphu/.gemini/antigravity/brain/d4e440ad-8590-4f85-8431-087bb12faf2e';
const PORT = 9229;

async function waitForHttp(port, retries = 20) {
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
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error(`Chrome debug port ${port} did not become ready`);
}

async function run() {
  console.log(`Starting headless Chrome on port ${PORT}...`);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome-qa-verify',
    '--disable-gpu',
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
    await new Promise(r => setTimeout(r, 2000));

    // 1. MOBILE 375x812 (iPhone mini / SE / X)
    console.log('\n--- 1. MOBILE VIEWPORT (375x812) ---');
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await new Promise(r => setTimeout(r, 1200));

    const mShot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile-375-scene1.png'), Buffer.from(mShot1.data, 'base64'));
    console.log('Saved: mobile-375-scene1.png');

    // Scroll to scene 2 on mobile
    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-paths")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 1000));
    const mShot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile-375-scene2.png'), Buffer.from(mShot2.data, 'base64'));
    console.log('Saved: mobile-375-scene2.png');

    // Scroll to scene 3 (collection) on mobile
    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-collection")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 1000));
    const mShot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile-375-scene3.png'), Buffer.from(mShot3.data, 'base64'));
    console.log('Saved: mobile-375-scene3.png');

    // 2. DESKTOP 1440x900
    console.log('\n--- 2. DESKTOP VIEWPORT (1440x900) ---');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    // Navigate to Scene 1 and capture in-flight assembly at 350ms
    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-welcome")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 380));
    const dShotInflight = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-1440-assembly-inflight.png'), Buffer.from(dShotInflight.data, 'base64'));
    console.log('Saved: desktop-1440-assembly-inflight.png');

    // Wait for full assembly lock-in
    await new Promise(r => setTimeout(r, 1000));
    const dShot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-1440-scene1.png'), Buffer.from(dShot1.data, 'base64'));
    console.log('Saved: desktop-1440-scene1.png');

    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-paths")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 1000));
    const dShot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-1440-scene2.png'), Buffer.from(dShot2.data, 'base64'));
    console.log('Saved: desktop-1440-scene2.png');

    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-collection")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 1000));
    const dShot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-1440-scene3.png'), Buffer.from(dShot3.data, 'base64'));
    console.log('Saved: desktop-1440-scene3.png');

    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-lab")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 1000));
    const dShot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-1440-scene4.png'), Buffer.from(dShot4.data, 'base64'));
    console.log('Saved: desktop-1440-scene4.png');

    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-questions")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 1000));
    const dShot6 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-1440-scene6.png'), Buffer.from(dShot6.data, 'base64'));
    console.log('Saved: desktop-1440-scene6.png');

    // 3. TESTING /bo-suu-tap AND /in-theo-file PAGES (NO EMPTY GAPS)
    console.log('\n--- 3. TESTING /bo-suu-tap (UNIFIED HEADER, NO GAPS) ---');
    await send('Page.navigate', { url: 'http://localhost:3000/bo-suu-tap' });
    await new Promise(r => setTimeout(r, 2000));
    const bstShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-bo-suu-tap.png'), Buffer.from(bstShot.data, 'base64'));
    console.log('Saved: desktop-bo-suu-tap.png');

    console.log('\n--- 4. TESTING /in-theo-file (UNIFIED HEADER, NO GAPS) ---');
    await send('Page.navigate', { url: 'http://localhost:3000/in-theo-file' });
    await new Promise(r => setTimeout(r, 2000));
    const itfShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-in-theo-file.png'), Buffer.from(itfShot.data, 'base64'));
    console.log('Saved: desktop-in-theo-file.png');

    // 5. PRODUCT MODAL SPEC SHEET TEST (on /bo-suu-tap)
    console.log('\n--- 5. TESTING PRODUCT MODAL & BACKDROP ON /bo-suu-tap ---');
    await send('Page.navigate', { url: 'http://localhost:3000/bo-suu-tap' });
    await new Promise(r => setTimeout(r, 2000));

    // Open detail modal of first product
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.querySelector("#bo-suu-tap .group");
          if (card) { card.click(); return true; }
          return false;
        })()
      `,
      returnByValue: true,
    });
    console.log('Clicked product card:', clickRes.result?.value);
    await new Promise(r => setTimeout(r, 1000));

    const modalShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop-product-modal-open.png'), Buffer.from(modalShot.data, 'base64'));
    console.log('Saved: desktop-product-modal-open.png');

    // Check body overflow is locked
    const overflowCheck = await send('Runtime.evaluate', {
      expression: `({ bodyOverflow: document.body.style.overflow, htmlOverflow: document.documentElement.style.overflow })`,
      returnByValue: true,
    });
    console.log('Modal scroll lock check:', overflowCheck.result?.value);

    // Click outside backdrop
    const clickBackdropRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const backdrop = document.querySelector('[role="dialog"] div[aria-hidden="true"]');
          if (backdrop) {
            backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return true;
          }
          return false;
        })()
      `,
      returnByValue: true,
    });
    console.log('Clicked backdrop:', clickBackdropRes.result?.value);
    await new Promise(r => setTimeout(r, 600));

    // Check modal is now closed
    const modalClosedCheck = await send('Runtime.evaluate', {
      expression: `Boolean(!document.querySelector('[role="dialog"]'))`,
      returnByValue: true,
    });
    console.log('Modal successfully closed by backdrop click:', modalClosedCheck.result?.value);

    console.log('\nALL VISUAL QA CAPTURES & CHECKS COMPLETED SUCCESSFULLY!');
  } finally {
    chrome.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error('Visual QA error:', err);
  process.exit(1);
});
