import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PrintRequestForm } from '../../src/components/print-request/PrintRequestForm';
import { TrustBar } from '../../src/components/trust/TrustBar';
import { Compass, ArrowRight, Layers } from 'lucide-react';

export const metadata: Metadata = {
  title: 'In 3D Theo Yêu Cầu — MinhLab FDM Studio',
  description: 'Tải file STL, OBJ, STEP để nhận tư vấn thông số đùn nhựa 0.12mm, lựa chọn vật liệu PLA/PETG/TPU và báo giá nhanh qua Zalo.',
};

export default function InTheoFilePage() {
  return (
    <div className="w-full bg-transparent text-[#F4F1EA] min-h-screen">
      {/* Bàn Làm Việc Kỹ Thuật Tải File (Đã có tiêu đề H1 đồng nhất) */}
      <div className="w-full">
        <PrintRequestForm />
      </div>

      {/* Dải Cam Kết Kỹ Thuật */}
      <div className="w-full border-t border-b border-[#27313C] my-4">
        <TrustBar />
      </div>

      {/* Banner Khám Phá Quy Trình Tại Xưởng */}
      <section className="py-10 sm:py-14 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="p-8 sm:p-10 rounded-2xl bg-[#141A21] border border-[#27313C] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 text-left max-w-xl">
            <span className="text-xs font-mono text-[#D48955] flex items-center gap-1.5 font-semibold">
              <Layers className="w-3.5 h-3.5" />
              <span>CÔNG NGHỆ CHẾ TÁC</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">
              Muốn xem máy in hoạt động như thế nào?
            </h3>
            <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
              Trải nghiệm tour 3D phòng lab để quan sát cụm đầu đùn 0.12mm, trạm xử lý bavia và máy móc thực tế tại xưởng MinhLab.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/phong-lab"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#F4F1EA] text-xs font-medium border border-[#27313C] transition-colors shadow-subtle group"
            >
              <span>Xem Tour 3D Phòng Lab</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#EB4037]" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
