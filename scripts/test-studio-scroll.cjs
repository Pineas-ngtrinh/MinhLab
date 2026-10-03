const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');

const helperSource = fs.readFileSync('src/components/home/chapter-scroll.ts', 'utf8');
const helperCompiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const helperScope = { exports: {} };
vm.runInNewContext(helperCompiled.outputText, helperScope);

const hookSource = fs.readFileSync('src/components/home/useStudioScroll.ts', 'utf8');
const hookCompiled = ts.transpileModule(hookSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});

let assertions = 0;
const check = (actual, expected, description) => {
  assert.equal(actual, expected, description);
  assertions += 1;
};

function dependenciesChanged(previous, next) {
  if (!previous || previous.length !== next.length) return true;
  return next.some((value, index) => value !== previous[index]);
}

function mountStudio({ reduce = false, paused = false } = {}) {
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];
  let hook;
  let options = { paused, count: 7 };
  let frameId = 0;
  let now = 0;
  let overlays = [];
  let currentAnimation = null;

  const frames = new Map();
  const listeners = new Map();
  const animations = [];
  const resizeObservers = [];
  const mutationObservers = [];

  class Style {
    constructor() { this.values = new Map(); }
    getPropertyValue(property) { return this.values.get(property)?.value ?? ''; }
    getPropertyPriority(property) { return this.values.get(property)?.priority ?? ''; }
    setProperty(property, value, priority = '') { this.values.set(property, { value, priority }); }
    removeProperty(property) { this.values.delete(property); }
  }

  class Target {
    constructor(kind = '') { this.kind = kind; }
    closest(selector) { return this.kind && selector.includes(this.kind) ? this : null; }
  }

  class Overlay {
    constructor() {
      this.hidden = false;
      this.visible = true;
      this.attributes = new Map();
    }
    getClientRects() { return this.visible ? [{}] : []; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
  }

  const html = { style: new Style(), scrollHeight: 7000 };
  const body = { style: new Style() };
  html.style.setProperty('scroll-behavior', 'smooth');
  body.style.setProperty('overflow', 'auto');

  const mediaListeners = new Set();
  const media = {
    matches: reduce,
    addEventListener: (_, callback) => mediaListeners.add(callback),
    removeEventListener: (_, callback) => mediaListeners.delete(callback),
  };

  const windowMock = {
    scrollY: 0,
    innerHeight: 1000,
    matchMedia: () => media,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
    scrollTo: ({ top }) => { windowMock.scrollY = top; },
  };

  const sections = Array.from({ length: 7 }, (_, index) => ({
    getBoundingClientRect: () => ({ top: index * 1000 - windowMock.scrollY }),
  }));
  const root = {
    querySelectorAll: selector => selector === '[data-studio-section]' ? sections : [],
    getBoundingClientRect: () => ({
      top: -windowMock.scrollY,
      bottom: 7000 - windowMock.scrollY,
      height: 7000,
    }),
  };

  const react = {
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => {
        slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
      }];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        slots[index] = { value: callback, dependencies };
      }
      return slots[index].value;
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        pendingEffects.push(() => {
          slots[index].cleanup?.();
          slots[index].cleanup = callback();
        });
      }
    },
  };

  const gsap = {
    to(proxy, animationOptions) {
      const animation = {
        proxy,
        options: animationOptions,
        ended: false,
        kill() {
          if (this.ended) return;
          this.ended = true;
          this.options.onInterrupt?.();
        },
        progress(value) {
          if (value === 1 && !this.ended) {
            this.proxy.y = this.options.y;
            this.options.onUpdate?.();
            this.ended = true;
            this.options.onComplete?.();
          }
          return this;
        },
      };
      animations.push(animation);
      currentAnimation = animation;
      return animation;
    },
  };

  const scope = {
    exports: {},
    require(name) {
      if (name === 'react') return react;
      if (name === 'gsap') return { default: gsap };
      if (name === './chapter-scroll') return helperScope.exports;
      throw new Error(`Unexpected dependency: ${name}`);
    },
    window: windowMock,
    document: {
      documentElement: html,
      body,
      querySelector: () => null,
      querySelectorAll: () => overlays,
    },
    performance: { now: () => now },
    Element: Target,
    WheelEvent: { DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 },
    getComputedStyle: () => ({ getPropertyValue: property => property === '--studio-scroll-offset' ? '80' : '' }),
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; resizeObservers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; mutationObservers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  };

  vm.runInNewContext(hookCompiled.outputText, scope);

  const render = next => {
    options = { ...options, ...next };
    cursor = 0;
    pendingEffects = [];
    hook = scope.exports.useStudioScroll(options);
    hook.rootRef.current = root;
    pendingEffects.forEach(run => run());
    return hook;
  };
  const flush = () => {
    const queued = [...frames.values()];
    frames.clear();
    queued.forEach(callback => callback());
  };

  render();
  flush();
  render();

  return {
    get hook() { return hook; },
    animations,
    listeners,
    html,
    body,
    resizeObservers,
    mutationObservers,
    render,
    flush,
    target: kind => new Target(kind),
    overlay: () => new Overlay(),
    setOverlays(values) {
      overlays = values;
      mutationObservers.forEach(observer => observer.callback());
      flush();
      render();
    },
    setMotion(value) {
      media.matches = value;
      mediaListeners.forEach(callback => callback());
      flush();
      render();
    },
    complete() {
      if (!currentAnimation || currentAnimation.ended) return;
      currentAnimation.proxy.y = currentAnimation.options.y;
      currentAnimation.options.onUpdate?.();
      currentAnimation.ended = true;
      currentAnimation.options.onComplete?.();
      flush();
      render();
    },
    event(name, values = {}, time = now) {
      now = time;
      const event = {
        defaultPrevented: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        shiftKey: false,
        repeat: false,
        cancelable: true,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 0,
        target: new Target(),
        preventDefault() { this.defaultPrevented = true; },
        ...values,
      };
      listeners.get(name)?.(event);
      return event;
    },
    scroll(y) {
      windowMock.scrollY = y;
      listeners.get('scroll')?.();
      flush();
      render();
    },
    unmount() {
      slots.forEach(slot => slot?.cleanup?.());
    },
  };
}

