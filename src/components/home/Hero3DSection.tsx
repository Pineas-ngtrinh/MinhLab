'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { CanvasErrorBoundary, isWebGLAvailable } from '../common/CanvasErrorBoundary';

const Hero3DCanvas = dynamic(() => import('./Hero3DCanvas'), { ssr: false, loading: () => null });

function MascotFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#090D12]">
      <Image src="/images/minhlab-mascot-free.png" alt="Khỉ Kỹ Sư MinhLab" fill sizes="(max-width: 1024px) 100vw, 560px" className="object-contain p-8" />
      <p className="absolute inset-x-4 bottom-4 text-center text-xs text-[#A5ADB8]">Thiết bị chưa hiển thị được 3D. Bạn đang xem ảnh thay thế.</p>
    </div>
  );
}

export function Hero3DSection() {
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);
  const [animate, setAnimate] = useState(true);
  const [is3DReady, setIs3DReady] = useState(false);
  const handle3DLoaded = useCallback(() => setIs3DReady(true), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Probe browser capabilities after hydration.
    setWebGLSupported(isWebGLAvailable());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) setAnimate(false);
    const sync = (event: MediaQueryListEvent) => {
      if (event.matches) setAnimate(false);
    };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!is3DReady) return;
    const timer = window.setTimeout(() => setAnimate(false), 4000);
    return () => window.clearTimeout(timer);
  }, [is3DReady]);

  const scrollToProducts = () => {
    document.getElementById('showroom-san-pham')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  return (
    <section className="studio-hero border-b border-white/[0.06] px-4 pb-4 pt-20 sm:px-8 sm:pb-8 sm:pt-24 lg:pb-12 lg:pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-3 sm:gap-6 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="contents lg:block lg:max-w-xl lg:text-left">
            <div className="order-1 max-w-xl text-left lg:order-none">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.12em] text-[#C8A261] lg:mb-6 lg:text-[11px] lg:tracking-[0.16em]">MinhLab · Xưởng in &amp; phục dựng</p>
            <h1 className="text-[clamp(2rem,5vw,4.5rem)] font-semibold leading-[1.12] tracking-[-0.04em] text-[#F4F1EA] sm:text-[clamp(2.4rem,5vw,4.5rem)] lg:text-[clamp(2.75rem,4vw,3.5rem)]">
              Đồ chơi tuổi thơ,<br /><span className="text-[#EB4037]">được chế tác lại.</span>
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-[#A5ADB8] lg:hidden">Món đồ chơi nhỏ, cả một trời tuổi thơ.</p>
            <p className="mt-6 hidden max-w-md text-base leading-[1.85] text-[#A5ADB8] lg:block">
              Món đồ chơi nhỏ, cả một trời tuổi thơ.
            </p>
            </div>
            <div className="order-3 flex items-center gap-2 lg:order-none lg:mt-8 lg:gap-3">
              <button type="button" onClick={scrollToProducts} aria-label="Khám phá bộ sưu tập" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#EB4037] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] lg:gap-3 lg:px-5 lg:text-sm">
                <span className="lg:hidden">Xem bộ sưu tập</span><span className="hidden lg:inline">Khám phá bộ sưu tập</span> <ArrowDown aria-hidden="true" className="h-4 w-4" />
              </button>
              <Link href="/in-theo-file" aria-label="In từ file của bạn" className="inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-[13px] text-[#F4F1EA] transition-colors hover:text-[#C8A261] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] lg:px-3 lg:text-sm">
                <span className="lg:hidden">Gửi file</span><span className="hidden lg:inline">In từ file của bạn</span> <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <figure className="order-2 m-0 min-w-0 lg:order-none">
            <div id="hero-mascot-stage" className="relative h-[clamp(9rem,calc(100svh_-_25rem),22rem)] sm:h-80 lg:aspect-square lg:h-auto">
              <CanvasErrorBoundary fallback={<MascotFallback />}>
                {webGLSupported !== false && !is3DReady && (
                  <div role="status" className="absolute inset-0 bg-[#090D12]">
                    <Image
                      src="/images/minhlab-mascot-free.png"
                      alt=""
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 560px"
                      className="object-contain p-8"
                    />
                    <span className="absolute inset-x-4 bottom-4 text-center text-xs text-[#A5ADB8]">Đang tải Khỉ Kỹ Sư…</span>
                  </div>
                )}
                {webGLSupported ? (
                  <Hero3DCanvas action="idle" animate={animate} wireframe={false} onLoaded={handle3DLoaded} />
                ) : webGLSupported === false ? <MascotFallback /> : null}
              </CanvasErrorBoundary>
            </div>
            <figcaption className="sr-only">Linh vật Khỉ Kỹ Sư MinhLab</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

export default Hero3DSection;
