'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import gsap from 'gsap';
import type { LabPhase } from '../lab-journey/LabCanvas';
import { 
  ArrowRight, 
  ChevronRight, 
  ChevronLeft, 
  Layers, 
  MonitorCheck, 
  Printer, 
  PackageCheck, 
  Wrench, 
  Sparkles,
  CheckCircle2,
  Maximize2,
  RotateCcw
} from 'lucide-react';

// Tải LabCanvas bất đồng bộ không chặn render SSR
const LabCanvas = dynamic(() => import('../lab-journey/LabCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0B0F14] text-[#A5ADB8] text-xs font-mono">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#EB4037] animate-ping" />
        <span>Đang kết nối không gian xưởng MinhLab...</span>
      </div>
    </div>
  ),
});

interface ProcessStep {
  number: string;
  shortTitle: string;
  title: string;
  location: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: ProcessStep[] = [
  {
    number: '00',
    shortTitle: 'Toàn cảnh',
    title: 'Toàn cảnh không gian xưởng MinhLab',
    location: 'Không gian xưởng',
    description: 'Xem các khu vực kiểm tra file, in 3D và hoàn thiện sản phẩm.',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    number: '01',
    shortTitle: 'Kiểm tra file',
    title: 'Kiểm tra file',
    location: 'Trạm kiểm tra file',
    description: 'Kiểm tra file để phát hiện lỗi trước khi in.',
    icon: <MonitorCheck className="w-4 h-4" />,
  },
  {
    number: '02',
    shortTitle: 'Chuẩn bị',
    title: 'Chuẩn bị thông số',
    location: 'Khu vực chuẩn bị máy in',
    description: 'Chọn vật liệu và thông số in phù hợp với mẫu.',
    icon: <Printer className="w-4 h-4" />,
  },
  {
    number: '03',
    shortTitle: 'Tiến hành in',
    title: 'Tiến hành in',
    location: 'Máy in FDM',
    description: 'Máy in tạo sản phẩm theo từng lớp.',
    icon: <Layers className="w-4 h-4" />,
  },
  {
    number: '04',
    shortTitle: 'Hoàn thiện',
    title: 'Hoàn thiện thủ công',
    location: 'Bàn hoàn thiện',
    description: 'Tháo support, xử lý bề mặt và lắp ráp sản phẩm.',
    icon: <Wrench className="w-4 h-4" />,
  },
  {
    number: '05',
    shortTitle: 'Kiểm định',
    title: 'Kiểm định và đóng gói',
    location: 'Bàn kiểm định',
    description: 'Kiểm tra lần cuối rồi đóng gói sản phẩm.',
    icon: <PackageCheck className="w-4 h-4" />,
  },
];

interface AssemblyPartInfo {
  maxProgress: number;
  code: string;
  tag: string;
  title: string;
  description: string;
}

const ASSEMBLY_PARTS_INFO: AssemblyPartInfo[] = [
  {
    maxProgress: 0.22,
    code: '01/07',
    tag: 'KẾT CẤU CƠ BẢN',
    title: 'Khung phòng và sàn xưởng in',
    description: 'Hệ thống kết cấu kiến trúc xưởng và mặt sàn chống rung đặc thù cho các thiết bị in 3D vận hành ổn định.',
  },
  {
    maxProgress: 0.42,
    code: '02/07',
    tag: 'BÀN KỸ THUẬT',
    title: 'Bàn thao tác và dụng cụ mặt sau',
    description: 'Khu vực đặt nguồn cấp, trạm phụ trợ và các công cụ sửa chữa, bảo dưỡng linh kiện định kỳ.',
  },
  {
    maxProgress: 0.56,
    code: '03/07',
    tag: 'KỆ VẬT TƯ',
    title: 'Kệ cuộn sợi filament & bảo quản',
    description: 'Kệ chuyên dụng chứa các cuộn sợi PLA+, PETG, TPU sấy khô trong môi trường kiểm soát ẩm tiêu chuẩn.',
  },
  {
    maxProgress: 0.72,
    code: '04/07',
    tag: 'CỤM MÁY IN',
    title: 'Cụm máy in FDM & máy Resin',
    description: 'Hệ thống tạo mẫu chính: một máy in FDM đùn sợi 0.12mm sắc nét và một máy in quang hóa Resin độ phân giải cao.',
  },
  {
    maxProgress: 0.82,
    code: '05/07',
    tag: 'TRẠM THIẾT KẾ',
    title: 'Trạm máy tính Design Terminal',
    description: 'Trạm kiểm tra tệp lưới STL, tính toán support và phân bổ đường cắt lớp g-code chuẩn xác.',
  },
  {
    maxProgress: 0.90,
    code: '06/07',
    tag: 'HOÀN THIỆN',
    title: 'Bàn kiểm định & hoàn thiện',
    description: 'Bàn kiểm tra thước kẹp, gọt bavia và lắp ráp các khớp nối Art Toy trước khi đóng gói xuất xưởng.',
  },
  {
    maxProgress: 1.0,
    code: '07/07',
    tag: 'LINH VẬT STUDIO',
    title: 'Khỉ Kỹ Sư MinhLab sẵn sàng',
    description: 'Linh vật kỹ sư xưởng in xuất hiện tại bàn làm việc, sẵn sàng cùng bạn khám phá từng công đoạn chế tác.',
  },
];

function getAssemblyPart(progress: number): AssemblyPartInfo {
  for (const part of ASSEMBLY_PARTS_INFO) {
    if (progress <= part.maxProgress) return part;
  }
  return ASSEMBLY_PARTS_INFO[ASSEMBLY_PARTS_INFO.length - 1];
}

export const LabScrollytelling: React.FC = () => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const replayTweenRef = useRef<gsap.core.Tween | null>(null);

