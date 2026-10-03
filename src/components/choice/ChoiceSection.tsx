'use client';

/**
 * =====================================================================
 * MINHLAB 3D - CHOICE SECTION (PHÂN LUỒNG NHU CẦU KHÁCH HÀNG)
 * =====================================================================
 * Triết lý thiết kế:
 *  - 2 Thẻ tối giản song song, cân đối, không phô trương.
 *  - Giúp người xem dễ dàng chọn đúng nhu cầu: mua mô hình có sẵn hoặc gửi file in riêng.
 * =====================================================================
 */

import React from 'react';
import { ShoppingBag, UploadCloud, ArrowRight, CheckCircle2 } from 'lucide-react';

export const ChoiceSection: React.FC = () => {
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const headerOffset = 80;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="lua-chon" className="py-20 px-4 sm:px-8 bg-[#0B0B0E] relative border-t border-white/[0.08] w-full max-w-full overflow-hidden">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* Tiêu đề phần Lựa Chọn */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#9CA3AF] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8A261]" />
            <span>ĐỊNH HƯỚNG NHU CẦU</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Bạn muốn bắt đầu cùng MinhLab như thế nào?
          </h2>

          <p className="text-sm sm:text-base text-[#9CA3AF]">
            Chọn mua các mẫu sản phẩm có sẵn tại studio hoặc gửi tệp thiết kế 3D để in mẫu theo yêu cầu.
          </p>
        </div>

        {/* 2 Thẻ Định Hướng Song Song */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto w-full">
          
          {/* Thẻ 1: Mua sản phẩm có sẵn */}
          <div className="relative p-6 sm:p-8 rounded-2xl bg-[#111216] border border-white/[0.08] hover:border-white/[0.2] transition-all duration-300 flex flex-col justify-between group">
            <div className="space-y-4 sm:space-y-5">
              <div className="w-fit p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white">
                <ShoppingBag className="w-5 h-5 text-[#C8A261]" />
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider block mb-1">
                  LỰA CHỌN 01
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Mua sản phẩm có sẵn
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                Bộ sưu tập mô hình art toy voxel, diorama phòng lab mini và phụ kiện bàn làm việc FDM sắc nét, đã qua xử lý bề mặt và sẵn sàng giao hàng ngay.
              </p>

              <ul className="space-y-2.5 pt-4 border-t border-white/[0.06] text-xs text-[#9CA3AF]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C8A261] shrink-0" />
                  <span>Sản phẩm hoàn thiện có sẵn tại kho, đóng hộp cẩn thận</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C8A261] shrink-0" />
                  <span>Nhựa sinh học PLA+ cao cấp, kiểm tra dung sai từng chi tiết</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C8A261] shrink-0" />
                  <span>Hình ảnh mẫu in thật và thông số kích thước minh bạch</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4">
              <a
                href="#san-pham"
                onClick={(e) => handleScrollTo(e, '#san-pham')}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium text-xs border border-white/[0.08] hover:border-white/20 transition-all"
              >
                <span>Xem bộ sưu tập sản phẩm</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C8A261] group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>

          {/* Thẻ 2: In theo file khách gửi */}
          <div className="relative p-6 sm:p-8 rounded-2xl bg-[#111216] border border-white/[0.08] hover:border-white/[0.2] transition-all duration-300 flex flex-col justify-between group">
            <div className="space-y-4 sm:space-y-5">
              <div className="w-fit p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white">
                <UploadCloud className="w-5 h-5 text-[#C8A261]" />
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider block mb-1">
                  LỰA CHỌN 02
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  In theo tệp 3D của bạn
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                Gửi tệp 3D (.STL, .OBJ, .STEP) để kỹ sư xưởng kiểm tra mesh, tư vấn góc in tối ưu và báo giá theo khối lượng nhựa thực tế.
              </p>

              <ul className="space-y-2.5 pt-4 border-t border-white/[0.06] text-xs text-[#9CA3AF]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C8A261] shrink-0" />
                  <span>Soi lỗi polygon hở và đảo mặt mesh miễn phí</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C8A261] shrink-0" />
                  <span>Tùy chỉnh độ dày lớp từ 0.12mm đến 0.28mm theo nhu cầu</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C8A261] shrink-0" />
                  <span>Báo giá minh bạch, phản hồi trong 15 phút</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4">
              <a
                href="#lien-he"
                onClick={(e) => handleScrollTo(e, '#lien-he')}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-[#C8A261] hover:bg-[#B89251] text-[#0B0B0E] font-bold text-xs shadow-sm transition-all"
              >
                <span>Gửi tệp yêu cầu in</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#0B0B0E] group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ChoiceSection;
