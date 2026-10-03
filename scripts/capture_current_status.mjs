import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/nguyenphucphu/.gemini/antigravity/brain/2ca1b6ec-6f57-4f8c-82c9-0dc9dec9743b';
const PORT = 9333;

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

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
    '--user-data-dir=/tmp/chrome-status-audit',
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

    const consoleLogs = [];
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({
          type: data.params.type,
          text: data.params.args.map(a => a.value || a.description).join(' ')
        });
      }
    });

    async function capture(name, clip = null) {
      const params = { format: 'png' };
      if (clip) params.clip = clip;
      const res = await send('Page.captureScreenshot', params);
      const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`Saved screenshot: ${filePath}`);
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      return res?.result?.value;
    }

    // 1. DESKTOP VIEWPORT (1440x900)
    console.log('\n--- Auditing Desktop (1440x900) ---');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await evaluate(`window.scrollTo(0, 0)`);
    await new Promise(r => setTimeout(r, 2500)); // wait for 3D load and animations

    await capture('desktop_hero_view');

    // Scroll to see mid sections
    await evaluate(`window.scrollTo(0, 800)`);
    await new Promise(r => setTimeout(r, 1000));
    await capture('desktop_stage_scroll');

    await evaluate(`window.scrollTo(0, 1800)`);
    await new Promise(r => setTimeout(r, 1000));
    await capture('desktop_workshop_console');

    // Check products section
    await evaluate(`
      const prod = document.querySelector('#san-pham') || document.querySelector('[data-section="products"]') || document.querySelector('.products-section');
      if (prod) prod.scrollIntoView({ behavior: 'instant' });
      else window.scrollTo(0, 3200);
    `);
    await new Promise(r => setTimeout(r, 1200));
    await capture('desktop_products_catalog');

    // Scroll to bottom footer
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await new Promise(r => setTimeout(r, 1000));
    await capture('desktop_footer_choice');

    // Desktop diagnostics
    const desktopAudit = await evaluate(`(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      const links = Array.from(document.querySelectorAll('a, button')).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: el.innerText.trim().slice(0, 30),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          ariaLabel: el.getAttribute('aria-label') || el.title || null
        };
      });
      const missingAria = links.filter(l => !l.text && !l.ariaLabel);
      const smallTouchTargets = links.filter(l => l.width > 0 && (l.width < 36 || l.height < 36));

      return {
        overflow,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        missingAriaCount: missingAria.length,
        missingAriaSamples: missingAria.slice(0, 5),
        smallTargetsCount: smallTouchTargets.length,
        smallTargetsSamples: smallTouchTargets.slice(0, 5),
        title: document.title,
      };
    })()`);

    console.log('Desktop Audit Result:', JSON.stringify(desktopAudit, null, 2));

    // 2. MOBILE VIEWPORT (390x844 - iPhone 14)
    console.log('\n--- Auditing Mobile (390x844) ---');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await evaluate(`window.scrollTo(0, 0)`);
    await new Promise(r => setTimeout(r, 1500));

    await capture('mobile_hero_view');

    // Scroll mobile down to see mid sections
    await evaluate(`window.scrollTo(0, 800)`);
    await new Promise(r => setTimeout(r, 800));
    await capture('mobile_scroll_mid');

    // Capture mobile in-theo-file
    await send('Page.navigate', { url: 'http://localhost:3000/in-theo-file' });
    await new Promise(r => setTimeout(r, 2000));
    await capture('mobile_in_theo_file');

    // Capture mobile bo-suu-tap
    await send('Page.navigate', { url: 'http://localhost:3000/bo-suu-tap' });
    await new Promise(r => setTimeout(r, 2000));
    await capture('mobile_bo_suu_tap');

    // 3. DESKTOP IN-THEO-FILE AND BO-SUU-TAP
    console.log('\n--- Auditing Desktop Subpages ---');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:3000/in-theo-file' });
    await new Promise(r => setTimeout(r, 2000));
    await capture('desktop_in_theo_file');

    await send('Page.navigate', { url: 'http://localhost:3000/bo-suu-tap' });
    await new Promise(r => setTimeout(r, 2000));
    await capture('desktop_bo_suu_tap');

    // 4. CHECK PHONG LAB TOUR PAGE
    console.log('\n--- Auditing /phong-lab ---');
    await send('Page.navigate', { url: 'http://localhost:3000/phong-lab' });
    await new Promise(r => setTimeout(r, 2500));
    await capture('desktop_phong_lab_tour');

    // Write diagnostic summary to JSON
    const report = {
      timestamp: new Date().toISOString(),
      desktopAudit,
      mobileAudit,
      consoleLogs: consoleLogs.slice(-20)
    };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'audit_raw_report.json'), JSON.stringify(report, null, 2));
    console.log('Audit complete! Results written to artifact directory.');

  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Audit run error:', err);
  process.exit(1);
});
