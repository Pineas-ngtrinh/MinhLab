'use client';

/**
 * =====================================================================
 * MINHLAB 3D - PROCESS (QUY TRÌNH TIÊU CHUẨN 4 BƯỚC)
 * =====================================================================
 * Thiết kế cẩm nang xưởng chế tác Nhật Bản:
 *  - 4 Bước rõ ràng, mạch lạc, tôn trọng sự minh bạch.
 *  - Phông chữ kỹ thuật tinh gọn, khoảng cách đều đặn.
 * =====================================================================
 */

import React from 'react';
import { SITE_CONFIG } from '../../config/site.config';
import { MessageSquare, FileSearch, Printer, CheckCheck } from 'lucide-react';

const stepIcons = [
  <MessageSquare key="1" className="w-4 h-4 text-[#C8A261]" />,
  <FileSearch key="2" className="w-4 h-4 text-[#C8A261]" />,
  <Printer key="3" className="w-4 h-4 text-[#C8A261]" />,
  <CheckCheck key="4" className="w-4 h-4 text-[#C8A261]" />,
];

export const Process: React.FC = () => {
  return (
    <section id="quy-trinh" className="py-20 sm:py-24 px-4 sm:px-8 bg-[#08090C] relative border-t border-white/[0.08] w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10 w-full">
        
        {/* Tiêu đề phần Quy Trình */}
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#9CA3AF] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8A261]" />
            <span>QUY TRÌNH TIÊU CHUẨN</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Từ bản vẽ đến sản phẩm trên tay
          </h2>

          <p className="text-sm sm:text-base text-[#9CA3AF]">
            Quy trình làm việc minh bạch giúp bạn nắm bắt chính xác tiến độ và an tâm về chất lượng từng mẫu in.
          </p>
        </div>

        {/* 4 Khối Bước Quy Trình */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SITE_CONFIG.process.map((stepItem, index) => (
            <div
              key={stepItem.step}
              className="relative p-6 rounded-2xl bg-[#111216] border border-white/[0.08] hover:border-white/[0.2] transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-2xl font-mono font-bold text-white group-hover:text-[#C8A261] transition-colors">
                    {stepItem.step}
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    {stepIcons[index]}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {stepItem.title}
                  </h3>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    {stepItem.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-[#71717A] leading-normal">
                  {stepItem.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Process;
