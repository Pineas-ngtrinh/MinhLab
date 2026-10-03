'use client';

import Image from 'next/image';
import { Layers, ShieldCheck, Cpu, Ruler, CheckCircle2 } from 'lucide-react';
import styles from './specimen.module.css';

interface MinhLabSpecimenProps {
  reducedMotion?: boolean;
}

export default function MinhLabSpecimen({ reducedMotion = false }: MinhLabSpecimenProps) {
  return (
    <div
      className={styles.specimenCard}
      data-specimen-box
      aria-label="MinhLab Product Specimen: Khỉ Kỹ Sư FDM 0.12mm"
    >
      {/* Khung viền kỹ thuật xưởng */}
      <div className={styles.specimenHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.specimenId}>ML-SPEC-01 // BENCHMARK</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.headerTag}>0.12MM LAYER · FDM</span>
        </div>
      </div>

      {/* Sân khấu 3 lớp phẳng (Flat Layer Assembly) */}
      <div className={styles.stage}>
        {/* LỚP 1: Bàn nhiệt PEI & Thước đo mm kỹ thuật (Base Plate) */}
        <div className={`${styles.layer} ${styles.layerBase}`} aria-hidden="true">
          <div className={styles.gridOverlay} />
          <div className={styles.scaleRuler}>
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100 MM</span>
          </div>
          <div className={styles.crosshairTopLeft} />
          <div className={styles.crosshairBottomRight} />
        </div>

        {/* LỚP 2: Cấu trúc lõi chịu lực Gyroid Infill 15% */}
        <div className={`${styles.layer} ${styles.layerInfill}`} aria-hidden="true">
          <svg className={styles.infillSvg} viewBox="0 0 200 200" fill="none">
            <pattern id="gyroidPattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M0 10 Q5 0, 10 10 T20 10 M10 0 Q15 10, 20 0 T30 0"
                stroke="currentColor"
                strokeWidth="0.8"
                strokeOpacity="0.3"
                fill="none"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#gyroidPattern)" />
          </svg>
        </div>

        {/* LỚP 3: Phôi in thực tế — Ảnh Macro vi sợi 0.12mm sắc nét */}
        <div className={`${styles.layer} ${styles.layerFinish}`}>
          <Image
            src="/images/minhlab-mascot-detail.png"
            alt="Mô hình Khỉ Kỹ Sư MinhLab in FDM với độ mịn 0.12mm"
            fill
            sizes="(max-width: 767px) 92vw, 45vw"
            priority
            className={styles.specimenImage}
          />
          <div className={styles.finishLighting} />
        </div>

        {/* Thẻ định danh vật phẩm */}
        <div className={styles.specimenOverlayBadge}>
          <span className={styles.badgeCode}>№ 01 / TOY</span>
          <span className={styles.badgeName}>Khỉ Kỹ Sư MinhLab</span>
        </div>
      </div>

      {/* Bảng thông số kỹ thuật (FDM Spec Sheet) */}
      <div className={styles.specSheet}>
        <div className={styles.specItem}>
          <span className={styles.specLabel}><Layers size={12} /> Độ mịn lớp</span>
          <span className={styles.specValue}>0.12 mm (Ultra-fine)</span>
        </div>
        <div className={styles.specItem}>
          <span className={styles.specLabel}><Cpu size={12} /> Vật liệu</span>
          <span className={styles.specValue}>PLA+ Tough nguyên sinh</span>
        </div>
        <div className={styles.specItem}>
          <span className={styles.specLabel}><Ruler size={12} /> Kích thước</span>
          <span className={styles.specValue}>12.0 × 8.5 × 15.0 cm</span>
        </div>
        <div className={styles.specItem}>
          <span className={styles.specLabel}><ShieldCheck size={12} /> Kiểm định</span>
          <span className={styles.specValue}><CheckCircle2 size={12} className={styles.checkedIcon} /> Đã kiểm định bavia</span>
        </div>
      </div>

      {/* Chú thích bản sắc người thợ */}
      <div className={styles.specimenFooter}>
        <span>TỶ LỆ KHẮC 1:1 · HOÀN THIỆN THỦ CÔNG TẠI XƯỞNG MINHLAB TP.HCM</span>
      </div>
    </div>
  );
}
