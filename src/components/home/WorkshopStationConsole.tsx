'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowUpRight, Wrench } from 'lucide-react';
import styles from './workshop-station.module.css';

interface StationInfo {
  id: string;
  stepNumber: string;
  shortName: string;
  title: string;
  tagline: string;
  description: string;
  imagePosition: string;
  imageTransform?: string;
  specs: { label: string; value: string }[];
}

const STATIONS: StationInfo[] = [
  {
    id: 'station-mesh',
    stepNumber: '01',
    shortName: 'Soi File Lưới',
    title: 'Trạm Kiểm Định Mesh & Phân Tích Lưới 3D',
    tagline: 'Terminal Soi Lỗi & Tối Ưu Hóa Cắt Lớp (Slicing)',
    description: 'Tệp 3D (.STL, .OBJ, .STEP) được kiểm tra tính toàn vẹn đa diện (manifold), vá kín các bề mặt hở và tinh chỉnh góc đặt support để tối thiểu hóa dấu tì vết sau khi tách hỗ trợ.',
    imagePosition: '84% 48%',
    imageTransform: 'scale(1.75)',
    specs: [
      { label: 'Định dạng hỗ trợ', value: '.STL / .OBJ / .STEP' },
      { label: 'Kiểm định lưới', value: '100% Manifold (Kín nước)' },
      { label: 'Góc nghiêng support', value: '45° - 60° Tối ưu' },
    ],
  },
  {
    id: 'station-bed',
    stepNumber: '02',
    shortName: 'Khay Vật Liệu',
    title: 'Kho Nhựa Kỹ Thuật & Cân Bàn Nhiệt Tự Động',
    tagline: 'Sấy Sợi PLA Tough / PETG & Chuẩn Bị Bàn Bám PEI',
    description: 'Cuộn sợi nhựa được bảo quản trong buồng sấy kiểm soát độ ẩm dưới 15% RH. Bàn nhiệt phủ tấm thép lò xo PEI được làm sạch bằng cồn IPA và cân phẳng tự động qua cảm biến 25 điểm.',
    imagePosition: '20% 55%',
    imageTransform: 'scale(1.75)',
    specs: [
      { label: 'Độ ẩm lưu trữ', value: '< 15% RH' },
      { label: 'Nhiệt độ sấy sợi', value: '50°C Constant' },
      { label: 'Cân bàn tự động', value: 'Lưới ma trận 25 điểm' },
    ],
  },
  {
    id: 'station-fdm',
    stepNumber: '03',
    shortName: 'Gia Công FDM',
    title: 'Trạm Đùn Sợi Nhựa Vi Mô 0.12mm (FDM Core)',
    tagline: 'Đầu Đùn Thép Tôi Cứng 215°C — Đắp Từng Lớp Voxel',
    description: 'Hệ thống đùn trực tiếp đẩy sợi nhựa nóng chảy 215°C thành các đường vi sợi 0.12mm siêu mịn. Từng khối hình học, khớp nối và chi tiết Art Toy được định hình chính xác tuyệt đối.',
    imagePosition: '41% 27%',
    imageTransform: 'scale(1.85)',
    specs: [
      { label: 'Độ mịn lớp in', value: '0.12 mm (Chính xác cao)' },
      { label: 'Nhiệt độ đầu đùn', value: '215°C ± 0.5°C' },
      { label: 'Vật liệu chạy chính', value: 'PLA+ Tough nguyên sinh' },
    ],
  },
  {
    id: 'station-resin',
    stepNumber: '04',
    shortName: 'Trạm Resin UV',
    title: 'Trạm Tạo Hình Quang Hóa & Rửa Siêu Âm Kép',
    tagline: 'Nhựa Resin 8K — Chi Tiết Vi Mô Siêu Nét',
    description: 'Dành riêng cho những bề mặt bóng bẩy và mô hình thu nhỏ không nhìn thấy vân in. Mẫu được rửa qua bể cồn siêu âm kép và hấp sấy đóng rắn trong buồng cực tím UV 405nm.',
    imagePosition: '57% 32%',
    imageTransform: 'scale(1.85)',
    specs: [
      { label: 'Bước sóng quang hóa', value: '405nm UV Matrix' },
      { label: 'Làm sạch phôi', value: 'Bể cồn siêu âm IPA 99%' },
      { label: 'Hậu xử lý UV', value: 'Buồng sấy xoay 360°' },
    ],
  },
  {
    id: 'station-qa',
    stepNumber: '05',
    shortName: 'Bàn Hoàn Thiện',
    title: 'Bàn Hoàn Thiện Thủ Công & Đóng Gói Kiểm Định',
    tagline: 'Bàn Thợ Chế Tác — Gọt Bavia & Đóng Hộp Kraft',
    description: 'Kỹ sư MinhLab trực tiếp gọt tỉa bavia bằng dao vi phẫu, kiểm tra dung sai khớp xoay bằng thước kẹp điện tử Mitutoyo trước khi dán tem niêm phong và đóng gói kraft mộc.',
    imagePosition: '50% 55%',
    imageTransform: 'scale(1.15)',
    specs: [
      { label: 'Dung sai lắp ghép', value: '< 0.08 mm' },
      { label: 'Xử lý bavia', value: 'Thủ công 100% bằng tay' },
      { label: 'Bao bì bảo quản', value: 'Giấy Kraft tái sinh chống ẩm' },
    ],
  },
];

