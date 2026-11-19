import type { Metadata } from 'next';
import Link from 'next/link';
import { RestorationStory } from '../../src/components/story/RestorationStory';
import { FAQSection } from '../../src/components/faq/FAQSection';
import { TrustBar } from '../../src/components/trust/TrustBar';
import { ArrowRight, HeartHandshake } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Về MinhLab',
  description: 'Tìm hiểu triết lý chế tác, tiêu chuẩn hoàn thiện thủ công và hành trình hồi sinh những mẫu đồ chơi ngừng sản xuất tại MinhLab Studio.',
};

export default function VeMinhLabPage() {
  return (
    <div className="w-full bg-transparent text-[#F4F1EA] min-h-screen">
      {/* Tiêu đề đầu trang */}
      <section className="pt-4 sm:pt-6 pb-4 px-4 sm:px-8 max-w-7xl mx-auto text-left">
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[10px] sm:text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
            <span>CÂU CHUYỆN XƯỞNG · MINHLAB 3D</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA]">
            Chế tác lại những món đồ chơi thân thuộc
          </h1>

          <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
            MinhLab là studio in 3D FDM, resin và phục dựng mô hình đồ chơi tại TP. Hồ Chí Minh. Chúng tôi kết hợp độ chính xác của máy in hiện đại với sự tỉ mỉ của bàn tay người thợ thủ công.
          </p>
        </div>
      </section>

      {/* Dải Cam Kết Xưởng */}
      <div className="w-full border-t border-b border-[#27313C] my-4">
        <TrustBar />
      </div>

      {/* Câu Chuyện Phục Dựng Chi Tiết */}
      <div className="w-full">
        <RestorationStory />
      </div>

      {/* Câu Hỏi Thường Gặp */}
      <div className="w-full">
        <FAQSection />
      </div>

      {/* Banner Khám Phá Sản Phẩm */}
      <section className="py-16 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="border-t border-[#27313C] pt-6 sm:pt-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
          <div className="space-y-2 text-left max-w-xl">
            <span className="text-xs font-mono text-[#6F9576] flex items-center gap-1.5 font-semibold">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>ĐỒNG HÀNH CÙNG BẠN</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">
              Bắt đầu trải nghiệm tại MinhLab
            </h3>
            <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
              Dù bạn tìm kiếm một tác phẩm Art Toy sưu tầm hay cần gia công file thiết kế riêng, chúng tôi luôn sẵn sàng hỗ trợ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/bo-suu-tap"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors shadow-subtle group"
            >
              <span>Xem bộ sưu tập</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/phong-lab"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#F4F1EA] text-xs font-medium border border-[#27313C] transition-colors shadow-subtle group"
            >
              <span>Ghé xưởng 3D</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
