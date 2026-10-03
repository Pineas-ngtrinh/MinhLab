'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Compass, ArrowRight, Layers, Eye, CheckCircle2 } from 'lucide-react';

export const HomeLabTeaser: React.FC = () => {
  const stations = [
    { num: '01', title: 'Soi file lưới polygon', desc: 'Kiểm tra độ dày thành > 1.2mm, sửa lỗi đảo mặt tam giác.' },
    { num: '02', title: 'Nạp sợi PLA+ nguyên sinh', desc: 'Sấy khô ở 45°C, triệt tiêu bọt khí và hiện tượng kéo sợi.' },
    { num: '03', title: 'In FDM đầu đùn 0.12mm', desc: 'Độ mịn lớp in siêu cao, bề mặt nhám mờ sang trọng không lộ gân.' },
    { num: '04', title: 'Gọt bavia thủ công', desc: 'Bóc tách tree support, xử lý vết tiếp xúc bằng dao khắc tỉ mỉ.' },
    { num: '05', title: 'Kiểm định dung sai ±0.05mm', desc: 'Thước kẹp điện tử đo khớp nối, bảo đảm độ khít hoàn hảo.' },
  ];

  return (
    <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-8 border-b border-white/[0.06] bg-[#08090C]">
      <div className="max-w-6xl mx-auto w-full space-y-12 sm:space-y-16">
        
        {/* ============================================================== */}
        {/* HEADER — CINEMATIC WORKSHOP INTRO                              */}
        {/* ============================================================== */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-left space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#C8A261] uppercase">
              <Compass className="w-3.5 h-3.5" />
              <span>№ 02 / WORKSHOP TOUR · MINHLAB 3D</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
              Đằng sau mỗi lớp in, là một người thợ.
            </h2>
            <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
              Xem thực tế máy in FDM, buồng sấy UV resin và trạm làm việc của Khỉ Kỹ Sư qua tour 3D tương tác không gian xưởng.
            </p>
          </div>

          <Link
            href="/phong-lab"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono text-[#F4F1EA] hover:text-[#EB4037] transition-colors self-start md:self-end group py-2"
          >
            <span>BƯỚC VÀO PHÒNG LAB 3D</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* ============================================================== */}
        {/* WIDESCREEN VISUAL STAGE (KHUNG ẢNH XƯỞNG TOÀN CẢNH)            */}
        {/* ============================================================== */}
        <div className="relative rounded-2xl overflow-hidden bg-[#090D12] border border-white/[0.06] group shadow-2xl">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full">
            <Image
              src="/images/minhlab-lab-resin-v2.png"
              alt="Mô phỏng 3D phòng lab MinhLab"
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover object-center group-hover:scale-102 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-transparent opacity-80" />

            {/* Center Floating CTA */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <Link
                href="/phong-lab"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs sm:text-sm font-semibold shadow-2xl shadow-black/80 transition-all transform group-hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                <Eye className="w-4 h-4" />
                <span>Khám phá Tour 3D Phòng Lab</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Bottom HUD Tag */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-[#D1D5DB] pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-[#08090C]/80 backdrop-blur-md border border-white/[0.08]">
                5 GÓC MÁY QUAN SÁT
              </span>
              <span className="px-3 py-1 rounded-full bg-[#08090C]/80 backdrop-blur-md border border-white/[0.08] text-[#C8A261]">
                CAMERA SPLINE &amp; VOXEL REALTIME
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 5 STATIONS ARCHITECTURAL BREAKDOWN                             */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
          {stations.map((st) => (
            <div
              key={st.num}
              className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all text-left space-y-3"
            >
              <span className="text-[11px] font-mono font-bold text-[#EB4037] bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-full inline-block">
                TRẠM {st.num}
              </span>
              <div>
                <h3 className="text-xs sm:text-[13px] font-bold text-[#F4F1EA] tracking-tight">
                  {st.title}
                </h3>
                <p className="text-xs text-[#A5ADB8] mt-1.5 leading-relaxed">
                  {st.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default HomeLabTeaser;
