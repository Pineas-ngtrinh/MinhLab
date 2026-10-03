const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/components/home/chapter-scroll.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const scope = { exports: {} };
vm.runInNewContext(compiled.outputText, scope);
const { createWheelGate, chapterDestination, clampChapterScroll } = scope.exports;
let assertions = 0;
function check(actual, expected, name) { assert.equal(actual, expected, name); assertions++; }

const wheel = createWheelGate();
check(wheel.push(100, 0), 1, 'A wheel notch advances one chapter');
for (let t = 16; t < 1500; t += 16) check(wheel.push(40, t), 0, 'Momentum cannot skip a chapter');
check(wheel.push(100, 2000), 1, 'A fresh gesture advances again');
check(wheel.push(-100, 2500), -1, 'Reverse gesture goes back');
const trackpad = createWheelGate();
check(trackpad.push(5, 0), 0, 'Small deltas accumulate without native drift');
check(trackpad.push(14, 16), 0, 'Keep accumulating trackpad deltas');
check(trackpad.push(19, 32), 1, 'Threshold advances exactly once');
check(trackpad.push(100, 48), 0, 'Remaining gesture stays consumed');
check(trackpad.gesture, 1, 'Momentum keeps one gesture identifier');
check(trackpad.push(0, 1000), 0, 'Zero wheel events do not unlock momentum');
check(trackpad.gesture, 1, 'Zero events do not start another gesture');
check(trackpad.push(-40, 1100), -1, 'New reverse input starts a fresh gesture');
check(trackpad.gesture, 2, 'Fresh input receives a new identifier');

const tops = [0, 900, 2100];
const heights = [900, 1200, 900];
check(chapterDestination(tops, heights, 0, 0, 900, 1, 8), 1, 'First chapter goes to three destinations');
check(chapterDestination(tops, heights, 0, 0, 900, -1, 8), null, 'No chapter before the beginning');
check(chapterDestination(tops, heights, 1, 900, 900, 1, 8), null, 'Long content remains readable');
check(chapterDestination(tops, heights, 1, 1200, 900, 1, 8), 2, 'Bottom of long chapter advances');
check(chapterDestination(tops, heights, 1, 1100, 900, -1, 8), null, 'Scroll upward inside a long chapter');
check(chapterDestination(tops, heights, 1, 900, 900, -1, 8), 0, 'Top of a chapter returns to previous');
check(chapterDestination(tops, heights, 2, 2100, 900, 1, 8), null, 'Last chapter has no overscroll trap');
check(chapterDestination(tops, heights, 1, 1200, 900, 99, 8), 2, 'Large input cannot skip chapters');
check(chapterDestination(tops, heights, 1, 1200, 900, 0, 8), null, 'No navigation without direction');
check(chapterDestination([], [], 0, 0, 900, 1, 8), null, 'Empty sections are safe');
check(clampChapterScroll(900, 1200, 950, 4000), 1200, 'Large wheel input cannot skip unread chapter content');
check(clampChapterScroll(900, 1200, 1000, -4000), 900, 'Reverse reading stops at the same chapter top');

