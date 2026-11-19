import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import StudioIllustration from './StudioIllustration';
import { ArrowRight } from 'lucide-react';

export const HomeLabTeaser: React.FC = () => {
  return (
    <section className="studio-workshop py-12 sm:py-16 lg:py-20 px-4 sm:px-8 border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto w-full space-y-8 sm:space-y-10">
        
        {/* ============================================================== */}
        {/* HEADER — CINEMATIC WORKSHOP INTRO                              */}
        {/* ============================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="text-left space-y-4 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
              Ghé xưởng MinhLab.
            </h2>
            <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
              Ghé không gian mô phỏng của MinhLab để xem các bước kiểm tra file, in và hoàn thiện một sản phẩm.
            </p>
          </div>

          <div className="flex w-full flex-row items-center justify-between gap-4 md:w-auto md:shrink-0 md:flex-col md:items-end">
            <StudioIllustration scene="workshop" />
            <Link
              href="/phong-lab"
              aria-label="Khám phá không gian xưởng 3D MinhLab"
              className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-white/[0.14] bg-white/[0.04] px-4 py-2 text-xs font-medium text-[#F4F1EA] transition-colors duration-150 hover:border-[#EB4037] hover:bg-[#EB4037] sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] self-start md:self-end"
            >
              <span>Khám phá xưởng 3D</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* ============================================================== */}
        {/* WIDESCREEN VISUAL STAGE (KHUNG ẢNH XƯỞNG TOÀN CẢNH)            */}
        {/* ============================================================== */}
        <Link href="/phong-lab" aria-label="Xem không gian xưởng 3D" className="relative block rounded-2xl overflow-hidden bg-[#090D12] border border-white/[0.06] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full">
            <Image
              src="/images/minhlab-lab-resin-v2.png"
              alt="Mô phỏng 3D phòng lab MinhLab"
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover object-center group-hover:scale-102 transition-transform duration-700"
            />

          </div>
        </Link>

      </div>
    </section>
  );
};

export default HomeLabTeaser;
