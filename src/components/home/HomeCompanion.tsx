'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import ConsultantMascot, { type MascotAction } from './ConsultantMascot';
import styles from './home-story.module.css';

export interface HomeCompanionProps {
  chapter: number;
  target: string | null;
  waveTrigger: number;
  reducedMotion: boolean;
  paused: boolean;
  active: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Waypoint {
  pos: Point;
  facing: -1 | 1;
  action: MascotAction;
}

/**
 * Smart Free-Roaming Consultant Guide:
 * An autonomous 3D engineer that roams freely across open screen spaces,
 * actively walking, pausing, and inspecting the workshop, while strictly avoiding
 * text, buttons, and card content so customers always have clear visibility.
 */
export default function HomeCompanion({
  chapter,
  target,
  waveTrigger,
  reducedMotion,
  paused,
  active,
}: HomeCompanionProps) {
  const desktopAnchorByChapter = [
    { left: '44vw', top: '60vh' },
    { left: '50vw', top: '20vh' },
    { left: '78vw', top: '22vh' },
    { left: '48vw', top: '30vh' },
    { left: '78vw', top: '24vh' },
    { left: '8vw', top: '72vh' },
    { left: '72vw', top: '26vh' },
  ] as const;
  const desktopAnchor = desktopAnchorByChapter[chapter] ?? desktopAnchorByChapter[0];
  const frameRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Mascot state
  const [action, setAction] = useState<MascotAction>('idle');
  const [facing, setFacing] = useState<-1 | 1>(-1);
  const [actionTrigger, setActionTrigger] = useState<number>(0);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fade companion out during active scrolling on mobile so text is 100% visible
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 300);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Current logical coordinates
  const posRef = useRef<Point>({ x: 800, y: 300 });
  const roamIndexRef = useRef<number>(0);
  const autonomousTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastWaveRef = useRef<number>(waveTrigger);

  // Determine element size based on window width
  const getFrameDimensions = useCallback(() => {
    if (typeof window === 'undefined') return { fw: 110, fh: 140 };
    const w = window.innerWidth;
    if (w < 768) return { fw: 60, fh: 78 };
    if (w <= 1200) return { fw: 95, fh: 120 };
    return { fw: 110, fh: 140 };
  }, []);

  // Compute safe viewport bounds
  const getSafeBounds = useCallback((width?: number, height?: number) => {
    if (typeof window === 'undefined') return { minX: 16, maxX: 1000, minY: 85, maxY: 600 };
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const isMobile = winW < 768;
    const { fw, fh } = getFrameDimensions();
    const useW = width ?? fw;
    const useH = height ?? fh;
    const padX = 16;
    const padTop = isMobile ? 75 : 85;
    const padBottom = isMobile ? 65 : 70;

    return {
      minX: padX,
      maxX: Math.max(padX, winW - useW - padX),
      minY: padTop,
      maxY: Math.max(padTop, winH - useH - padBottom),
    };
  }, [getFrameDimensions]);

  // Clamps a coordinate within safe screen space
  const clampPos = useCallback(
    (x: number, y: number, width?: number, height?: number): Point => {
      const bounds = getSafeBounds(width, height);
      return {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
      };
    },
    [getSafeBounds]
  );

