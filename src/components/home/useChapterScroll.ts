'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { chapterDestination, clampChapterScroll, createWheelGate } from './chapter-scroll';

interface ChapterScrollOptions {
  count: number;
  paused: boolean;
}

interface ReadingBounds { top: number; bottom: number }
type GestureMode = 'reading' | 'chapter' | 'blocked' | 'native';

interface ScrollGesture extends ReadingBounds {
  mode: GestureMode;
}

export function useChapterScroll({ count, paused }: ChapterScrollOptions) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [guided, setGuided] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const tween = useRef<gsap.core.Tween | null>(null);
  const busy = useRef(false);

  const goToStep = useCallback((index: number) => {
    if (!Number.isInteger(index) || index < 0 || index > count) return;
    const root = rootRef.current;
    const sections = root?.querySelectorAll<HTMLElement>('[data-home-chapter]');
    const target = index === count ? document.querySelector('footer') : sections?.[index];
    if (!target) return;
    tween.current?.kill();
    busy.current = true;
    const proxy = { y: window.scrollY };
    const top = target.getBoundingClientRect().top + window.scrollY;
    const finish = () => { busy.current = false; };
    tween.current = gsap.to(proxy, {
      y: Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight)),
      duration: reducedMotion ? 0 : 0.7,
      ease: 'power3.inOut',
      onUpdate: () => window.scrollTo({ top: proxy.y, behavior: 'instant' }),
      onComplete: finish,
      onInterrupt: finish,
    });
  }, [count, reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-home-chapter]'));
    let frame = 0;
    const measure = () => {
      frame = 0;
      const inset = parseFloat(getComputedStyle(root).getPropertyValue('--reading-inset')) || 100;
      const marker = window.scrollY + inset + 40;
      let index = 0;
      sections.forEach((section, i) => {
        if (section.getBoundingClientRect().top + window.scrollY <= marker) index = i;
      });
      setActiveStep(index);
      setVisible(root.getBoundingClientRect().bottom > window.innerHeight * 0.45);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(onScroll);
    resize.observe(root);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      tween.current?.kill();
    };
  }, [count]);

  useEffect(() => {
    if (!guided || paused) {
      tween.current?.kill();
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const gate = createWheelGate();
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-home-chapter]'));
    if (!sections.length) return;
    const isControl = (target: EventTarget | null) => target instanceof Element && Boolean(
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], dialog, header, [data-native-scroll]')
    );
    const hasModal = () => Boolean(document.querySelector('[role="dialog"], [aria-modal="true"], dialog[open]'));
    const getNavigation = (direction: number) => {
      const tops = sections.map(el => el.getBoundingClientRect().top + window.scrollY);
      const heights = sections.map(el => el.offsetHeight);
      const inset = parseFloat(getComputedStyle(root).getPropertyValue('--reading-inset')) || 100;
      let index = 0;
      tops.forEach((top, i) => { if (top <= window.scrollY + inset + 40) index = i; });
      const next = chapterDestination(tops, heights, index, window.scrollY, window.innerHeight, direction, 8);
      return { next, top: tops[index], bottom: Math.max(tops[index], tops[index] + heights[index] - window.innerHeight) };
    };
    const startGesture = (direction: number): ScrollGesture => {
      const { next, top, bottom } = getNavigation(direction);
      const y = window.scrollY;
      const story = root.getBoundingClientRect();
      const insideStory = story.top <= 8 && story.bottom >= window.innerHeight - 8;
      const canRead = bottom > top && (direction > 0 ? y < bottom - 8 : y > top + 8);
      return { top, bottom, mode: busy.current ? 'blocked'
        : !insideStory ? 'native' : next !== null ? 'chapter' : canRead ? 'reading' : 'native' };
    };
    let wheelGesture: ScrollGesture | null = null;
    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY) || isControl(event.target) || hasModal()) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      const previousGesture = gate.gesture;
      const direction = gate.push(delta, performance.now());
      if (!wheelGesture || gate.gesture !== previousGesture) wheelGesture = startGesture(Math.sign(delta));
      if (busy.current) wheelGesture.mode = 'blocked';
      if (wheelGesture.mode === 'native') return;
      event.preventDefault();
      if (wheelGesture.mode === 'reading') {
        window.scrollTo({ top: clampChapterScroll(wheelGesture.top, wheelGesture.bottom, window.scrollY, delta), behavior: 'instant' });
      } else if (wheelGesture.mode === 'chapter' && direction) {
        const { next } = getNavigation(direction);
        wheelGesture.mode = 'blocked';
        if (next !== null) goToStep(next);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isControl(event.target) || hasModal() || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest('button, a, summary, [role="button"], [role="slider"], [role="tablist"], [role="listbox"], [role="menu"]')) return;
      const direction = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey)
        ? 1 : ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction) return;
      const { next } = getNavigation(direction);
      const { mode, top, bottom } = startGesture(direction);
      if (mode === 'blocked' || mode === 'chapter') {
        event.preventDefault();
        if (!busy.current && !event.repeat && next !== null) goToStep(next);
      } else if (mode === 'reading') {
        event.preventDefault();
        const distance = event.key.startsWith('Arrow') ? 48 : window.innerHeight * 0.5;
        window.scrollTo({ top: clampChapterScroll(top, bottom, window.scrollY, direction * distance), behavior: 'instant' });
      }
    };
    let touch: { x: number; y: number; scrollY: number; gesture: ScrollGesture | null } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      touch = event.touches.length === 1 && !isControl(event.target) && !hasModal()
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, scrollY: window.scrollY, gesture: null } : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!touch) return;
      if (event.touches.length !== 1) { touch = null; return; }
      const dy = touch.y - event.touches[0].clientY;
      const dx = touch.x - event.touches[0].clientX;
      if (!touch.gesture) {
        if (Math.max(Math.abs(dy), Math.abs(dx)) < 10) {
          // Cancel the first vertical move before mobile browsers commit to native panning.
          if (dy && Math.abs(dy) >= Math.abs(dx) && startGesture(Math.sign(dy)).mode !== 'native' && event.cancelable) event.preventDefault();
          return;
        }
        touch.gesture = startGesture(Math.sign(dy));
        if (Math.abs(dx) > Math.abs(dy)) touch.gesture.mode = 'native';
      }
      const gesture = touch.gesture;
      if (busy.current) gesture.mode = 'blocked';
      if (gesture.mode === 'native') return;
      if (event.cancelable) event.preventDefault();
      if (gesture.mode === 'reading') {
        window.scrollTo({ top: clampChapterScroll(gesture.top, gesture.bottom, touch.scrollY, dy), behavior: 'instant' });
        return;
      }
      if (gesture.mode === 'chapter' && Math.abs(dy) > 42) {
        const { next } = getNavigation(Math.sign(dy));
        gesture.mode = 'blocked';
        if (next !== null) goToStep(next);
      }
    };
    const onTouchEnd = () => { touch = null; };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      tween.current?.kill();
    };
  }, [goToStep, guided, paused]);

  return { rootRef, activeStep, goToStep, guided, setGuided, reducedMotion, visible };
}
