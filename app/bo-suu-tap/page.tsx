import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CatalogSection } from '../../src/components/products/CatalogSection';
import { CatalogNotice } from '../../src/components/products/CatalogNotice';
import { UploadCloud, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Bộ sưu tập | MinhLab',
  description: 'Tủ trưng bày các mẫu Art Toy, Robot Voxel và mô hình diorama phục dựng độc bản in 3D FDM độ mịn layer 0.12mm.',
};

export default function BoSuuTapPage() {
  return (
    <div className="w-full bg-transparent text-[#F4F1EA] min-h-screen">
      {/* Phòng Trưng Bày Danh Mục Sản Phẩm (Siêu Nhẹ, Không WebGL) */}
      <div className="w-full">
        <Suspense fallback={<CatalogNotice state="loading" />}>
          <CatalogSection view="collection" />
        </Suspense>
      </div>

      {/* Banner Dẫn Sang Dịch Vụ In Theo File */}
      <section className="py-10 sm:py-14 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="border-t border-[#27313C] pt-6 sm:pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 text-left max-w-xl">
            <span className="text-xs font-mono text-[#8492BD] flex items-center gap-1.5 font-semibold">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>GIA CÔNG THEO YÊU CẦU</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">
              Bạn có file 3D riêng cần in?
            </h3>
            <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
              Chọn tệp .STL để đọc kích thước ngay trên thiết bị, rồi gửi yêu cầu cho xưởng tư vấn qua Zalo.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/in-theo-file"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors shadow-subtle group"
            >
              <span>Gửi file cần in</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