  // Calculate tailored waypoints that ALWAYS stay in open, non-overlapping areas
  const getChapterWaypoints = useCallback(
    (chapterIndex: number): Waypoint[] => {
      if (typeof window === 'undefined') return [];
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const isMobile = winW < 768;
      const { fw, fh } = getFrameDimensions();
      const padTop = isMobile ? 75 : 85;
      const padBottom = isMobile ? 65 : 70;

      // 1. Mobile (< 768px): Roam safely along the bottom corridor above the controls
      if (isMobile) {
        const bottomY = winH - fh - padBottom - 8;
        return [
          { pos: clampPos(winW - fw - 16, bottomY, fw, fh), facing: -1, action: 'idle' },
          { pos: clampPos(16, bottomY, fw, fh), facing: 1, action: 'inspect' },
          { pos: clampPos(Math.round((winW - fw) / 2), bottomY, fw, fh), facing: 1, action: 'point' },
        ];
      }

      // 2. Desktop & Tablet: Verified open-space positions per studio section
      const desktopWaypointsByChapter: Record<number, Waypoint[]> = {
        // 0. Lời chào (Welcome): Lower center & lower right, avoiding hero title & buttons
        0: [
          { pos: { x: Math.round(winW * 0.44), y: Math.min(winH - fh - 95, 660) }, facing: -1, action: 'greet' },
          { pos: { x: Math.min(winW - fw - 40, Math.round(winW * 0.74)), y: Math.min(winH - fh - 100, 620) }, facing: -1, action: 'inspect' },
          { pos: { x: 75, y: Math.min(winH - fh - 95, 680) }, facing: 1, action: 'point' },
        ],
        // 1. Ba lối vào (Destinations): Center-top gap & upper open space
        1: [
          { pos: { x: Math.round(winW * 0.50), y: Math.max(padTop + 20, 175) }, facing: 1, action: 'idle' },
          { pos: { x: Math.min(winW - fw - 40, Math.round(winW * 0.78)), y: Math.max(padTop + 20, 185) }, facing: -1, action: 'point' },
          { pos: { x: 35, y: Math.max(padTop + 20, 220) }, facing: 1, action: 'inspect' },
        ],
        // 2. Bộ sưu tập (Collection): Center open area between heading & description, inspecting product
        2: [
          { pos: { x: Math.round(winW * 0.50), y: Math.max(padTop + 25, 230) }, facing: 1, action: 'inspect' },
          { pos: { x: Math.min(winW - fw - 20, Math.round(winW * 0.94)), y: Math.max(padTop + 25, 200) }, facing: -1, action: 'inspect' },
          { pos: { x: 35, y: Math.max(padTop + 25, 220) }, facing: 1, action: 'point' },
        ],
        // 3. Trong xưởng (Lab): Center column gap between visual & copy
        3: [
          { pos: { x: Math.round(winW * 0.48), y: Math.max(padTop + 25, 240) }, facing: 1, action: 'work' },
          { pos: { x: Math.min(winW - fw - 40, Math.round(winW * 0.85)), y: Math.max(padTop + 25, 180) }, facing: -1, action: 'inspect' },
        ],
        // 4. In theo yêu cầu (Custom print): Center-top open area & right margin
        4: [
          { pos: { x: Math.round(winW * 0.42), y: Math.max(padTop + 20, 160) }, facing: 1, action: 'idle' },
          { pos: { x: Math.min(winW - fw - 30, Math.round(winW * 0.88)), y: Math.max(padTop + 20, 230) }, facing: -1, action: 'point' },
          { pos: { x: 35, y: Math.max(padTop + 20, 210) }, facing: 1, action: 'inspect' },
        ],
        // 5. Giải đáp (FAQ): Left open column below Zalo link
        5: [
          { pos: { x: Math.max(40, Math.round(winW * 0.12)), y: Math.max(padTop + 30, 650) }, facing: 1, action: 'idle' },
          { pos: { x: Math.max(40, Math.round(winW * 0.20)), y: Math.max(padTop + 30, 680) }, facing: 1, action: 'point' },
        ],
        // 6. Kết nối (Contact): Right open area celebrating finished product
        6: [
          { pos: { x: Math.min(winW - fw - 50, Math.round(winW * 0.72)), y: Math.max(padTop + 30, 230) }, facing: -1, action: 'celebrate' },
          { pos: { x: Math.min(winW - fw - 50, Math.round(winW * 0.84)), y: Math.max(padTop + 30, 360) }, facing: -1, action: 'greet' },
        ],
      };

      const waypoints = desktopWaypointsByChapter[chapterIndex] ?? desktopWaypointsByChapter[0];
      return waypoints.map(w => ({
        ...w,
        pos: clampPos(w.pos.x, w.pos.y, fw, fh),
      }));
    },
    [clampPos, getFrameDimensions]
  );

  // Smooth locomotion from current coordinates to destination
  const moveTo = useCallback(
    (
      dest: Point,
      options: {
        duration?: number;
        targetFacing?: -1 | 1;
        arrivalAction?: MascotAction;
        ease?: string;
      } = {}
    ) => {
      const frame = frameRef.current;
      if (!frame) return;

      const { fw, fh } = getFrameDimensions();
      const clamped = clampPos(dest.x, dest.y, fw, fh);

      // Mobile uses a fixed bottom corridor from CSS so the companion never
      // covers copy. Desktop uses explicit viewport pixels for deterministic
      // roaming; this avoids relying on a transform that can be reset by a
      // canvas fallback during WebGL startup.
      if (window.innerWidth < 768) {
        gsap.killTweensOf(frame);
        setAction(options.arrivalAction ?? 'idle');
        return;
      }

      // Read actual current position from GSAP or posRef
      const curX = gsap.getProperty(frame, 'left');
      const curY = gsap.getProperty(frame, 'top');
      const startX = typeof curX === 'number' && !Number.isNaN(curX) ? curX : posRef.current.x;
      const startY = typeof curY === 'number' && !Number.isNaN(curY) ? curY : posRef.current.y;

      const dx = clamped.x - startX;
      const dy = clamped.y - startY;
      const distance = Math.hypot(dx, dy);

      // Kill previous tweens cleanly
      gsap.killTweensOf(frame);

      if (reducedMotion || paused) {
        posRef.current = clamped;
        gsap.set(frame, { left: clamped.x, top: clamped.y });
        setAction(options.arrivalAction ?? 'idle');
        return;
      }

      // Animate walking if distance is noticeable
      if (distance > 12) {
        setFacing(dx >= 0 ? 1 : -1);
        setAction('walk');
        setActionTrigger(v => v + 1);
      }

      // Smooth, natural walking duration
      const duration = options.duration ?? Math.max(1.8, Math.min(3.2, distance / 160));

      gsap.to(frame, {
        left: clamped.x,
        top: clamped.y,
        duration,
        ease: options.ease ?? 'power1.inOut',
        onComplete: () => {
          posRef.current = clamped;
          // When arrived, face inward toward the center of the screen
          const winCenter = window.innerWidth / 2;
          const facingCenter: -1 | 1 = clamped.x < winCenter ? 1 : -1;
          setFacing(options.targetFacing ?? facingCenter);
          setAction(options.arrivalAction ?? 'idle');
          setActionTrigger(v => v + 1);
        },
      });
    },
    [clampPos, getFrameDimensions, reducedMotion, paused]
  );

