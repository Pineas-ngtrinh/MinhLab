import React from 'react';
import Link from 'next/link';
import StudioIllustration from './StudioIllustration';
import { ArrowRight } from 'lucide-react';

export const HomeServiceSection: React.FC = () => {
  return (
    <section className="pt-12 pb-10 sm:pt-16 sm:pb-12 lg:pt-20 lg:pb-14 px-4 sm:px-8 border-b border-white/[0.06] bg-transparent">
      <div className="max-w-6xl mx-auto w-full space-y-8 sm:space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 text-left max-w-2xl">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
              In mô hình từ file của bạn.
            </h2>
            <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
              Gửi tệp .STL tối đa 100MB để xưởng kiểm tra và tư vấn in FDM hoặc resin. Chi phí được xác nhận trước khi in.
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-5 md:w-auto md:shrink-0 md:flex-col md:items-end">
            <StudioIllustration scene="packing" />
          <Link
            href="/in-theo-file"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-95 group self-start md:self-end focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <span>Gửi file cần in</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HomeServiceSection;
