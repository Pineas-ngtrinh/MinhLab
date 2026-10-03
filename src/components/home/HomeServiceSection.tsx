'use client';

import React from 'react';
import Link from 'next/link';
import { UploadCloud, FileCheck, CheckCircle2, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

export const HomeServiceSection: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Tải Lên File 3D',
      desc: 'Hỗ trợ các định dạng .STL, .OBJ, .STEP, .3MF. Dung lượng tệp tối đa 100MB qua web hoặc Zalo.',
      spec: 'ĐỊNH DẠNG .STL / .STEP / .OBJ',
      icon: UploadCloud,
    },
    {
      step: '02',
      title: 'Soi Lưới & Báo Giá 30 Phút',
      desc: 'Kỹ sư xưởng kiểm tra độ dày thành > 1.2mm, góc đùn, tư vấn vật liệu (PLA+, Resin) và gửi báo giá.',
      spec: 'PHẢN HỒI NHANH 30 PHÚT',
      icon: FileCheck,
    },
    {
      step: '03',
      title: 'In 0.12mm & Khử Bavia',
      desc: 'Sợi nhựa PLA+ nguyên sinh đùn ở 210°C, bóc tách support dạng tree và mài gọt hoàn thiện thủ công.',
      spec: 'ĐỘ MỊN LAYER 0.12 MM',
      icon: Clock,
    },
    {
      step: '04',
      title: 'Kiểm Định & Đóng Gói 3 Lớp',
      desc: 'Đo dung sai thước kẹp điện tử ±0.05mm, bọc xốp bóng khí 3 lớp và gửi hỏa tốc toàn quốc.',
      spec: 'DUNG SAI ±0.05 MM',
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-8 border-b border-white/[0.06] bg-[#08090C]">
      <div className="max-w-6xl mx-auto w-full space-y-12 sm:space-y-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#A5ADB8] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
              <span>№ 03 / CUSTOM PRINTING · GIA CÔNG FDM THEO YÊU CẦU</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
              Bản vẽ của bạn. Đôi tay của MinhLab.
            </h2>
            <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
              Bạn có file thiết kế riêng? Hãy để MinhLab biến mô hình kỹ thuật số thành vật thể vật lý sắc nét, bền bỉ với độ mịn layer 0.12mm.
            </p>
          </div>

          <Link
            href="/in-theo-file"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-95 group self-start md:self-end focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <span>Gửi file &amp; Nhận tư vấn ngay</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.step}
                className="p-6 sm:p-7 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition-all text-left flex flex-col justify-between group space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-mono font-bold text-white group-hover:text-[#EB4037] transition-colors">
                      {st.step}
                    </span>
                    <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#D1D5DB]">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-[#F4F1EA] group-hover:text-white transition-colors">
                    {st.title}
                  </h3>

                  <p className="text-xs text-[#A5ADB8] leading-relaxed">
                    {st.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.06] text-[10px] font-mono text-[#737D89] tracking-wider uppercase">
                  {st.spec}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HomeServiceSection;
