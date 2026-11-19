import type { Metadata } from 'next';
import Link from 'next/link';
import { LabScrollytelling } from '../../src/components/lab-scrollytelling/LabScrollytelling';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tour phòng lab | MinhLab',
  description: 'Khám phá phòng lab MinhLab với một máy in FDM, một máy in Resin, trạm kiểm tra file và bàn hoàn thiện, kiểm định sản phẩm.',
};

export default function PhongLabPage() {
  return (
    <div className="w-full bg-transparent text-[#F4F1EA] min-h-screen">
      {/* Tiêu đề đầu trang */}
      <section className="pt-4 sm:pt-6 pb-6 px-4 sm:px-8 max-w-7xl mx-auto text-left">
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[10px] sm:text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
            <span>GHÉ XƯỞNG 3D · MINHLAB</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA]">
            Khám phá xưởng in FDM và resin
          </h1>

          <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
            Ghé xưởng với một máy in FDM, một máy in Resin và Khỉ Kỹ Sư. Cùng xem từ trạm kiểm tra file, chuẩn bị vật liệu đến bàn hoàn thiện và kiểm định sản phẩm.
          </p>
        </div>
      </section>

      {/* Sân khấu 3D Toàn Màn Hình Dành Riêng Cho Phòng Lab */}
      <div className="w-full border-t border-b border-[#27313C]">
        <LabScrollytelling />
      </div>

      {/* Banner Chuyển Tiếp Sang Bộ Sưu Tập */}
      <section className="py-16 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="border-t border-[#27313C] pt-6 sm:pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 text-left max-w-xl">
            <span className="text-xs font-mono text-[#EB4037] flex items-center gap-1.5 font-semibold">
              <span>BƯỚC TIẾP THEO</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">
              Khám phá các sản phẩm vừa hoàn thiện
            </h3>
            <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
              Những món Art Toy và đồ chơi phục dựng vừa xuất xưởng đã có mặt tại tủ trưng bày với thông số kỹ thuật đầy đủ.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/bo-suu-tap"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors shadow-subtle group"
            >
              <span>Xem bộ sưu tập</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
