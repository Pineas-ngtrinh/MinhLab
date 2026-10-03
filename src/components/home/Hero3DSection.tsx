'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, RotateCw, Box, Sparkles, Layers, ShieldCheck } from 'lucide-react';
import type { HeroMascotAction } from './Hero3DCanvas';
import { CanvasErrorBoundary, isWebGLAvailable } from '../common/CanvasErrorBoundary';

// Fallback tĩnh khi thiết bị không hỗ trợ WebGL
function MascotFallback() {
  return (
    <div className="relative w-full h-full bg-[#090D12] overflow-hidden flex items-center justify-center">
      <Image
        src="/images/minhlab-mascot-free-v2.png"
        alt="MinhLab Mascot Art Toy"
        fill
        priority
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-contain p-6"
      />
    </div>
  );
}

// Load Three.js 3D Canvas dynamically on client side
const Hero3DCanvas = dynamic(() => import('./Hero3DCanvas'), {
  ssr: false,
  loading: () => <MascotFallback />,
});

export const Hero3DSection: React.FC = () => {
  const [mascotAction, setMascotAction] = useState<HeroMascotAction>('idle');
  const [actionTrigger, setActionTrigger] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [is3DLoaded, setIs3DLoaded] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
  }, []);

  const triggerAction = (action: HeroMascotAction) => {
    setMascotAction(action);
    setActionTrigger((prev) => prev + 1);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative w-full pt-28 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 px-4 sm:px-8 border-b border-white/[0.06] overflow-hidden bg-[#08090C]">
      <div className="max-w-6xl mx-auto w-full flex flex-col items-center text-center">
        
        {/* ============================================================== */}
        {/* 1. EDITORIAL HEADLINE & INTRODUCTION (CINEMATIC VOID)          */}
        {/* ============================================================== */}
        <div className="max-w-3xl space-y-6 sm:space-y-7">
          {/* Eyebrow badge in mono */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] sm:text-[11px] font-mono tracking-wider sm:tracking-widest text-[#A5ADB8] uppercase max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037] animate-pulse shrink-0" />
            <span className="truncate">№ 00 / PROTOTYPE STUDIO · IN 3D FDM<span className="hidden sm:inline"> &amp; ART TOY ĐỘC BẢN</span></span>
          </div>

          {/* Display Heading — Film title register with whisper-tight tracking */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-[-0.035em] text-[#F4F1EA] leading-[1.04]">
            Từ ý tưởng.<br />
            <span className="text-[#EB4037]">Đến vật thể.</span>
          </h1>

          {/* Subheading — Concise, high readability */}
          <p className="text-sm sm:text-base lg:text-lg text-[#A5ADB8] leading-relaxed max-w-2xl mx-auto font-normal">
            Một xưởng nhỏ cho những ý tưởng không nhỏ. Khám phá tủ đồ chơi Art Toy voxel độc bản, ghé thăm phòng lab in 3D thực tế, hoặc gửi file để MinhLab gia công bản vẽ kỹ thuật của riêng bạn.
          </p>

          {/* Action Buttons — Minimalist pills */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 pt-2 w-full max-w-xs sm:max-w-none mx-auto">
            <button
              type="button"
              onClick={() => scrollToSection('showroom-san-pham')}
              onMouseEnter={() => triggerAction('greet')}
              className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 rounded-full bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
            >
              <span>Khám phá bộ sưu tập</span>
              <ArrowDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </button>

            <Link
              href="/in-theo-file"
              onMouseEnter={() => triggerAction('inspect')}
              className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#F4F1EA] text-xs sm:text-sm font-medium border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200 active:scale-95 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
            >
              <span>Bắt đầu với file của bạn</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#C8A261] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. SÂN KHẤU 3D TIÊU ĐIỂM (CINEMATIC 3D FOCAL STAGE)             */}
        {/* ============================================================== */}
        <div className="w-full max-w-4xl mt-10 sm:mt-14 relative flex flex-col items-center">
          
          {/* Vùng sân khấu Three.js WebGL không viền hộp — mascot nổi trực tiếp trên nền xưởng */}
          <div className="w-full h-[380px] sm:h-[500px] lg:h-[580px] relative select-none cursor-grab active:cursor-grabbing">
            <CanvasErrorBoundary fallback={<MascotFallback />}>
              {webGLSupported ? (
                <Hero3DCanvas
                  action={mascotAction}
                  actionTrigger={actionTrigger}
                  wireframe={wireframe}
                  autoRotate={autoRotate}
                  onLoaded={() => setIs3DLoaded(true)}
                />
              ) : (
                <MascotFallback />
              )}
            </CanvasErrorBoundary>

            {/* Thanh điều khiển nổi tối giản phong cách Analogue (Frosted Pill Controls) */}
            <div className="absolute bottom-3 sm:bottom-4 inset-x-0 mx-auto w-fit max-w-[calc(100%-1rem)] sm:max-w-none overflow-x-auto no-scrollbar flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#08090C]/85 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)] pointer-events-auto">
              
              {/* Cụm hành động Khỉ Kỹ Sư */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={() => triggerAction('greet')}
                  className="min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-full hover:bg-white/[0.08] text-[#D1D5DB] hover:text-white text-[11px] sm:text-xs font-mono transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
                  title="Khỉ kỹ sư vẫy tay chào"
                >
                  👋 Vẫy tay
                </button>
                <button
                  type="button"
                  onClick={() => triggerAction('inspect')}
                  className="min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-full hover:bg-white/[0.08] text-[#D1D5DB] hover:text-white text-[11px] sm:text-xs font-mono transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
                  title="Khỉ kỹ sư soi mô hình"
                >
                  🔍 Soi mẫu
                </button>
                <button
                  type="button"
                  onClick={() => triggerAction('hop')}
                  className="min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-full hover:bg-white/[0.08] text-[#D1D5DB] hover:text-white text-[11px] sm:text-xs font-mono transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
                  title="Khỉ kỹ sư nhảy mừng"
                >
                  🎉 Nhảy vui
                </button>
              </div>

              {/* Ngăn cách mỏng */}
              <span className="w-px h-4 bg-white/[0.1] hidden sm:inline-block" />

              {/* Chuyển đổi khung lưới & Tự xoay */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={() => setWireframe(!wireframe)}
                  className={`min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-full text-[11px] sm:text-xs font-mono transition-all flex items-center gap-1 sm:gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] ${
                    wireframe
                      ? 'bg-[#EB4037] text-white'
                      : 'text-[#A5ADB8] hover:text-white hover:bg-white/[0.08]'
                  }`}
                  title="Bật / tắt chế độ khung lưới 3D polygon"
                >
                  <Box className="w-3 h-3" />
                  <span className="hidden xs:inline">{wireframe ? 'Khung lưới' : 'Bề mặt'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`min-h-[30px] sm:min-h-[32px] px-2 sm:px-2.5 rounded-full text-[11px] sm:text-xs font-mono transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] ${
                    autoRotate
                      ? 'text-[#C8A261] bg-[#C8A261]/10'
                      : 'text-[#A5ADB8] hover:text-white hover:bg-white/[0.08]'
                  }`}
                  title="Bật / tắt tự động xoay"
                >
                  <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                </button>
              </div>

            </div>
          </div>

          {/* Dòng chú thích kỹ thuật */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] font-mono text-[#737D89] pt-2 px-2 gap-1 text-center sm:text-left">
            <span>MÔ HÌNH: MINHLAB-MASCOT-V1.GLB</span>
            <span className="text-[#C8A261]">KÉO CHUỘT / CHẠM ĐỂ XOAY 360°</span>
            <span className="hidden sm:inline">RENDER REALTIME WEBGL</span>
          </div>

        </div>

        {/* ============================================================== */}
        {/* 3. DẢI THÔNG SỐ KỸ THUẬT XƯỞNG (TECHNICAL SPEC RAIL)           */}
        {/* ============================================================== */}
        <div className="w-full max-w-4xl mt-12 pt-8 border-t border-white/[0.06]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-left sm:text-center">
            <div className="space-y-1">
              <span className="block text-lg sm:text-xl font-mono font-bold text-[#F4F1EA]">0.12 MM</span>
              <span className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">Độ mịn layer FDM</span>
            </div>
            <div className="space-y-1 sm:border-l border-white/[0.06] sm:pl-4">
              <span className="block text-lg sm:text-xl font-mono font-bold text-[#C8A261]">PLA+ TOUGH</span>
              <span className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">Nhựa nguyên sinh</span>
            </div>
            <div className="space-y-1 sm:border-l border-white/[0.06] sm:pl-4">
              <span className="block text-lg sm:text-xl font-mono font-bold text-[#F4F1EA]">±0.05 MM</span>
              <span className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">Dung sai thước kẹp</span>
            </div>
            <div className="space-y-1 sm:border-l border-white/[0.06] sm:pl-4">
              <span className="block text-lg sm:text-xl font-mono font-bold text-[#F4F1EA]">THỦ CÔNG</span>
              <span className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">Hoàn thiện tại xưởng</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero3DSection;