// Exercise the real hook's event handlers with deterministic geometry and animation.
const hookSource = fs.readFileSync('src/components/home/useChapterScroll.ts', 'utf8');
const hookCompiled = ts.transpileModule(hookSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
function mountScroll({ paused = false } = {}) {
  const effects = [];
  const listeners = new Map();
  let now = 0;
  let animation = null;
  let modal = false;
  let transitions = 0;
  const windowMock = {
    scrollY: 0, innerHeight: 900,
    scrollTo({ top }) { this.scrollY = top; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
  };
  class Target {
    constructor(kind = '') { this.kind = kind; }
    closest(selector) { return this.kind && selector.split(', ').includes(this.kind) ? this : null; }
  }
  const sections = tops.map((top, i) => ({ offsetHeight: heights[i], getBoundingClientRect: () => ({ top: top - windowMock.scrollY }) }));
  const root = {
    querySelectorAll: () => sections,
    getBoundingClientRect: () => ({ top: -windowMock.scrollY, bottom: 3000 - windowMock.scrollY }),
  };
  const hookScope = {
    exports: {},
    require(name) {
      if (name === './chapter-scroll') return scope.exports;
      if (name === 'react') return {
        useCallback: callback => callback,
        useRef: current => ({ current }),
        useState: initial => [initial, () => {}],
        useEffect: effect => effects.push(effect),
      };
      if (name === 'gsap') return { default: { to(proxy, options) {
        transitions += 1;
        animation = { proxy, options };
        return { kill: () => options.onInterrupt() };
      } } };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
    window: windowMock,
    document: { documentElement: { scrollHeight: 3000 }, querySelector: () => modal ? {} : null },
    performance: { now: () => now },
    Element: Target,
    getComputedStyle: () => ({ getPropertyValue: () => '100' }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    ResizeObserver: class { observe() {} disconnect() {} },
  };
  vm.runInNewContext(hookCompiled.outputText, hookScope);
  const hook = hookScope.exports.useChapterScroll({ count: 3, paused });
  hook.rootRef.current = root;
  const cleanups = effects.map(effect => effect());
  return {
    window: windowMock, listeners,
    get transitions() { return transitions; },
    complete() {
      if (!animation) return;
      animation.proxy.y = animation.options.y;
      animation.options.onUpdate();
      animation.options.onComplete();
      animation = null;
    },
    event(name, values = {}, time = now) {
      now = time;
      const event = {
        defaultPrevented: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false,
        deltaMode: 0, deltaX: 0, deltaY: 0, target: new Target(), cancelable: true, repeat: false,
        preventDefault() { this.defaultPrevented = true; },
        ...values,
      };
      listeners.get(name)?.(event);
      return event;
    },
    target: kind => new Target(kind),
    setModal: open => { modal = open; },
    unmount: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}

const page = mountScroll();
check(page.event('wheel', { deltaY: 100 }, 0).defaultPrevented, true, 'First wheel is captured for a page turn');
check(page.transitions, 1, 'First wheel starts one transition');
page.complete();
check(page.window.scrollY, 900, 'First wheel lands at the three destinations chapter');
page.event('wheel', { deltaY: 100 }, 16);
check(page.window.scrollY, 900, 'Momentum cannot scroll inside the newly entered tall chapter');
page.event('wheel', { deltaY: 100 }, 300);
check(page.window.scrollY, 1000, 'Fresh gesture reads tall chapter content');
page.event('wheel', { deltaY: 3000 }, 316);
check(page.window.scrollY, 1200, 'Giant reading delta stops at the chapter bottom');
page.event('wheel', { deltaY: 100 }, 332);
check(page.transitions, 1, 'Reading momentum cannot immediately turn the next page');
page.event('wheel', { deltaY: 100 }, 600);
page.complete();
check(page.window.scrollY, 2100, 'A new gesture advances after the content is read');
page.event('wheel', { deltaY: -100 }, 900);
page.complete();
check(page.window.scrollY, 900, 'Reverse gesture returns to the previous scene');

page.setModal(true);
check(page.event('wheel', { deltaY: 100 }, 1200).defaultPrevented, false, 'Modal does not lose wheel input to home');
check(page.event('keydown', { key: 'PageDown' }).defaultPrevented, false, 'Modal does not lose keyboard input to home');
page.setModal(false);
check(page.event('keydown', { key: 'ArrowDown', target: page.target('button') }).defaultPrevented, false, 'Focused button retains its keyboard behavior');
check(page.event('keydown', { key: 'PageDown', target: page.target('a') }).defaultPrevented, false, 'Focused link retains its keyboard behavior');
check(page.event('wheel', { deltaY: 40, deltaX: 100 }, 1500).defaultPrevented, false, 'Horizontal gestures are not captured');
check(page.event('wheel', { deltaY: 100, ctrlKey: true }, 1800).defaultPrevented, false, 'Pinch zoom is not captured');

page.event('touchstart', { touches: [{ clientX: 100, clientY: 700 }] });
check(page.event('touchmove', { touches: [{ clientX: 100, clientY: 695 }] }).defaultPrevented, true, 'First vertical touch movement cancels native panning');
page.event('touchmove', { touches: [{ clientX: 100, clientY: 200 }] });
check(page.window.scrollY, 1200, 'One long swipe stops at the bottom of the reading scene');
page.event('touchmove', { touches: [{ clientX: 100, clientY: 0 }] });
check(page.window.scrollY, 1200, 'The same swipe cannot skip onward');
page.event('touchend');
page.event('touchstart', { touches: [{ clientX: 100, clientY: 700 }] });
page.event('touchmove', { touches: [{ clientX: 100, clientY: 620 }] });
page.complete();
check(page.window.scrollY, 2100, 'A new swipe turns to the next scene');
page.event('touchmove', { touches: [{ clientX: 100, clientY: 400 }] });
check(page.window.scrollY, 2100, 'A handled swipe stays consumed after animation ends');
page.event('touchend');
page.unmount();
check(page.listeners.size, 0, 'Leaving home removes every global event listener');
const pausedPage = mountScroll({ paused: true });
check(pausedPage.listeners.has('wheel'), false, 'Cart or checkout pauses stepped wheel control');
check(pausedPage.listeners.has('keydown'), false, 'Cart or checkout pauses stepped keyboard control');
pausedPage.unmount();
console.info(`Home chapter controls: ${assertions} checks passed.`);