export default function WorkshopStationConsole() {
  const [activeIdx, setActiveIdx] = useState(2); // Default on core FDM station
  const station = STATIONS[activeIdx];

  const handlePrev = () => {
    setActiveIdx((prev) => (prev > 0 ? prev - 1 : STATIONS.length - 1));
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev < STATIONS.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className={styles.console} data-workshop-console aria-label="Bảng điều khiển 5 trạm xưởng MinhLab">
      {/* Thanh 5 tab chuyển trạm */}
      <div className={styles.tabBar} role="tablist" aria-label="Các trạm gia công tại xưởng">
        {STATIONS.map((item, index) => {
          const isActive = index === activeIdx;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`station-panel-${item.id}`}
              id={`station-tab-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveIdx(index)}
              className={`${styles.tabItem} ${isActive ? styles.tabActive : ''}`}
            >
              <span className={styles.tabNumber}>{item.stepNumber}</span>
              <span className={styles.tabName}>{item.shortName}</span>
              {isActive && <span className={styles.activeIndicator} />}
            </button>
          );
        })}
      </div>

      {/* Khung nội dung trạm đang chọn */}
      <div
        id={`station-panel-${station.id}`}
        role="tabpanel"
        aria-labelledby={`station-tab-${station.id}`}
        className={styles.displayArea}
      >
        {/* Cột trái: Ảnh chụp thật của trạm */}
        <div className={styles.visualContainer}>
          <div className={styles.imageWrapper}>
            <Image
              src="/images/minhlab-lab-resin-v2.png"
              alt={station.title}
              fill
              sizes="(max-width: 767px) 95vw, 55vw"
              className={styles.stationImage}
              style={{
                objectPosition: station.imagePosition,
                transform: station.imageTransform ?? 'none',
              }}
            />
            <div className={styles.imageOverlay} />
            <div className={styles.imageTag}>
              <span className={styles.tagDot} />
              <span>TRẠM {station.stepNumber} / 05 // HOẠT ĐỘNG</span>
            </div>
          </div>

          {/* Nút điều hướng trước / sau */}
          <div className={styles.controlRow}>
            <div className={styles.stepCounter}>
              <span>TRẠM <strong>{station.stepNumber}</strong> / 05</span>
            </div>
            <div className={styles.navButtons}>
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Trạm trước"
                className={styles.navBtn}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Trạm kế tiếp"
                className={styles.navBtn}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Cột phải: Thông tin công nghệ & thông số kỹ thuật */}
        <div className={styles.metaContainer}>
          <div className={styles.stationBadge}>
            <Wrench size={13} className={styles.badgeIcon} />
            <span>QUY TRÌNH GIA CÔNG CHUẨN XƯỞNG</span>
          </div>

          <h3 className={styles.stationTitle}>{station.title}</h3>
          <p className={styles.stationTagline}>{station.tagline}</p>
          <p className={styles.stationDescription}>{station.description}</p>

          {/* Bảng thông số kỹ thuật của trạm */}
          <div className={styles.specGrid}>
            {station.specs.map((spec, i) => (
              <div key={i} className={styles.specBox}>
                <span className={styles.specKey}>{spec.label}</span>
                <span className={styles.specVal}>{spec.value}</span>
              </div>
            ))}
          </div>

          {/* Đường dẫn tới trang tour 3D chuyên sâu */}
          <div className={styles.actionFoot}>
            <Link href="/phong-lab" className={styles.tourLink}>
              <span>Khám phá Tour 3D toàn cảnh phòng xưởng</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