const page = mountStudio();
check(page.listeners.has('wheel'), true, 'Homepage installs a non-native wheel controller');
check(page.listeners.has('touchmove'), true, 'Homepage installs swipe chapter navigation');
check(page.listeners.has('keydown'), true, 'Homepage installs keyboard chapter navigation');
check(page.html.style.getPropertyValue('scroll-behavior'), 'auto', 'Global smooth scrolling cannot compete with the chapter tween');
check(page.hook.activeStep, 0, 'Journey starts at chapter zero');
check(page.hook.progress, 0, 'Progress starts at zero');

check(page.event('wheel', { deltaY: -100 }, 0).defaultPrevented, false, 'Upward input at the first scene remains native');
check(page.animations.length, 0, 'First-scene boundary does not create a tween');

check(page.event('wheel', { deltaY: 100 }, 300).defaultPrevented, true, 'A fresh wheel gesture is captured');
page.render();
check(page.hook.activeStep, 1, 'Scene changes as soon as its transition starts');
check(page.hook.progress, 1 / 6, 'HUD progress advances by one chapter');
check(page.animations.length, 1, 'One gesture starts exactly one tween');
check(page.animations[0].options.duration, 0.75, 'Full-motion page turn lasts 750ms');
page.complete();

check(page.event('wheel', { deltaY: 3000 }, 316).defaultPrevented, true, 'Momentum tail remains captured');
check(page.animations.length, 1, 'A giant momentum delta cannot skip a chapter');
check(page.event('wheel', { deltaY: 100 }, 600).defaultPrevented, true, 'A new gesture starts after the quiet interval');
check(page.animations.length, 2, 'A fresh gesture advances once more');
page.complete();
page.render();
check(page.hook.activeStep, 2, 'Second deliberate gesture reaches chapter two');

