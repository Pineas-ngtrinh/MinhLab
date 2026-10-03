'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, Check, ArrowRight } from 'lucide-react';

export const RestorationStory: React.FC = () => {
  return (
    <section 
      id="ve-minhlab" 
      className="py-20 sm:py-28 px-4 sm:px-8 bg-[#0F141A]/75 border-t border-[#27313C] w-full max-w-full overflow-hidden"
      aria-label="Câu chuyện phục dựng tại MinhLab"
    >
      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Cột Trái: Hình ảnh thực tế chi tiết mô hình phục dựng (5 cột) */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#0B0F14] border border-[#27313C] shadow-2xl">
              <Image
                src="/images/minhlab-mascot-free-v2.png"
                alt="Chi tiết đường vân layer và bề mặt hoàn thiện tại xưởng MinhLab"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover object-center"
              />
              
              {/* Badge kỹ thuật góc dưới */}
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#0B0F14]/90 backdrop-blur-md border border-[#27313C] text-xs text-[#F4F1EA] space-y-1.5 shadow-subtle">
                <div className="flex items-center justify-between font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6F9576]" />
                    <span className="font-medium text-[#F4F1EA]">Hoàn thiện thủ công tại xưởng</span>
                  </div>
                  <span className="text-[10px] text-[#A5ADB8]">QC-PASS</span>
                </div>
                <p className="text-[11px] text-[#A5ADB8] font-mono leading-relaxed">
                  Độ mịn layer 0.12mm · Khử bavia từng chi tiết · Khớp nối chuẩn xác
                </p>
              </div>
            </div>
          </div>

          {/* Cột Phải: Nội dung chân thành về câu chuyện phục dựng (7 cột) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
              <span>VỀ MINHLAB WORKSHOP</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-bold text-[#F4F1EA] tracking-tight leading-tight max-w-xl">
              Không chỉ in lại một món đồ.
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-[#A5ADB8] leading-relaxed max-w-xl">
              <p>
                Có những mẫu đồ chơi từng xuất hiện trong tuổi thơ nhưng đã biến mất khỏi thị trường. MinhLab sử dụng công nghệ in 3D để giúp người sưu tầm tìm lại phần còn thiếu và tiếp tục câu chuyện của bộ sưu tập.
              </p>
              <p>
                Chúng tôi tiếp cận từng mẫu vật bằng sự nghiêm túc của một xưởng chế tác: đo đạc tỉ mỉ, dựng lại lưới 3D theo nguyên bản, và in thử nghiệm nhiều lần để tìm ra thông số layer và chất liệu nhựa phù hợp nhất nhằm giữ được linh hồn của mẫu gốc.
              </p>
            </div>

            {/* Ba cam kết chuẩn mực bằng bullet points tối giản */}
            <div className="pt-2 space-y-3 max-w-lg border-t border-[#27313C]">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-[#141A21] border border-[#27313C] text-[#6F9576] mt-0.5 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs sm:text-sm text-[#F4F1EA] leading-snug">
                  <strong className="text-[#F4F1EA]">Đúng tỷ lệ hình học:</strong> Đo đạc và đối chiếu cẩn thận từng chi tiết khớp nối và đường nét trước khi lên bàn in.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-[#141A21] border border-[#27313C] text-[#6F9576] mt-0.5 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs sm:text-sm text-[#F4F1EA] leading-snug">
                  <strong className="text-[#F4F1EA]">Vật liệu an toàn:</strong> Sử dụng sợi nhựa sinh học PLA+ / PETG nguyên sinh, không mùi độc hại, bền bỉ khi trưng bày.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-[#141A21] border border-[#27313C] text-[#6F9576] mt-0.5 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs sm:text-sm text-[#F4F1EA] leading-snug">
                  <strong className="text-[#F4F1EA]">Tôn trọng quyền sở hữu:</strong> MinhLab chỉ phục dựng mô hình phục vụ nhu cầu trưng bày cá nhân, không thương mại hóa hàng loạt các mẫu có bản quyền nghiêm ngặt.
                </div>
              </div>
            </div>

            <div className="pt-3">
              <Link
                href="/bo-suu-tap"
                className="inline-flex items-center gap-2 text-sm font-mono text-[#EB4037] hover:text-[#FF5147] transition-colors group min-h-[44px]"
              >
                <span>Xem các mẫu đồ sưu tầm được phục dựng</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default RestorationStory;
