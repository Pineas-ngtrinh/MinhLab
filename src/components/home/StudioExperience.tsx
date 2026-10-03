'use client';

import React from 'react';
import Hero3DSection from './Hero3DSection';
import TrustBar from '../trust/TrustBar';
import HomeFeaturedProducts from './HomeFeaturedProducts';
import HomeLabTeaser from './HomeLabTeaser';
import HomeServiceSection from './HomeServiceSection';
import { FAQSection } from '../faq/FAQSection';

export default function StudioExperience() {
  return (
    <div className="w-full bg-[#08090C] text-[#F4F1EA] flex flex-col">
      {/* 1. SÂN KHẤU 3D HERO TƯƠNG TÁC THỜI GIAN THỰC */}
      <Hero3DSection />

      {/* 2. DẢI TIÊU CHUẨN XƯỞNG & CAM KẾT */}
      <TrustBar />

      {/* 3. SHOWROOM SẢN PHẨM 3D NỔI BẬT (BENTO GRID + 3D QUICK VIEW) */}
      <HomeFeaturedProducts />

      {/* 4. TOUR 3D PHÒNG LAB FDM & RESIN (5 TRẠM CHẾ TÁC) */}
      <HomeLabTeaser />

      {/* 5. DỊCH VỤ IN THEO YÊU CẦU (QUY TRÌNH 4 BƯỚC) */}
      <HomeServiceSection />

      {/* 6. GIẢI ĐÁP THẮC MẮC (FAQ ACCORDION) */}
      <FAQSection />
    </div>
  );
}
