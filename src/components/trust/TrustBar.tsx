'use client';

import React from 'react';
import { SITE_CONFIG } from '../../config/site.config';

export const TrustBar: React.FC = () => {
  return (
    <section className="border-y border-white/[0.06] bg-[#08090C] py-6 sm:py-8 px-4 sm:px-8 w-full max-w-full">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x divide-white/[0.06]">
          {SITE_CONFIG.trustItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3.5 py-1 px-1 lg:px-6 first:pl-0 last:pr-0"
            >
              <span className="text-[11px] font-mono font-bold text-[#C8A261] bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                0{idx + 1}
              </span>
              <div className="space-y-1 text-left">
                <h4 className="text-xs sm:text-[13px] font-semibold text-[#F4F1EA] tracking-tight">
                  {item.title}
                </h4>
                <p className="text-xs text-[#A5ADB8] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
