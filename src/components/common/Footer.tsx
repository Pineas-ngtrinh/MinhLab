'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_CONFIG } from '../../config/site.config';
import { ArrowUp, Mail, Phone, MapPin, Clock } from 'lucide-react';

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer id="lien-he" className="bg-[#0B0F14] border-t border-[#27313C] pt-16 pb-12 px-4 sm:px-8 text-xs text-[#A5ADB8] w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
          
          {/* Thông tin thương hiệu MinhLab */}
          <div className="md:col-span-5 space-y-4 text-left">
            <div className="flex items-center gap-2.5">
              <Link href="/" className="relative h-7 w-28 block">
                <Image
                  src="/images/logo.png"
                  alt="MinhLab Logo"
                  fill
                  className="object-contain object-left"
                />
              </Link>
              <span className="text-[11px] font-mono text-[#737D89] border-l border-[#27313C] pl-2 leading-none">
                Modern 3D Workshop
              </span>
            </div>
            
            <p className="text-xs text-[#A5ADB8] max-w-md leading-relaxed">
              Xưởng phục dựng các mẫu đồ chơi, mô hình sưu tầm đã ngừng sản xuất và dịch vụ gia công in 3D FDM chuẩn xác theo tệp của khách hàng.
            </p>

            <div className="flex items-center gap-3 pt-1 text-xs font-mono text-[#737D89]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#6F9576]" />
              <span>Xưởng đang hoạt động · Nhận tệp trực tuyến 24/7</span>
            </div>
          </div>

          {/* Điều hướng danh mục */}
          <div className="md:col-span-3 space-y-3 text-left">
            <h4 className="text-xs font-mono font-semibold text-[#F4F1EA] uppercase tracking-wider">
              ĐIỀU HƯỚNG
            </h4>
            <ul className="space-y-2 text-[#A5ADB8] text-xs">
              <li>
                <Link 
                  href="/bo-suu-tap" 
                  className="hover:text-[#F4F1EA] transition-colors"
                >
                  Bộ sưu tập tại xưởng
                </Link>
              </li>
              <li>
                <Link 
                  href="/phong-lab" 
                  className="hover:text-[#F4F1EA] transition-colors"
                >
                  Tour 3D phòng lab xưởng
                </Link>
              </li>
              <li>
                <Link 
                  href="/in-theo-file" 
                  className="hover:text-[#F4F1EA] transition-colors"
                >
                  Gửi file in theo yêu cầu
                </Link>
              </li>
              <li>
                <Link 
                  href="/ve-minhlab" 
                  className="hover:text-[#F4F1EA] transition-colors"
                >
                  Về MinhLab & Câu chuyện phục dựng
                </Link>
              </li>
            </ul>
          </div>

          {/* Thông tin liên hệ thực tế */}
          <div className="md:col-span-4 space-y-3 text-left">
            <h4 className="text-xs font-mono font-semibold text-[#F4F1EA] uppercase tracking-wider">
              XƯỞNG CHẾ TÁC
            </h4>
            <div className="space-y-2 text-xs text-[#A5ADB8] leading-relaxed">
              <p className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#EB4037] shrink-0 mt-0.5" />
                <span>{SITE_CONFIG.contact.address}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#EB4037] shrink-0" />
                <span>
                  Hotline / Zalo:{' '}
                  <a href={`tel:${SITE_CONFIG.contact.phone}`} className="hover:text-[#F4F1EA] font-mono text-[#F4F1EA]">
                    {SITE_CONFIG.contact.phone}
                  </a>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#EB4037] shrink-0" />
                <span>
                  Hộp thư:{' '}
                  <a href={`mailto:${SITE_CONFIG.contact.email}`} className="hover:text-[#F4F1EA] font-mono">
                    {SITE_CONFIG.contact.email}
                  </a>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#EB4037] shrink-0" />
                <span>Thời gian tiếp nhận: {SITE_CONFIG.contact.workingHours}</span>
              </p>
            </div>
          </div>

        </div>

        {/* Dòng bản quyền & nút cuộn lên đầu */}
        <div className="pt-6 border-t border-[#27313C] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#737D89] font-mono text-[11px]">
            © {new Date().getFullYear()} MinhLab. Xưởng phục dựng đồ sưu tầm & in 3D FDM thủ công.
          </p>
          
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-[#A5ADB8] hover:text-[#F4F1EA] transition-colors px-3 py-1.5 rounded-lg bg-[#141A21] hover:bg-[#1A222C] border border-[#27313C] font-mono text-xs"
          >
            <span>Về đầu trang</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