  // Handle waveTrigger (e.g. user clicked "Chào Khỉ Kỹ Sư")
  useEffect(() => {
    if (waveTrigger > lastWaveRef.current) {
      lastWaveRef.current = waveTrigger;
      setAction('greet');
      setActionTrigger(v => v + 1);

      const timer = setTimeout(() => {
        setAction('idle');
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [waveTrigger]);

  // Autonomous free-roaming loop cycling through the 4 quadrants (Right -> Bottom -> Left -> Top)
  useEffect(() => {
    if (paused || !active || reducedMotion) {
      if (autonomousTimerRef.current) {
        clearTimeout(autonomousTimerRef.current);
        autonomousTimerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const scheduleNextRoam = (delay = 6000) => {
      if (autonomousTimerRef.current) clearTimeout(autonomousTimerRef.current);
      autonomousTimerRef.current = setTimeout(() => {
        if (!isSubscribed || paused || !active) return;
        runAutonomousStep();
      }, delay);
    };

    const runAutonomousStep = () => {
      const waypoints = getChapterWaypoints(chapter);
      if (waypoints.length === 0) {
        scheduleNextRoam(4000);
        return;
      }

      const nextWaypoint = waypoints[roamIndexRef.current % waypoints.length];
      roamIndexRef.current++;

      moveTo(nextWaypoint.pos, {
        duration: 2.4,
        targetFacing: nextWaypoint.facing,
        arrivalAction: nextWaypoint.action,
        ease: 'power1.inOut',
      });

      scheduleNextRoam(6500);
    };

    scheduleNextRoam(3000);

    return () => {
      isSubscribed = false;
      if (autonomousTimerRef.current) clearTimeout(autonomousTimerRef.current);
    };
  }, [chapter, paused, active, reducedMotion, getChapterWaypoints, moveTo]);

  // Mount initialization & chapter transition
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    roamIndexRef.current = 1;
    const waypoints = getChapterWaypoints(chapter);
    const initialWaypoint = waypoints[0];

    if (initialWaypoint) {
      if (!mounted) {
        // Initial setup on mount: set coordinates immediately via GSAP
        posRef.current = initialWaypoint.pos;
        if (window.innerWidth >= 768) {
          gsap.set(frame, { left: initialWaypoint.pos.x, top: initialWaypoint.pos.y });
        }
        setFacing(initialWaypoint.facing);
        setAction(chapter === 0 ? 'greet' : 'idle');
        setMounted(true);
      } else {
        // Smoothly move to new chapter's initial waypoint
        moveTo(initialWaypoint.pos, {
          duration: 1.4,
          targetFacing: initialWaypoint.facing,
          arrivalAction: chapter === 0 ? 'greet' : 'idle',
          ease: 'power2.out',
        });
      }
    }

    const handleResize = () => {
      if (!frameRef.current) return;
      const { fw, fh } = getFrameDimensions();
      const clamped = clampPos(posRef.current.x, posRef.current.y, fw, fh);
      posRef.current = clamped;
      if (window.innerWidth >= 768) {
        gsap.set(frameRef.current, { left: clamped.x, top: clamped.y });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [chapter, mounted, clampPos, getChapterWaypoints, getFrameDimensions, moveTo]);

  return (
    <div
      ref={frameRef}
      className={styles.companion}
      style={{
        // Safe first-paint anchor while the GLB/canvas and roaming effect load.
        // Mobile overrides this with the bottom corridor in home-story.module.css.
        left: desktopAnchor.left,
        top: desktopAnchor.top,
        opacity: active ? (isScrolling ? 0.2 : 1) : 0,
        pointerEvents: 'none',
        zIndex: 35,
        transition: 'opacity 0.25s ease',
      }}
      aria-hidden="true"
    >
      <ConsultantMascot
        action={action}
        facing={facing}
        actionTrigger={actionTrigger}
        reducedMotion={reducedMotion}
        active={active && !paused}
      />
    </div>
  );
}
