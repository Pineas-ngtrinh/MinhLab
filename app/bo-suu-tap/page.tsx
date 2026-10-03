import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGallery } from '../../src/components/products/ProductGallery';
import { UploadCloud, ArrowRight, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Bộ Sưu Tập Đồ Chơi & Art Toy Phục Dựng — MinhLab 3D',
  description: 'Tủ trưng bày các mẫu Art Toy, Robot Voxel và mô hình diorama phục dựng độc bản in 3D FDM độ mịn layer 0.12mm.',
};

export default function BoSuuTapPage() {
  return (
    <div className="w-full bg-transparent text-[#F4F1EA] min-h-screen">
      {/* Phòng Trưng Bày Danh Mục Sản Phẩm (Siêu Nhẹ, Không WebGL) */}
      <div className="w-full">
        <ProductGallery />
      </div>

      {/* Banner Dẫn Sang Dịch Vụ In Theo File */}
      <section className="py-10 sm:py-14 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="p-8 sm:p-10 rounded-2xl bg-[#141A21] border border-[#27313C] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 text-left max-w-xl">
            <span className="text-xs font-mono text-[#8492BD] flex items-center gap-1.5 font-semibold">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>GIA CÔNG THEO YÊU CẦU</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">
              Bạn có file 3D riêng cần in?
            </h3>
            <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
              Tải lên tệp (.STL, .OBJ, .STEP) để nhận bản tóm tắt thông số và tư vấn kỹ thuật trực tiếp qua Zalo từ kỹ sư MinhLab.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/in-theo-file"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors shadow-subtle group"
            >
              <span>Gửi File Cần In</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
