'use client';

import React, { useState } from 'react';
import { SITE_CONFIG } from '../../config/site.config';
import { HelpCircle, ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-8 bg-[#08090C] border-t border-white/[0.06] w-full max-w-full overflow-hidden text-[#F4F1EA]">
      <div className="max-w-4xl mx-auto w-full space-y-12">
        
        {/* Tiêu đề & Giới thiệu */}
        <div className="text-left space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#A5ADB8] uppercase">
            <HelpCircle className="w-3.5 h-3.5 text-[#EB4037]" />
            <span>№ 04 / FAQ · GIẢI ĐÁP THẮC MẮC KỸ THUẬT</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
            Câu hỏi thường gặp.
          </h2>

          <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
            Những thông tin chi tiết về định dạng tệp, quy trình kiểm tra lỗi mesh và cách tính chi phí tại xưởng MinhLab.
          </p>
        </div>

        {/* Danh sách Accordion 6 câu hỏi */}
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {SITE_CONFIG.faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="py-5 sm:py-6">
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="w-full flex items-center justify-between gap-4 text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] rounded-lg py-1"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-medium text-[#F4F1EA] group-hover:text-white transition-colors">
                    {faq.question}
                  </span>
                  <div
                    className={`p-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#A5ADB8] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-white/[0.08] text-white border-white/[0.15]' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="pt-3 pb-1 text-sm text-[#A5ADB8] leading-relaxed animate-fadeIn">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default FAQSection;
