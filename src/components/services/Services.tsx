'use client';

/**
 * =====================================================================
 * MINHLAB 3D - SERVICES (DỊCH VỤ IN 3D FDM THEO YÊU CẦU)
 * =====================================================================
 * Dành cho khách hàng có tệp 3D (.STL, .OBJ, .STEP):
 *  - 3 Năng lực chính: In 3D FDM, Kiểm tra mesh & Hoàn thiện bề mặt.
 * =====================================================================
 */

import React from 'react';
import { SITE_CONFIG } from '../../config/site.config';
import { Printer, FileCheck, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  Printer: <Printer className="w-5 h-5 text-[#C8A261]" />,
  FileCheck: <FileCheck className="w-5 h-5 text-[#C8A261]" />,
  Sparkles: <Sparkles className="w-5 h-5 text-[#C8A261]" />,
};

export const Services: React.FC = () => {
  return (
    <section id="dich-vu" className="py-20 sm:py-24 px-4 sm:px-8 bg-[#0B0B0E] relative border-t border-white/[0.08] w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10 w-full">
        
        {/* Tiêu đề phần Dịch Vụ */}
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#9CA3AF] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8A261]" />
            <span>DỊCH VỤ GIA CÔNG THEO TỆP</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            In 3D FDM chuẩn xác từ file của bạn
          </h2>

          <p className="text-sm sm:text-base text-[#9CA3AF]">
            Chúng tôi nhận in 3D chính xác từ tệp khách hàng cung cấp, hỗ trợ kiểm tra mesh và tư vấn thông số tối ưu nhất cho từng mục đích sử dụng.
          </p>
        </div>

        {/* 3 Thẻ Dịch Vụ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {SITE_CONFIG.services.map((service) => (
            <div
              key={service.id}
              className="p-6 sm:p-8 rounded-2xl bg-[#111216] border border-white/[0.08] hover:border-white/[0.2] transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  {iconMap[service.iconName] || <Printer className="w-5 h-5 text-[#C8A261]" />}
                </div>

                <h3 className="text-lg font-bold text-white tracking-tight">
                  {service.title}
                </h3>

                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  {service.description}
                </p>

                <ul className="space-y-2 pt-3 border-t border-white/[0.06]">
                  {service.specs.map((spec, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#9CA3AF]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C8A261] shrink-0 mt-0.5" />
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.06]">
                <a
                  href="#lien-he"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-white group-hover:text-[#C8A261] transition-colors"
                >
                  <span>Gửi file yêu cầu dịch vụ</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Services;
