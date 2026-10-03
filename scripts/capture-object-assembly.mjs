import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/nguyenphucphu/.gemini/antigravity/brain/d4e440ad-8590-4f85-8431-087bb12faf2e';
const PORT = 9297;

async function run() {
  console.log('Spawning Headless Chrome for Object Assembly Capture on port', PORT);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome-object-profile',
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

  // 1. Desktop 1440x900 - Scene 1 (Exploded Robot Assembly)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Capturing Scene 1 (Origin) object assembly...');
  // Trigger transition to scene 0
  await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll("nav[data-home-controls] [class*=\'chapterLinks\'] button")[0]?.click()',
  });
  await new Promise(r => setTimeout(r, 260));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'object-assembly-scene1-flight.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: object-assembly-scene1-flight.png');

  await new Promise(r => setTimeout(r, 1200));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'object-assembly-scene1-settled.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: object-assembly-scene1-settled.png');

  // 2. Scene 4 (Lab Workshop - 3D Printers Assembly)
  console.log('Capturing Scene 4 (Lab Workshop) object assembly...');
  await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll("nav[data-home-controls] [class*=\'chapterLinks\'] button")[3]?.click()',
  });
  await new Promise(r => setTimeout(r, 280));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'object-assembly-scene4-flight.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: object-assembly-scene4-flight.png');

  await new Promise(r => setTimeout(r, 1200));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'object-assembly-scene4-settled.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: object-assembly-scene4-settled.png');

  // 3. Tablet Portrait 768x1024
  console.log('Capturing Tablet 768px...');
  await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
  await new Promise(r => setTimeout(r, 600));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'object-assembly-tablet-768.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: object-assembly-tablet-768.png');

  // 4. Mobile 375x812
  console.log('Capturing Mobile 375px...');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 600));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'object-assembly-mobile-375.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved: object-assembly-mobile-375.png');

  console.log('All object assembly screenshots captured successfully!');
  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