check(page.event('wheel', { deltaY: -100 }, 900).defaultPrevented, true, 'Reverse gesture is captured');
page.complete();
page.render();
check(page.hook.activeStep, 1, 'Reverse gesture returns exactly one chapter');

check(page.event('wheel', { deltaY: 40, deltaX: 100 }, 1200).defaultPrevented, false, 'Horizontal trackpad gestures remain native');
check(page.event('wheel', { deltaY: 100, ctrlKey: true }, 1500).defaultPrevented, false, 'Pinch zoom remains native');

const arrow = page.event('keydown', { key: 'ArrowDown' });
check(arrow.defaultPrevented, true, 'Arrow Down advances the story');
page.complete();
check(page.event('keydown', { key: 'PageDown', target: page.target('button') }).defaultPrevented, false, 'Focused controls retain keyboard behavior');

check(page.event('keydown', { key: 'Home' }).defaultPrevented, true, 'Home key is handled');
page.complete();
page.render();
check(page.hook.activeStep, 0, 'Home key returns to the beginning');
check(page.event('keydown', { key: 'End' }).defaultPrevented, true, 'End key is handled');
page.complete();
page.render();
check(page.hook.activeStep, 6, 'End key reaches the final chapter');
check(page.hook.progress, 1, 'Final chapter reports complete progress');
check(page.event('wheel', { deltaY: 100 }, 1800).defaultPrevented, false, 'Downward input at the final scene remains native');

page.event('keydown', { key: 'Home' });
page.complete();
page.event('touchstart', { touches: [{ clientX: 120, clientY: 700 }] });
const swipe = page.event('touchmove', { touches: [{ clientX: 118, clientY: 620 }] });
check(swipe.defaultPrevented, true, 'Vertical swipe is captured for a page turn');
check(page.animations.length > 0, true, 'Swipe starts a chapter tween');
page.complete();
page.render();
check(page.hook.activeStep, 1, 'One swipe advances exactly one scene');
page.event('touchend');

const menu = page.overlay();
page.setOverlays([menu]);
check(page.html.style.getPropertyValue('overflow'), 'hidden', 'Visible overlay locks background scrolling');
const transitionsBeforeOverlayWheel = page.animations.length;
check(page.event('wheel', { deltaY: 100 }, 2200).defaultPrevented, false, 'Overlay retains its own wheel input');
check(page.animations.length, transitionsBeforeOverlayWheel, 'Overlay input cannot move the story');
menu.visible = false;
page.setOverlays([]);
check(page.body.style.getPropertyValue('overflow'), 'auto', 'Closing the overlay restores body overflow');

page.render({ paused: true });
check(page.html.style.getPropertyValue('overflow'), 'hidden', 'Cart or checkout pauses and locks the homepage');
const transitionsBeforePausedJump = page.animations.length;
page.hook.goToStep(3);
check(page.animations.length, transitionsBeforePausedJump, 'Programmatic scene links cannot move behind a modal');
page.render({ paused: false });

page.setMotion(true);
check(page.hook.reducedMotion, true, 'Reduced-motion preference is exposed to the scene');
page.hook.goToStep(2);
check(page.animations.at(-1).options.duration, 0, 'Reduced motion keeps chapter navigation but removes interpolation');
page.complete();

page.scroll(7200);
check(page.hook.visible, false, 'The fixed story world hides after the homepage leaves the viewport');

page.unmount();
check(page.listeners.size, 0, 'Unmounting removes every global listener');
check(page.html.style.getPropertyValue('scroll-behavior'), 'smooth', 'Unmounting restores global scroll behavior');
check(page.resizeObservers.every(observer => observer.disconnected), true, 'Resize observers are disconnected');
check(page.mutationObservers.every(observer => observer.disconnected), true, 'Overlay observers are disconnected');

console.info(`Studio stepped scroll: ${assertions} checks passed.`);
