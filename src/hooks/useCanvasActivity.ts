'use client';

import { useEffect, useState, type RefObject } from 'react';

/** Stop continuous rendering when the canvas is outside the viewport or its tab is hidden. */
export function useCanvasActivity(ref: RefObject<HTMLElement | null>): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let inViewport = true;
    const sync = () => setActive(inViewport && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [ref]);

  return active;
}
