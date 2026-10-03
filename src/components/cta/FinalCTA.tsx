'use client';

import React from 'react';
import Link from 'next/link';
import { SITE_CONFIG } from '../../config/site.config';
import { ShoppingBag, MessageCircle, ArrowRight } from 'lucide-react';

export const FinalCTA: React.FC = () => {
  const handleOpenZalo = () => {
    const zaloNum = SITE_CONFIG.contact.zaloPhone.replace(/\s+/g, '');
    window.open(`https://zalo.me/${zaloNum}`, '_blank');
  };

  return (
    <section className="py-24 sm:py-28 px-4 sm:px-8 bg-transparent border-t border-[#27313C] w-full max-w-full text-center relative overflow-hidden">
      {/* Vệt sáng nhẹ tạo chiều sâu */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#EB4037]/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-6 relative z-10">
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[11px] font-mono tracking-widest text-[#A5ADB8] uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
          <span>BẮT ĐẦU CHẾ TÁC</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-tight">
          Bạn đang tìm một món đồ đã biến mất?
        </h2>

        <p className="text-base sm:text-lg text-[#A5ADB8] leading-relaxed max-w-xl mx-auto">
          Dù là một mảnh ghép để hoàn thiện bộ sưu tập hay một tệp thiết kế bạn đang ấp ủ, xưởng MinhLab luôn sẵn sàng lắng nghe và đồng hành cùng bạn.
        </p>

        {/* Hai hành động chính */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
          <Link
            href="/bo-suu-tap"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm transition-all shadow-subtle group"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Xem bộ sưu tập</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <button
            type="button"
            onClick={handleOpenZalo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#F4F1EA] font-medium text-sm border border-[#27313C] transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-[#A5ADB8]" />
            <span>Trao đổi với MinhLab qua Zalo</span>
          </button>
        </div>

      </div>
    </section>
  );
};

export default FinalCTA;
