import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/nguyenphucphu/.gemini/antigravity/brain/d4e440ad-8590-4f85-8431-087bb12faf2e';
const PORT = 9295;

async function run() {
  console.log('Spawning Headless Chrome for Lego Assembly Capture on port', PORT);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome-lego-profile',
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

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  // 1. Desktop 1440x900
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise(r => setTimeout(r, 1500));

  // Switch to Scene 2 (Ba Lối Vào) and capture mid-assembly
  console.log('Navigating to Scene 2 to capture Lego assembly in flight...');
  const btnCount = await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll("nav[data-home-controls] [class*=\'chapterLinks\'] button").length',
    returnByValue: true,
  });
  console.log('Chapter buttons found:', btnCount.result?.value);

  await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll("nav[data-home-controls] [class*=\'chapterLinks\'] button")[1]?.click()',
  });
  // Wait ~280ms for bricks to be mid-air
  await new Promise(r => setTimeout(r, 280));

  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'lego-assembly-in-flight.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: lego-assembly-in-flight.png');

  // Wait for assembly to complete
  await new Promise(r => setTimeout(r, 1200));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'lego-assembly-settled.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: lego-assembly-settled.png');

  // Switch to Scene 4 (Lab) and capture
  console.log('Navigating to Scene 4 (Lab)...');
  await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll("nav[data-home-controls] [class*=\'chapterLinks\'] button")[3]?.click()',
  });
  await new Promise(r => setTimeout(r, 300));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'lego-lab-in-flight.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: lego-lab-in-flight.png');

  await new Promise(r => setTimeout(r, 1200));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'lego-lab-settled.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: lego-lab-settled.png');

  // 2. Mobile 375x812
  console.log('Testing mobile 375x812 Lego assembly...');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send('Runtime.evaluate', {
    expression: 'document.querySelector("#studio-welcome")?.scrollIntoView({ behavior: "instant", block: "start" })',
  });
  await new Promise(r => setTimeout(r, 1000));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'lego-mobile-settled.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: lego-mobile-settled.png');

  chrome.kill();
  console.log('Lego Assembly QA complete!');
}

run().catch((err) => {
  console.error('Lego capture failed:', err);
  process.exit(1);
});
