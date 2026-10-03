import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/nguyenphucphu/.gemini/antigravity/brain/d4e440ad-8590-4f85-8431-087bb12faf2e';
const PORT = 9288;

async function run() {
  console.log('Spawning Headless Chrome on port', PORT);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome-comprehensive-qa-profile',
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

  // Enable Page and Runtime
  await send('Page.enable');
  await send('Runtime.enable');

  // Wait for initial page load
  await new Promise(r => setTimeout(r, 2000));

  const SECTION_IDS = [
    'studio-welcome',
    'studio-paths',
    'studio-collection',
    'studio-lab',
    'studio-custom',
    'studio-questions',
    'studio-contact',
  ];

  const VIEWPORTS = [
    { name: '1440', width: 1440, height: 900, dsf: 1, mobile: false },
    { name: '1024', width: 1024, height: 768, dsf: 1, mobile: false },
    { name: '768', width: 768, height: 1024, dsf: 2, mobile: false },
    { name: '375', width: 375, height: 812, dsf: 2, mobile: true },
  ];

  const results = {
    overflows: [],
    roamingMascotFound: false,
    cropChecks: [],
    wheelTest: null,
    footerTest: null,
    otherRoutesTest: [],
  };

  // Check if any roaming mascot DOM element exists
  const mascotCheck = await send('Runtime.evaluate', {
    expression: 'Boolean(document.querySelector("[data-mascot-roam], [data-companion], [data-mascot-quadrant]"))',
    returnByValue: true,
  });
  results.roamingMascotFound = mascotCheck.result?.value;
  console.log('Roaming mascot DOM check (should be false):', results.roamingMascotFound);

  // Capture across all viewports
  for (const vp of VIEWPORTS) {
    console.log(`\n=== VIEWPORT ${vp.name} (${vp.width}x${vp.height}) ===`);
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dsf,
      mobile: vp.mobile,
    });
    await new Promise(r => setTimeout(r, 1000));

    // Overflow check
    const overflow = await send('Runtime.evaluate', {
      expression: '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, overflow: document.documentElement.scrollWidth > window.innerWidth })',
      returnByValue: true,
    });
    console.log(`[${vp.name}] Overflow:`, overflow.result?.value);
    results.overflows.push({ viewport: vp.name, ...overflow.result?.value });

    // Capture each section
    for (let i = 0; i < SECTION_IDS.length; i++) {
      const id = SECTION_IDS[i];
      // Navigate to chapter using goToStep or scroll
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const section = document.querySelector("#${id}");
            if (section) {
              section.scrollIntoView({ behavior: "instant", block: "start" });
              // Also trigger click on nav dot if available to sync active chapter state
              const dot = document.querySelector("nav[data-home-controls] button[title='${id}']") 
                || document.querySelectorAll("nav[data-home-controls] .chapterLinks button")[${i}];
              if (dot) dot.click();
            }
          })()
        `,
      });
      await new Promise(r => setTimeout(r, 900));

      // Inspect layout geometry
      const layoutData = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const section = document.querySelector("#${id}");
            const rail = section?.querySelector(".studio_copyRail__*") || section?.querySelector("[class*='copyRail']");
            const heading = section?.querySelector("h1, h2");
            const cta = section?.querySelector("button, a");
            const hud = document.querySelector("[data-home-controls]");
            const stage = document.querySelector("[data-story-assembly]");
            const activePlate = stage?.querySelector("[data-active='true']");
            const img = activePlate?.querySelector("img");
            
            return {
              sectionRect: section ? { width: section.offsetWidth, height: section.offsetHeight } : null,
              railWidth: rail?.offsetWidth ?? 0,
              railRight: rail ? rail.getBoundingClientRect().right : 0,
              headingVisible: heading ? (heading.getBoundingClientRect().bottom <= window.innerHeight && heading.getBoundingClientRect().top >= 0) : false,
              ctaVisible: cta ? (cta.getBoundingClientRect().bottom <= window.innerHeight) : false,
              hudVisible: hud ? (hud.getBoundingClientRect().top < window.innerHeight) : false,
              imgSrc: img?.src ?? null,
              imgObjectPosition: img ? getComputedStyle(img).objectPosition : null,
            };
          })()
        `,
        returnByValue: true,
      });

      console.log(`[${vp.name} - ${id}] railRight: ${layoutData.result?.value?.railRight}px, headingVisible: ${layoutData.result?.value?.headingVisible}, ctaVisible: ${layoutData.result?.value?.ctaVisible}`);

      // Save screenshot for visual QA
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const filename = `qa-${vp.name}-${id}.png`;
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), Buffer.from(shot.data, 'base64'));
    }

    // Capture FAQ / footer section
    await send('Runtime.evaluate', {
      expression: 'document.querySelector("#studio-support")?.scrollIntoView({ behavior: "instant", block: "start" })',
    });
    await new Promise(r => setTimeout(r, 800));
    const supportShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, `qa-${vp.name}-studio-support.png`), Buffer.from(supportShot.data, 'base64'));
    console.log(`[${vp.name}] Saved qa-${vp.name}-studio-support.png`);
  }

  // --- TEST WHEEL GESTURE INTERACTION IN REAL BROWSER ---
  console.log('\n=== TESTING WHEEL GESTURE IN BROWSER ===');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  // Scroll to top
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
  await new Promise(r => setTimeout(r, 500));

  // Check initial chapter
  const getChapter = async () => {
    const res = await send('Runtime.evaluate', {
      expression: 'document.querySelector("[data-home-story]")?.getAttribute("data-active-chapter")',
      returnByValue: true,
    });
    return parseInt(res.result?.value ?? '1', 10);
  };

  const initialChapter = await getChapter();
  console.log('Initial chapter:', initialChapter);

  // Send 1 wheel notch down (deltaY = 100)
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 500,
    y: 500,
    deltaX: 0,
    deltaY: 100,
  });
  // Also send momentum tail right after (like trackpad / smooth mouse)
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 500,
    y: 500,
    deltaX: 0,
    deltaY: 40,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 500,
    y: 500,
    deltaX: 0,
    deltaY: 10,
  });

  // Wait for transition duration (750ms + margin)
  await new Promise(r => setTimeout(r, 1100));

  const afterNotch1 = await getChapter();
  console.log('Chapter after 1 notch + momentum (should be 2):', afterNotch1);
  results.wheelTest = {
    initial: initialChapter,
    afterNotch1,
    advancedExactlyOne: afterNotch1 === 2,
  };

  // Now test reverse wheel notch up
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 500,
    y: 500,
    deltaX: 0,
    deltaY: -100,
  });
  await new Promise(r => setTimeout(r, 1100));
  const afterReverse = await getChapter();
  console.log('Chapter after reverse notch (should be 1):', afterReverse);
  results.wheelTest.afterReverse = afterReverse;
  results.wheelTest.reversedCorrectly = afterReverse === 1;

  // Test reaching chapter 7 and transitioning to #studio-support
  console.log('\n=== TESTING TRANSITION TO FOOTER / SUPPORT ===');
  // Jump to chapter 7
  await send('Runtime.evaluate', {
    expression: 'document.querySelector("#studio-contact")?.scrollIntoView({ behavior: "instant", block: "start" })',
  });
  await new Promise(r => setTimeout(r, 1000));

  const chapter7 = await getChapter();
  console.log('Jumped to chapter 7:', chapter7);

  // Scroll down past chapter 7 towards #studio-support
  await send('Runtime.evaluate', {
    expression: 'window.scrollBy({ top: 400, behavior: "instant" })',
  });
  await new Promise(r => setTimeout(r, 500));

  const scrollYAfterPast7 = await send('Runtime.evaluate', {
    expression: '({ scrollY: window.scrollY, supportTop: document.querySelector("#studio-support")?.getBoundingClientRect().top })',
    returnByValue: true,
  });
  console.log('Scroll position entering support:', scrollYAfterPast7.result?.value);
  results.footerTest = scrollYAfterPast7.result?.value;

  // Test other routes to ensure wheel gate is NOT active
  console.log('\n=== TESTING OTHER ROUTES FOR WHEEL GATE ISOLATION ===');
  const OTHER_ROUTES = ['/bo-suu-tap', '/phong-lab', '/in-theo-file'];
  for (const route of OTHER_ROUTES) {
    await send('Page.navigate', { url: `http://localhost:3000${route}` });
    await new Promise(r => setTimeout(r, 1500));

    const routeCheck = await send('Runtime.evaluate', {
      expression: `({
        hasHomeExperience: Boolean(document.querySelector("[data-home-experience]")),
        hasHomeStory: Boolean(document.querySelector("[data-home-story]")),
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      })`,
      returnByValue: true,
    });
    console.log(`Route [${route}] isolation check:`, routeCheck.result?.value);
    results.otherRoutesTest.push({ route, ...routeCheck.result?.value });
  }

  chrome.kill();
  console.log('\n=== COMPREHENSIVE QA COMPLETE ===');
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error('QA Runner Failed:', err);
  process.exit(1);
});
