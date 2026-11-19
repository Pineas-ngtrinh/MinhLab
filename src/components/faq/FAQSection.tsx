'use client';

import React, { useState } from 'react';
import { SITE_CONFIG } from '../../config/site.config';
import { ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="pt-10 pb-14 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-20 px-4 sm:px-8 bg-transparent border-t border-white/[0.06] w-full max-w-full overflow-hidden text-[#F4F1EA]">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Tiêu đề & Giới thiệu */}
        <div className="text-left space-y-4">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
            Câu hỏi thường gặp.
          </h2>

        </div>

        {/* Câu trả lời chỉ mở khi khách cần đọc */}
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {SITE_CONFIG.faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="py-[12px] sm:py-[18px]">
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
