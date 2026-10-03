'use client';

/**
 * =====================================================================
 * MINHLAB 3D - CONTACT SECTION (LIÊN HỆ & TƯ VẤN KỸ THUẬT)
 * =====================================================================
 * Thiết kế tinh giản:
 *  - Thông tin studio minh bạch, dễ tiếp cận.
 *  - Trình tạo nhanh nội dung tin nhắn gửi Zalo / Email để nhận tư vấn file 3D.
 * =====================================================================
 */

import React, { useState } from 'react';
import { SITE_CONFIG } from '../../config/site.config';
import { Phone, Mail, MapPin, Clock, MessageCircle, Copy, Check } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [material, setMaterial] = useState('PLA+ Tiêu chuẩn');
  const [size, setSize] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const contactInfo = SITE_CONFIG.contact;

  const generateMessage = () => {
    return `Chào MinhLab, mình muốn trao đổi về dịch vụ in 3D FDM:
- Loại nhựa mong muốn: ${material}
- Kích thước dự kiến: ${size || 'Chưa xác định (cần tư vấn)'}
- Yêu cầu chi tiết: ${notes || 'Gửi file để MinhLab kiểm tra và báo giá.'}`;
  };

  const handleOpenZalo = () => {
    const msg = encodeURIComponent(generateMessage());
    const zaloUrl = `https://zalo.me/${contactInfo.zaloPhone.replace(/\s+/g, '')}?text=${msg}`;
    window.open(zaloUrl, '_blank');
  };

  const handleOpenEmail = () => {
    const subject = encodeURIComponent('Trao đổi yêu cầu in 3D — MinhLab');
    const body = encodeURIComponent(generateMessage());
    window.location.href = `mailto:${contactInfo.email}?subject=${subject}&body=${body}`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section id="lien-he" className="py-20 sm:py-24 px-4 sm:px-8 bg-[#08090C] relative border-t border-white/[0.08] w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10 w-full">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-start">
          
          {/* Cột Trái: Thông Tin Liên Hệ Xưởng */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#9CA3AF] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A261]" />
                <span>LIÊN HỆ & TƯ VẤN</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Liên hệ với studio MinhLab
              </h2>

              <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
                Bạn muốn tư vấn mẫu mô hình có sẵn hay có tệp 3D (.STL, .OBJ, .STEP) cần in thử nghiệm? Đội ngũ kỹ thuật MinhLab luôn sẵn sàng hỗ trợ.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <div className="p-2 rounded-lg bg-white/[0.04] text-[#C8A261]">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] text-[#71717A] uppercase font-mono">Hotline / Zalo</h4>
                  <a href={`tel:${contactInfo.phone}`} className="text-sm sm:text-base font-bold text-white hover:text-[#C8A261] transition-colors font-mono">
                    {contactInfo.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <div className="p-2 rounded-lg bg-white/[0.04] text-[#C8A261]">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] text-[#71717A] uppercase font-mono">Hộp thư điện tử</h4>
                  <a href={`mailto:${contactInfo.email}`} className="text-sm sm:text-base font-bold text-white hover:text-[#C8A261] transition-colors font-mono">
                    {contactInfo.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <div className="p-2 rounded-lg bg-white/[0.04] text-[#C8A261]">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] text-[#71717A] uppercase font-mono">Địa chỉ xưởng</h4>
                  <p className="text-xs sm:text-sm font-medium text-white">{contactInfo.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <div className="p-2 rounded-lg bg-white/[0.04] text-[#C8A261]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] text-[#71717A] uppercase font-mono">Giờ làm việc</h4>
                  <p className="text-xs sm:text-sm font-medium text-white">{contactInfo.workingHours}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cột Phải: Bộ Tạo Tin Nhắn Soạn Sẵn Gửi Zalo / Email */}
          <div className="lg:col-span-7 bg-[#111216] border border-white/[0.08] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-bold text-white">Soạn nhanh yêu cầu in 3D</h3>
              <p className="text-xs sm:text-sm text-[#9CA3AF]">
                Chọn loại nhựa và kích thước để tạo mẫu tin nhắn gửi trực tiếp qua Zalo của MinhLab.
              </p>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-mono text-[#71717A] uppercase mb-1.5">
                  1. Loại nhựa mong muốn
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['PLA+ Tiêu chuẩn', 'PETG Kháng lực', 'ABS Chịu nhiệt', 'Cần tư vấn'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMaterial(item)}
                      className={`px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                        material === item
                          ? 'border-[#C8A261] bg-[#C8A261]/10 text-white font-medium'
                          : 'border-white/[0.08] bg-white/[0.03] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#71717A] uppercase mb-1.5">
                  2. Kích thước mô hình ước tính (Dài × Rộng × Cao cm)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 15 × 10 × 12 cm..."
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-500 focus:outline-none focus:border-[#C8A261] text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#71717A] uppercase mb-1.5">
                  3. Ghi chú thêm (Mục đích dùng, màu sắc)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ví dụ: Cần in mẫu màu xám mờ, trưng bày bàn làm việc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-500 focus:outline-none focus:border-[#C8A261] text-xs sm:text-sm resize-none"
                />
              </div>
            </div>

            {/* Xem trước nội dung tin nhắn */}
            <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs font-mono text-gray-300 relative">
              <button
                type="button"
                onClick={handleCopyText}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-colors"
                title="Sao chép nội dung"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="whitespace-pre-wrap font-sans text-xs text-[#9CA3AF]">
                {generateMessage()}
              </pre>
            </div>

            {/* Cụm Nút Gửi Zalo / Email */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={handleOpenZalo}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-lg bg-[#0068FF] hover:bg-[#005AE0] text-white font-semibold text-xs shadow-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Gửi qua Zalo</span>
              </button>

              <button
                type="button"
                onClick={handleOpenEmail}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium text-xs border border-white/[0.08] transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Gửi qua Email</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

export default ContactSection;
