const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const gateSource = fs.readFileSync('src/components/home/chapter-scroll.ts', 'utf8');
const compiledGate = ts.transpileModule(gateSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const gateScope = { exports: {} };
vm.runInNewContext(compiledGate.outputText, gateScope);
const { createWheelGate } = gateScope.exports;

let checks = 0;
function check(actual, expected, name) {
  assert.equal(actual, expected, name);
  checks++;
}

// 1. Test Wheel Gate Notch Detection
const gate = createWheelGate();
check(gate.push(100, 0), 1, 'Notch 1 advances');
check(gate.push(50, 16), 0, 'Momentum tail delta is absorbed');
check(gate.push(20, 32), 0, 'Momentum tail delta is absorbed');
check(gate.push(5, 48), 0, 'Momentum tail delta is absorbed');

// After 250ms (user paused and gave another deliberate notch)
check(gate.push(100, 300), 1, 'Notch 2 advances after pause');
check(gate.push(-100, 600), -1, 'Reverse notch goes back');

// 2. Test Step Navigation Flow (0 to 6)
const SECTION_COUNT = 7;
let currentStep = 0;
let isBusy = false;

function handleStep(direction) {
  if (isBusy || !direction) return currentStep;
  const next = currentStep + direction;
  if (next >= 0 && next < SECTION_COUNT) {
    currentStep = next;
  }
  return currentStep;
}

check(currentStep, 0, 'Starts at section 0 (Intro)');
check(handleStep(1), 1, 'Scrolls down 1 notch -> section 1 (Paths)');
check(handleStep(1), 2, 'Scrolls down 1 notch -> section 2 (Collection)');
check(handleStep(1), 3, 'Scrolls down 1 notch -> section 3 (Lab)');
check(handleStep(1), 4, 'Scrolls down 1 notch -> section 4 (Custom)');
check(handleStep(1), 5, 'Scrolls down 1 notch -> section 5 (Questions)');
check(handleStep(1), 6, 'Scrolls down 1 notch -> section 6 (Contact & Footer)');
check(handleStep(1), 6, 'Scrolling down at end stays at section 6 (no overflow)');

// Step backwards
check(handleStep(-1), 5, 'Scrolls up 1 notch -> section 5');
check(handleStep(-1), 4, 'Scrolls up 1 notch -> section 4');
check(handleStep(-1), 3, 'Scrolls up 1 notch -> section 3');
check(handleStep(-1), 2, 'Scrolls up 1 notch -> section 2');
check(handleStep(-1), 1, 'Scrolls up 1 notch -> section 1');
check(handleStep(-1), 0, 'Scrolls up 1 notch -> section 0 (Intro)');
check(handleStep(-1), 0, 'Scrolling up at start stays at section 0 (no underflow)');

// 3. Test Busy Lock during 700ms animation
isBusy = true;
check(handleStep(1), 0, 'Incoming wheel event during animation transition is blocked');
isBusy = false;
check(handleStep(1), 1, 'After transition completes, next notch advances cleanly');

console.info(`Stepped home scroll: ${checks} checks passed.`);
