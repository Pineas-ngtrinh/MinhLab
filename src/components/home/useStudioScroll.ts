'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { chapterDestination, clampChapterScroll, createWheelGate } from './chapter-scroll';

interface StudioScrollOptions {
  paused: boolean;
  count: number;
}

interface ReadingBounds {
  top: number;
  bottom: number;
}

type GestureMode = 'reading' | 'chapter' | 'blocked' | 'native';

interface ScrollGesture extends ReadingBounds {
  mode: GestureMode;
}

function scrollOffset(root: HTMLElement) {
  const configured = parseFloat(getComputedStyle(root).getPropertyValue('--studio-scroll-offset'));
  return Number.isFinite(configured)
    ? configured
    : (document.querySelector('header')?.getBoundingClientRect().height ?? 80);
}

/**
 * Điều khiển hành trình cuộn từng chương (Stepped Chapter Scroll) mượt mà cho MinhLab 3D.
 * - Cho phép mỗi gesture cuộn (chuột, trackpad hoặc vuốt touch) chuyển đúng 1 chương.
 * - Giải phóng khóa tức thì sau khi chuyển cảnh xong để không bị ngắt quãng hành trình.
 * - Khóa cuộn trang nền triệt để khi có modal (Cart, Checkout, Chi tiết sản phẩm).
 * - Cho phép cuộn tự nhiên xuống khu vực FAQ & Footer ở chương cuối cùng.
 */