  // Mặc định phòng lab đã lắp ráp hoàn chỉnh ngay khi truy cập (không cần cuộn chuột)
  const [phase, setPhase] = useState<LabPhase>('explore');
  const [assemblyProgress, setAssemblyProgress] = useState(1);
  const [activeStep, setActiveStep] = useState(0); // 0 to 5: Source of truth (0: Toàn cảnh)
  const [isMobile, setIsMobile] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [isWeakDevice, setIsWeakDevice] = useState(false);
  const [isInView, setIsInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Dọn dẹp animation tween khi component unmount
  useEffect(() => {
    return () => {
      if (replayTweenRef.current) {
        replayTweenRef.current.kill();
        replayTweenRef.current = null;
      }
    };
  }, []);

  // Kiểm tra prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes browser, WebGL or remote API state after mount; keep SSR hydration deterministic.
      setReducedMotion(true);
      setPhase('explore');
      setAssemblyProgress(1);
    }
    const listener = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
      if (e.matches) {
        setPhase('explore');
        setAssemblyProgress(1);
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // Nhận diện query param ?step=X, ?assembly=skip hoặc ?progress=X để vào thẳng trạng thái mong muốn
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get('step');
      const assemblyParam = params.get('assembly');
      const progressParam = params.get('progress');

      if (assemblyParam === 'skip' || stepParam !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes browser, WebGL or remote API state after mount; keep SSR hydration deterministic.
        setPhase('explore');
        setAssemblyProgress(1);
      } else if (progressParam !== null) {
        const p = parseFloat(progressParam);
        if (!isNaN(p)) {
          setAssemblyProgress(Math.max(0, Math.min(1, p)));
          if (p >= 0.98) setPhase('explore');
          else setPhase('assembly');
        }
      }
      if (stepParam !== null) {
        const parsed = parseInt(stepParam, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
          setActiveStep(parsed);
        }
      }
    }
  }, []);

  // Nhận diện kích thước màn hình & năng lực phần cứng (Adaptive Tier Detection)
  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    updateViewport();

    const checkCapabilities = () => {
      // Context dò hỗ trợ không được giữ tài nguyên GPU.
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) {
          setWebglFailed(true);
        } else {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
      } catch {
        setWebglFailed(true);
      }

      // Kiểm tra cấu hình thiết bị yếu (Hardware Concurrency <= 2 hoặc Memory < 2GB)
      if (typeof navigator !== 'undefined') {
        const cores = navigator.hardwareConcurrency || 4;
        const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
        if (cores <= 2 || (mem && mem < 2)) {
          setIsWeakDevice(true);
        }
      }
    };
    checkCapabilities();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // Giám sát khi người dùng cuộn tới khu vực xưởng để tối ưu render
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { rootMargin: '100px 0px', threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hỗ trợ điều hướng bằng phím mũi tên trái / phải (chỉ kích hoạt khi ở Explore mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInView || phase !== 'explore') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (activeStep < STEPS.length - 1) {
          e.preventDefault();
          setActiveStep((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (activeStep > 0) {
          e.preventDefault();
          setActiveStep((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep, isInView, phase]);

  // Bỏ qua replay và lập tức chuyển về trạng thái đã ráp hoàn chỉnh
  const handleSkipAssembly = useCallback(() => {
    if (replayTweenRef.current) {
      replayTweenRef.current.kill();
      replayTweenRef.current = null;
    }
    setAssemblyProgress(1);
    setPhase('explore');
  }, []);

  // Tùy chọn xem lại hoạt cảnh ráp tự động (chạy mượt trong 1.8s, tự động không cần cuộn chuột)
  const handleReplayAssembly = useCallback(() => {
    if (reducedMotion || webglFailed || isWeakDevice) return;
    if (replayTweenRef.current) {
      replayTweenRef.current.kill();
    }
    setActiveStep(0);
    setPhase('assembly');
    setAssemblyProgress(0);

    const progressObj = { value: 0 };
    replayTweenRef.current = gsap.to(progressObj, {
      value: 1,
      duration: 1.8,
      ease: 'power2.inOut',
      onUpdate: () => {
        setAssemblyProgress(progressObj.value);
      },
      onComplete: () => {
        setPhase('explore');
        setAssemblyProgress(1);
        replayTweenRef.current = null;
      },
    });
  }, [reducedMotion, webglFailed, isWeakDevice]);

  // Chuyển hướng hoặc cuộn mượt mà đến khu vực bộ sưu tập
  const scrollToCollection = useCallback((e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const el = document.querySelector('#bo-suu-tap');
    if (el) {
      const headerOffset = 70;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    } else {
      router.push('/bo-suu-tap');
    }
  }, [router]);

  const handlePrev = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  }, [activeStep]);

  const handleNext = useCallback(() => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      scrollToCollection();
    }
  }, [activeStep, scrollToCollection]);

  const currentStep = STEPS[activeStep];
  const currentAssemblyPart = getAssemblyPart(assemblyProgress);
  const isAssemblyActive = phase === 'assembly';

  return (
    <section
      id="quy-trinh-lab"
      ref={containerRef}
      className="relative w-full bg-[#0B0F14] text-[#F4F1EA] overflow-hidden border-t border-[#27313C]"
      aria-label="Không gian xưởng in 3D MinhLab"
    >
      {/* Vùng ẩn thông báo cho Screen Reader khi đổi bước */}
      <div className="sr-only" aria-live="polite">
        {isAssemblyActive
          ? `Đang lắp ráp xưởng: ${currentAssemblyPart.title} (${Math.round(assemblyProgress * 100)}%)`
          : `Đang xem Bước ${currentStep.number}: ${currentStep.title}. ${currentStep.description}`}
      </div>

      {/* SÂN KHẤU 3D TOÀN MÀN HÌNH (FULL-WIDTH, KHÔNG KHUNG VIỀN CARD) */}
      <div className="relative w-full min-h-0 overflow-hidden md:flex md:h-[680px] md:flex-col md:justify-between lg:h-[820px] xl:h-[880px]">
        
        {/* Layer WebGL Canvas chiếm trọn sân khấu */}
        <div className="absolute inset-x-0 top-0 z-0 h-[min(54svh,480px)] min-h-[340px] max-h-[480px] pointer-events-none md:inset-0 md:h-auto md:min-h-0 md:max-h-none">
          {!webglFailed && !isWeakDevice ? (
            <LabCanvas
              phase={phase}
              assemblyProgress={assemblyProgress}
              activeStep={activeStep}
              isInView={isInView}
              isMobile={isMobile}
              onFail={() => setWebglFailed(true)}
            />
          ) : (
            /* Khi không có WebGL, hiển thị ảnh chụp xưởng trực quan */
            <div className="relative w-full h-full bg-[#0B0F14]">
              {[0, 1, 2, 3, 4, 5].map((stepIdx) => (
                <div
                  key={stepIdx}
                  className={`absolute inset-0 transition-all duration-700 ease-out ${
                    stepIdx === activeStep
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-105 pointer-events-none'
                  }`}
                  aria-hidden={stepIdx !== activeStep}
                >
                  <Image
                    src="/images/minhlab-lab-resin-v2.png"
                    alt={`Không gian xưởng MinhLab - ${STEPS[stepIdx]?.shortTitle || ''}`}
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority={stepIdx === 0}
                  />
                </div>
              ))}
              <div className="absolute inset-0 bg-[#0B0F14]/25 pointer-events-none" />
            </div>
          )}

          {/* Gradient tinh tế làm mượt mép trên và mép dưới */}
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#0B0F14] to-transparent pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#0B0F14] to-transparent pointer-events-none" />
        </div>

        {/* ============================================================== */}
        {/* HUD TRÊN CÙNG: TIÊU ĐỀ, TRẠNG THÁI & ĐIỀU HƯỚNG */}
        {/* ============================================================== */}
        <div className="absolute inset-x-0 top-[calc(5rem+env(safe-area-inset-top,0px))] z-20 px-3 sm:px-8 max-w-7xl mx-auto w-full flex items-center justify-between gap-2 pointer-events-none md:relative md:inset-auto md:pt-10 md:px-8 md:gap-4">
          
          {/* Định vị khu vực / Trạng thái lắp ráp */}
          <div className="pointer-events-auto flex min-w-0 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-3.5 sm:py-1.5 rounded-lg bg-[#141A21]/90 backdrop-blur-md border border-[#27313C] shadow-subtle">
            <span className={`w-2 h-2 rounded-full ${isAssemblyActive ? 'bg-[#EB4037] animate-pulse' : 'bg-[#EB4037]'}`} />
            <span className="whitespace-nowrap text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
              {isAssemblyActive ? 'LẮP RÁP XƯỞNG' : <><span className="sm:hidden">TOUR</span><span className="hidden sm:inline">KHÔNG GIAN XƯỞNG</span></>}
            </span>
            <span className="hidden sm:inline text-white/20">/</span>
            <span className="min-w-0 truncate text-[11px] sm:text-xs font-mono text-[#F4F1EA]">
              {isAssemblyActive
                ? `${Math.round(assemblyProgress * 100)}%`
                : activeStep === 0
                ? <><span className="sm:hidden">Toàn cảnh</span><span className="hidden sm:inline">Toàn cảnh xưởng</span></>
                : <><span className="sm:hidden">{currentStep.number}/05</span><span className="hidden sm:inline">Bước {currentStep.number} · {currentStep.shortTitle}</span></>}
            </span>
          </div>

          {/* Dải Timeline Nút Bấm Khi Ở Explore Mode */}
          {!isAssemblyActive ? (
            <div className="pointer-events-auto hidden md:flex items-center gap-1.5">
              <nav 
                className="flex items-center gap-1.5 p-1 rounded-xl bg-[#141A21]/90 backdrop-blur-md border border-[#27313C] shadow-subtle"
                aria-label="Chọn góc nhìn toàn cảnh hoặc các bước quy trình"
              >
                {/* Nút Toàn Cảnh Nổi Bật */}
                <button
                  type="button"
                  onClick={() => setActiveStep(0)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB4037] ${
                    activeStep === 0
                      ? 'bg-[#EB4037] text-white font-bold shadow-subtle'
                      : 'text-[#A5ADB8] hover:text-[#F4F1EA] hover:bg-[#0F141A]'
                  }`}
                  aria-pressed={activeStep === 0}
                  aria-label="Toàn cảnh xưởng"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Toàn cảnh</span>
                </button>

                <span className="text-white/20 px-0.5">|</span>

                {STEPS.slice(1).map((step, idx) => {
                  const stepIdx = idx + 1;
                  const isActive = stepIdx === activeStep;
                  return (
                    <button
                      key={step.number}
                      type="button"
                      onClick={() => setActiveStep(stepIdx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB4037] ${
                        isActive
                          ? 'bg-[#EB4037] text-white font-bold shadow-subtle'
                          : 'text-[#A5ADB8] hover:text-[#F4F1EA] hover:bg-[#0F141A]'
                      }`}
                      aria-pressed={isActive}
                      aria-label={`Bước ${step.number}: ${step.title}`}
                    >
                      <span>{step.number}</span>
                      <span className="hidden xl:inline">{step.shortTitle}</span>
                      {idx < STEPS.length - 2 && (
                        <span className="text-white/20 ml-1 hidden xl:inline">—</span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Nút Ráp Lại */}
              {!reducedMotion && (
                <button
                  type="button"
                  onClick={handleReplayAssembly}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141A21]/90 backdrop-blur-md border border-[#27313C] text-xs font-mono text-[#A5ADB8] hover:text-[#C8A261] hover:border-[#C8A261]/40 transition-all shadow-subtle"
                  title="Xem lại hiệu ứng ráp xưởng"
                  aria-label="Xem lại hiệu ứng ráp xưởng"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Ráp lại</span>
                </button>
              )}
            </div>
          ) : (
            /* HUD Thanh Lắp Ráp & Nút Bỏ Qua Intro */
            <div className="pointer-events-auto flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141A21]/80 backdrop-blur-md border border-[#27313C] text-xs font-mono text-[#C8A261]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A261] animate-ping" />
                <span>{currentAssemblyPart.code}</span>
                <span className="text-white/20">·</span>
                <span>{currentAssemblyPart.title}</span>
              </div>

              <button
                type="button"
                onClick={handleSkipAssembly}
                className="px-3.5 py-1.5 rounded-lg bg-[#141A21]/90 hover:bg-[#1A222C] text-[#C8A261] hover:text-[#F4F1EA] text-xs font-mono border border-[#C8A261]/40 hover:border-[#C8A261] transition-all flex items-center gap-1.5 shadow-subtle group min-h-[36px]"
                aria-label="Bỏ qua lắp ráp xưởng, khám phá ngay"
              >
                <span>Bỏ qua intro</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}

          {/* Nút chuyển nhanh sang bộ sưu tập trên mobile */}
          {!isAssemblyActive && (
            <div className="pointer-events-auto shrink-0 md:hidden">
              <button
                type="button"
                onClick={scrollToCollection}
                className="min-h-11 px-2 text-xs text-[#A5ADB8] hover:text-[#F4F1EA] underline underline-offset-2 font-mono"
              >
                Sản phẩm ↓
              </button>
            </div>
          )}

        </div>

        {/* Chừa riêng khung hình 3D trên điện thoại để thẻ hướng dẫn không phủ cảnh. */}
        <div className="h-[min(54svh,480px)] min-h-[340px] max-h-[480px] md:hidden" aria-hidden="true" />

        {/* ============================================================== */}
        {/* HUD DƯỚI CÙNG: CARD THÔNG TIN (ASSEMBLY BLUEPRINT HOẶC EXPLORE) */}
        {/* ============================================================== */}
        <div className="relative z-20 px-3 pt-3 pb-4 sm:px-8 md:pt-0 md:pb-12 max-w-7xl mx-auto w-full flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4 md:gap-6 pointer-events-none">
          
          {isAssemblyActive ? (
            /* CARD THÔNG TIN LẮP RÁP (BLUEPRINT HUD) */
            <div className="pointer-events-auto w-full md:max-w-xl p-4 sm:p-6 rounded-2xl bg-[#141A21]/95 md:bg-[#141A21]/90 backdrop-blur-md border border-[#27313C] shadow-2xl space-y-3 md:space-y-3.5 text-left animate-fadeIn">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#EB4037]/15 text-[#EB4037] border border-[#EB4037]/30 shrink-0">
                    CẤU KIỆN {currentAssemblyPart.code}
                  </span>
                  <span className="text-xs font-mono text-[#C8A261] truncate">
                    {currentAssemblyPart.tag}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#A5ADB8] shrink-0">
                  {Math.round(assemblyProgress * 100)}% hoàn thành
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA] tracking-tight leading-snug">
                {currentAssemblyPart.title}
              </h3>

              <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
                {currentAssemblyPart.description}
              </p>

              {/* Thanh Tiến Trình Gradient Sang Trọng */}
              <div className="pt-2 space-y-2">
                <div className="w-full h-1.5 bg-[#0F141A] rounded-full overflow-hidden border border-[#27313C]">
                  <div
                    className="h-full bg-gradient-to-r from-[#EB4037] via-[#D48955] to-[#C8A261] rounded-full transition-all duration-75 ease-out"
                    style={{ width: `${Math.max(4, Math.min(100, assemblyProgress * 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-[#737D89] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037] animate-pulse" />
                    <span>Đang đồng bộ cấu kiện xưởng tự động...</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSkipAssembly}
                    className="text-xs font-mono text-[#C8A261] hover:text-[#F4F1EA] underline underline-offset-2 flex items-center gap-1"
                  >
                    <span>Khám phá ngay</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* CARD THÔNG TIN CHI TIẾT BƯỚC KHÁM PHÁ HIỆN TẠI */
            <div className="pointer-events-auto w-full md:max-w-xl p-4 sm:p-6 rounded-2xl bg-[#141A21]/95 md:bg-[#141A21]/90 backdrop-blur-md border border-[#27313C] shadow-2xl space-y-3 md:space-y-3.5 text-left animate-fadeIn">
              
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#EB4037]/15 text-[#EB4037] border border-[#EB4037]/30 shrink-0">
                    {activeStep === 0 ? 'TOÀN CẢNH KHÔNG GIAN' : `BƯỚC ${currentStep.number} / 05`}
                  </span>
                  <span className="hidden sm:flex text-xs font-mono text-[#8492BD] items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8492BD] shrink-0" />
                    <span className="truncate">{currentStep.location}</span>
                  </span>
                </div>

                {/* Phím tắt gợi ý */}
                <span className="hidden sm:inline-block text-[10px] font-mono text-[#737D89] shrink-0 whitespace-nowrap">
                  Phím ← →
                </span>
              </div>

              <h3 className="text-lg sm:text-2xl font-bold text-[#F4F1EA] tracking-tight leading-snug">
                {currentStep.title}
              </h3>

              <p className="text-sm sm:text-sm text-[#A5ADB8] leading-relaxed">
                {currentStep.description}
              </p>

              {/* Cụm Điều Khiển [Quay lại] [Tiếp theo / Xem sản phẩm] */}
              <div className="pt-3 border-t border-[#27313C] flex items-center justify-between gap-2 sm:gap-3">
                
                <button
                  type="button"
                  disabled={activeStep === 0}
                  onClick={handlePrev}
                  className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 sm:px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                    activeStep === 0
                      ? 'border-[#27313C]/40 text-[#737D89]/40 cursor-not-allowed bg-transparent'
                      : 'border-[#27313C] bg-[#0F141A] text-[#F4F1EA] hover:bg-[#1A222C]'
                  }`}
                  aria-label="Quay lại"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="sm:hidden">{activeStep === 1 ? 'Toàn cảnh' : 'Trước'}</span>
                  <span className="hidden sm:inline">{activeStep === 1 ? 'Về toàn cảnh' : 'Quay lại'}</span>
                </button>

                <span className="shrink-0 text-[11px] sm:text-xs font-mono text-[#A5ADB8]">
                  <span className="sm:hidden">{activeStep === 0 ? '00/05' : `${currentStep.number}/05`}</span>
                  <span className="hidden sm:inline">{activeStep === 0 ? 'Góc nhìn tổng thể' : `Bước ${activeStep} / 5`}</span>
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors shadow-subtle group"
                  aria-label={
                    activeStep === 0
                      ? 'Bắt đầu xem quy trình'
                      : activeStep === STEPS.length - 1
                      ? 'Xem sản phẩm hoàn thiện'
                      : 'Bước tiếp theo'
                  }
                >
                  <span className="hidden sm:inline">
                    {activeStep === 0
                      ? 'Bắt đầu quy trình (01)'
                      : activeStep === STEPS.length - 1
                      ? 'Xem sản phẩm hoàn thiện'
                      : 'Tiếp theo'}
                  </span>
                  <span className="sm:hidden">{activeStep === STEPS.length - 1 ? 'Sản phẩm' : activeStep === 0 ? 'Bắt đầu' : 'Tiếp'}</span>
                  {activeStep === STEPS.length - 1 ? (
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>

              </div>

            </div>
          )}

          {/* Hộp Thoại Sản Phẩm Xuất Xưởng (Product Reveal Bridge Khi Ở Bước 5 Hoặc Nút Khám Phá) */}
          <div className="pointer-events-auto hidden lg:flex flex-col items-end space-y-2">
            {!isAssemblyActive && activeStep === 5 ? (
              <div className="p-4 rounded-xl bg-[#141A21]/90 backdrop-blur-md border border-[#6F9576]/40 shadow-elevated text-right space-y-1.5 max-w-sm animate-fadeIn">
                <div className="flex items-center justify-end gap-1.5 text-xs font-mono text-[#6F9576]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sản phẩm vừa xuất xưởng</span>
                </div>
                <p className="text-xs text-[#F4F1EA] font-semibold">
                  Mascot Khỉ Kỹ Sư (Signature Art Toy)
                </p>
                <p className="text-[11px] text-[#A5ADB8]">
                  Đã hoàn tất kiểm định mesh, khử bavia và đóng gói tiêu chuẩn.
                </p>
                <button
                  type="button"
                  onClick={scrollToCollection}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-mono text-[#EB4037] hover:text-[#FF5147] transition-colors"
                >
                  <span>Chuyển sang xem bộ sưu tập</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={scrollToCollection}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#141A21]/80 hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] text-xs font-medium border border-[#27313C] transition-colors shadow-subtle backdrop-blur-md"
              >
                <span>Xem các sản phẩm đã hoàn thiện</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#EB4037]" />
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Dải Chọn Bước Nhanh Trên Mobile */}
      <div className="md:hidden px-4 py-3 bg-[#0F141A] border-t border-[#27313C]">
        {isAssemblyActive ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-[#C8A261]">
              Lắp ráp: {Math.round(assemblyProgress * 100)}%
            </span>
            <button
              type="button"
              onClick={handleSkipAssembly}
              className="px-3 py-1.5 rounded-lg bg-[#141A21] text-xs font-mono text-[#F4F1EA] border border-[#27313C]"
            >
              Vào xem ngay →
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {STEPS.map((step, idx) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`px-3 py-2 rounded-lg text-xs font-mono shrink-0 flex items-center gap-1.5 transition-all min-h-[44px] ${
                  idx === activeStep
                    ? 'bg-[#EB4037] text-white font-bold'
                    : 'bg-[#141A21] text-[#A5ADB8] border border-[#27313C]'
                }`}
                aria-pressed={idx === activeStep}
              >
                <span>{step.number}</span>
                <span>{step.shortTitle}</span>
              </button>
            ))}
          </div>
        )}
      </div>

    </section>
  );
};

export default LabScrollytelling;