export function useStudioScroll({ paused, count }: StudioScrollOptions) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const overlayPausedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const targetStepRef = useRef(0);
  const busyRef = useRef(false);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const transitionTokenRef = useRef(0);
  const lastTransitionFinishRef = useRef(-Infinity);
  const gateRef = useRef(createWheelGate());

  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const goToStep = useCallback((index: number) => {
    if (
      !Number.isInteger(index)
      || index < 0
      || index >= count
      || pausedRef.current
      || overlayPausedRef.current
    ) return;

    const root = rootRef.current;
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-studio-section]')).slice(0, count);
    const target = sections[index];
    if (!target) return;

    const token = ++transitionTokenRef.current;
    const story = root.getBoundingClientRect();
    const maximum = Math.max(0, story.height - window.innerHeight);
    const absoluteTop = target.getBoundingClientRect().top + window.scrollY;
    const top = Math.max(0, Math.min(maximum, absoluteTop - (index === 0 ? 0 : scrollOffset(root))));
    const proxy = { y: window.scrollY };

    busyRef.current = true;
    targetStepRef.current = index;
    setActiveStep(index);
    setProgress(count > 1 ? index / (count - 1) : 1);

    const finish = () => {
      if (transitionTokenRef.current !== token) return;
      busyRef.current = false;
      tweenRef.current = null;
      lastTransitionFinishRef.current = performance.now();
      // Nhả khóa gate ngay khi chuyển xong để người dùng có thể cuộn tiếp không bị khựng
      gateRef.current.reset();
    };

    tweenRef.current = gsap.to(proxy, {
      y: top,
      duration: reducedMotionRef.current ? 0 : 0.75,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => {
        window.scrollTo({ top: proxy.y, behavior: 'auto' });
      },
      onComplete: finish,
      onInterrupt: finish,
    });
  }, [count]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-studio-section]')).slice(0, count);
    if (!sections.length) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const gate = gateRef.current;
    let disposed = false;
    let frame = 0;

    // Tắt scroll-behavior: smooth toàn cục để GSAP tween làm chủ hoàn toàn tốc độ cuộn
    const originalHtmlScrollBehavior = document.documentElement.style.getPropertyValue('scroll-behavior');
    document.documentElement.style.setProperty('scroll-behavior', 'auto');

    const updateMotion = () => {
      reducedMotionRef.current = motion.matches;
      setReducedMotion(motion.matches);
      if (motion.matches && tweenRef.current) tweenRef.current.progress(1);
    };

    const isControl = (target: EventTarget | null) => target instanceof Element && Boolean(
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], dialog, header, [data-native-scroll]')
    );

    const visibleOverlays = () => Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"], [aria-modal="true"], dialog[open], #mobile-navigation'
      )
    ).filter(element => (
      element.getClientRects().length > 0
      && !element.hidden
      && element.getAttribute('aria-hidden') !== 'true'
    ));

    const syncOverlays = () => {
      const hasOverlay = visibleOverlays().length > 0;
      overlayPausedRef.current = hasOverlay;

      if (hasOverlay || pausedRef.current) {
        document.documentElement.style.setProperty('overflow', 'hidden');
        if (busyRef.current) {
          tweenRef.current?.kill();
          tweenRef.current = null;
          busyRef.current = false;
        }
      } else {
        document.documentElement.style.removeProperty('overflow');
        document.body.style.setProperty('overflow', 'auto');
      }
    };

    const measure = () => {
      frame = 0;
      if (disposed) return;

      const bounds = root.getBoundingClientRect();
      setVisible(bounds.bottom > window.innerHeight * 0.1);

      if (busyRef.current) return;

      const marker = window.scrollY + scrollOffset(root) + 40;
      let current = 0;
      sections.forEach((section, i) => {
        const top = section.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) current = i;
      });

      targetStepRef.current = current;
      setActiveStep(current);
      setProgress(count > 1 ? current / (count - 1) : 1);
    };

    const scheduleMeasure = () => {
      if (!frame && !disposed) {
        frame = requestAnimationFrame(measure);
      }
    };

    const getNavigation = (direction: number) => {
      const tops = sections.map(el => el.getBoundingClientRect().top + window.scrollY);
      const heights = sections.map(el => el.offsetHeight);
      const inset = scrollOffset(root);
      let index = 0;
      tops.forEach((top, i) => {
        if (top <= window.scrollY + inset + 40) index = i;
      });
      const next = chapterDestination(tops, heights, index, window.scrollY, window.innerHeight, direction, 8);
      return {
        next,
        top: tops[index],
        bottom: Math.max(tops[index], tops[index] + heights[index] - window.innerHeight),
        currentIndex: index,
      };
    };

    const startGesture = (direction: number): ScrollGesture => {
      const { next, top, bottom, currentIndex } = getNavigation(direction);
      const y = window.scrollY;
      const story = root.getBoundingClientRect();
      const insideStory = story.top <= 8 && story.bottom >= window.innerHeight - 8;
      const canRead = bottom > top && (direction > 0 ? y < bottom - 8 : y > top + 8);

      if (busyRef.current) {
        return { top, bottom, mode: 'blocked' };
      }
      // Ở cảnh đầu mà cuộn lên, hoặc ở cảnh cuối mà cuộn xuống -> cho native scroll
      if ((currentIndex === 0 && direction < 0) || (currentIndex === count - 1 && direction > 0 && next === null)) {
        return { top, bottom, mode: 'native' };
      }
      if (!insideStory) {
        return { top, bottom, mode: 'native' };
      }
      if (next !== null) {
        return { top, bottom, mode: 'chapter' };
      }
      if (canRead) {
        return { top, bottom, mode: 'reading' };
      }
      return { top, bottom, mode: 'native' };
    };

    let wheelGesture: ScrollGesture | null = null;

    const onWheel = (event: WheelEvent) => {
      if (
        event.defaultPrevented
        || event.ctrlKey
        || !event.deltaY
        || Math.abs(event.deltaX) > Math.abs(event.deltaY)
        || isControl(event.target)
        || visibleOverlays().length > 0
        || pausedRef.current
      ) return;

      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      const previousGesture = gate.gesture;
      const now = performance.now();
      const direction = gate.push(delta, now);

      // Cho phép khởi tạo lại gesture nếu tween trước đã kết thúc >= 120ms
      // Điều này loại bỏ hoàn toàn cảm giác bị ngắt hành trình khi người dùng liên tục lăn bánh xe chuột
      const tweenFinishedRecently = !busyRef.current && (now - lastTransitionFinishRef.current >= 120);
      if (!wheelGesture || gate.gesture !== previousGesture || (wheelGesture.mode === 'blocked' && tweenFinishedRecently)) {
        wheelGesture = startGesture(Math.sign(delta));
      }

      if (busyRef.current) {
        wheelGesture.mode = 'blocked';
      }

      if (wheelGesture.mode === 'native') return;

      event.preventDefault();

      if (wheelGesture.mode === 'reading') {
        window.scrollTo({
          top: clampChapterScroll(wheelGesture.top, wheelGesture.bottom, window.scrollY, delta),
          behavior: 'instant',
        });
      } else if (wheelGesture.mode === 'chapter' && direction) {
        const { next } = getNavigation(direction);
        wheelGesture.mode = 'blocked';
        if (next !== null) {
          goToStep(next);
        }
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || isControl(event.target)
        || visibleOverlays().length > 0
        || pausedRef.current
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) return;

      if (
        event.target instanceof Element
        && event.target.closest('button, a, summary, [role="button"], [role="slider"], [role="tablist"], [role="listbox"], [role="menu"]')
      ) return;

      let direction = 0;
      if (event.key === 'Home') {
        event.preventDefault();
        goToStep(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        goToStep(count - 1);
        return;
      }
      if (['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey)) {
        direction = 1;
      } else if (['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey)) {
        direction = -1;
      }

      if (!direction) return;

      const { next } = getNavigation(direction);
      const { mode, top, bottom } = startGesture(direction);

      if (mode === 'blocked' || mode === 'chapter') {
        event.preventDefault();
        if (!busyRef.current && !event.repeat && next !== null) {
          goToStep(next);
        }
      } else if (mode === 'reading') {
        event.preventDefault();
        const distance = event.key.startsWith('Arrow') ? 48 : window.innerHeight * 0.5;
        window.scrollTo({
          top: clampChapterScroll(top, bottom, window.scrollY, direction * distance),
          behavior: 'instant',
        });
      }
    };

    let touch: { x: number; y: number; scrollY: number; gesture: ScrollGesture | null } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      touch = event.touches.length === 1 && !isControl(event.target) && visibleOverlays().length === 0 && !pausedRef.current
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, scrollY: window.scrollY, gesture: null }
        : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!touch) return;
      if (event.touches.length !== 1) {
        touch = null;
        return;
      }

      const dy = touch.y - event.touches[0].clientY;
      const dx = touch.x - event.touches[0].clientX;

      if (!touch.gesture) {
        if (Math.max(Math.abs(dy), Math.abs(dx)) < 10) {
          if (dy && Math.abs(dy) >= Math.abs(dx) && startGesture(Math.sign(dy)).mode !== 'native' && event.cancelable) {
            event.preventDefault();
          }
          return;
        }
        touch.gesture = startGesture(Math.sign(dy));
        if (Math.abs(dx) > Math.abs(dy)) {
          touch.gesture.mode = 'native';
        }
      }

      const gesture = touch.gesture;
      if (busyRef.current) {
        gesture.mode = 'blocked';
      }
      if (gesture.mode === 'native') return;

      if (event.cancelable) event.preventDefault();

      if (gesture.mode === 'reading') {
        window.scrollTo({
          top: clampChapterScroll(gesture.top, gesture.bottom, touch.scrollY, dy),
          behavior: 'instant',
        });
        return;
      }

      if (gesture.mode === 'chapter' && Math.abs(dy) > 42) {
        const { next } = getNavigation(Math.sign(dy));
        gesture.mode = 'blocked';
        if (next !== null) {
          goToStep(next);
        }
      }
    };

    const onTouchEnd = () => {
      touch = null;
    };

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(root);
    sections.forEach(s => resizeObserver.observe(s));

    const mutationObserver = new MutationObserver(syncOverlays);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-modal', 'aria-hidden', 'open', 'hidden'],
    });

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);
    motion.addEventListener('change', updateMotion);

    updateMotion();
    syncOverlays();
    measure();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      motion.removeEventListener('change', updateMotion);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      tweenRef.current?.kill();
      tweenRef.current = null;
      busyRef.current = false;
      document.documentElement.style.setProperty('scroll-behavior', originalHtmlScrollBehavior || 'smooth');
      document.documentElement.style.removeProperty('overflow');
    };
  }, [count, goToStep]);

  // Đồng bộ pause khi cart/checkout thay đổi
  useEffect(() => {
    if (paused) {
      document.documentElement.style.setProperty('overflow', 'hidden');
    } else if (!overlayPausedRef.current) {
      document.documentElement.style.removeProperty('overflow');
      document.body.style.setProperty('overflow', 'auto');
    }
  }, [paused]);

  return { rootRef, activeStep, progress, goToStep, reducedMotion, visible };
}
