'use client';

import React from 'react';
import Image from 'next/image';
import styles from './story-assembly.module.css';

export type StoryScene = 0 | 1 | 2 | 3 | 4 | 5;

interface StoryAssemblyStageProps {
  scene: StoryScene;
  reducedMotion?: boolean;
}

interface ScenePlate {
  index: string;
  label: string;
  src: string;
  focus: string;
}

export interface WorkshopObjectDef {
  id: string;
  name: string;
  clipPath: string;
  fromX: number;
  fromY: number;
  fromZ: number;
  rotX?: number;
  rotY?: number;
  scale?: number;
  delayMs: number;
  durationMs: number;
}

const SCENE_PLATES: readonly ScenePlate[] = [
  {
    index: '01',
    label: 'KHỞI NGUỒN',
    src: '/images/home-scenes/scene-01-origin.png',
    focus: '72% center',
  },
  {
    index: '02',
    label: 'BA LỐI KHÁM PHÁ',
    src: '/images/home-scenes/scene-02-paths.png',
    focus: '80% center',
  },
  {
    index: '03',
    label: 'BỘ SƯU TẬP',
    src: '/images/home-scenes/scene-03-collection.png',
    focus: '73% center',
  },
  {
    index: '04',
    label: 'XƯỞNG CHẾ TÁC',
    src: '/images/home-scenes/scene-04-lab.png',
    focus: '72% center',
  },
  {
    index: '05',
    label: 'IN THEO YÊU CẦU',
    src: '/images/home-scenes/scene-05-custom.png',
    focus: '72% center',
  },
  {
    index: '06',
    label: 'GÓC RIÊNG',
    src: '/images/home-scenes/scene-06-corner.png',
    focus: '73% center',
  },
] as const;

/**
 * Danh mục các mảnh ghép vật thể cấu thành từng bức tranh xưởng MinhLab.
 * Toàn bộ bức tranh được tách thành các chi tiết vật lý (bàn chế tác, bệ đỡ,
 * máy in, robot voxel, linh vật khỉ kỹ sư). Các mảnh bắt đầu từ trạng thái tách rời
 * trong không gian 3D và lần lượt bay vào, khớp nối chuẩn xác như một bộ lắp ghép tranh ảnh (puzzle/model kit),
 * hoàn thiện bức tranh xưởng chế tác sống động.
 */
const SCENE_OBJECTS: Record<StoryScene, readonly WorkshopObjectDef[]> = {
  // Cảnh 01: Khởi nguồn — Bàn walnut, bệ đá, thân robot, đầu robot và linh vật
  0: [
    {
      id: 's1-desk',
      name: 'Mặt bàn chế tác gỗ Walnut & Sổ vẽ',
      clipPath: 'polygon(0% 64%, 100% 64%, 100% 100%, 0% 100%)',
      fromX: 0,
      fromY: 90,
      fromZ: 0,
      delayMs: 100,
      durationMs: 650,
    },
    {
      id: 's1-pedestal',
      name: 'Bệ đá cẩm thạch đen trung tâm',
      clipPath: 'polygon(48% 57%, 82% 57%, 82% 76%, 48% 76%)',
      fromX: 0,
      fromY: 60,
      fromZ: 40,
      delayMs: 240,
      durationMs: 650,
    },
    {
      id: 's1-robot-torso',
      name: 'Khối ngực & Cánh tay Robot Voxel',
      clipPath: 'polygon(51% 30%, 79% 30%, 79% 62%, 51% 62%)',
      fromX: 0,
      fromY: -65,
      fromZ: 60,
      scale: 0.92,
      delayMs: 380,
      durationMs: 680,
    },
    {
      id: 's1-robot-head',
      name: 'Đầu Robot Voxel & Ăng-ten vàng',
      clipPath: 'polygon(51% 2%, 79% 2%, 79% 33%, 51% 33%)',
      fromX: 0,
      fromY: -95,
      fromZ: 80,
      delayMs: 500,
      durationMs: 700,
    },
    {
      id: 's1-mascot',
      name: 'Linh vật Khỉ Kỹ Sư MinhLab',
      clipPath: 'polygon(73% 34%, 96% 34%, 96% 86%, 73% 86%)',
      fromX: 70,
      fromY: 0,
      fromZ: 40,
      delayMs: 620,
      durationMs: 680,
    },
  ],

  // Cảnh 02: Ba lối khám phá — Bàn thao tác, cụm máy in, lồng kính, robot và khỉ kỹ sư
  1: [
    {
      id: 's2-desk',
      name: 'Bàn thao tác trung tâm',
      clipPath: 'polygon(0% 64%, 100% 64%, 100% 100%, 0% 100%)',
      fromX: 0,
      fromY: 80,
      fromZ: 0,
      delayMs: 100,
      durationMs: 650,
    },
    {
      id: 's2-printers',
      name: 'Cụm máy in FDM & Resin',
      clipPath: 'polygon(36% 46%, 68% 46%, 68% 94%, 36% 94%)',
      fromX: 0,
      fromY: -80,
      fromZ: 50,
      delayMs: 240,
      durationMs: 680,
    },
    {
      id: 's2-cloche',
      name: 'Lồng kính Art Toy mini',
      clipPath: 'polygon(30% 20%, 50% 20%, 50% 56%, 30% 56%)',
      fromX: -60,
      fromY: 0,
      fromZ: 30,
      delayMs: 360,
      durationMs: 650,
    },
    {
      id: 's2-hero-robot',
      name: 'Bục trưng bày Robot Voxel',
      clipPath: 'polygon(51% 7%, 69% 7%, 69% 48%, 51% 48%)',
      fromX: 0,
      fromY: -60,
      fromZ: 50,
      delayMs: 480,
      durationMs: 680,
    },
    {
      id: 's2-mascot',
      name: 'Khỉ Kỹ Sư hướng dẫn',
      clipPath: 'polygon(61% 25%, 81% 25%, 81% 65%, 61% 65%)',
      fromX: 60,
      fromY: 0,
      fromZ: 35,
      delayMs: 600,
      durationMs: 660,
    },
  ],

  // Cảnh 03: Bộ sưu tập — Bàn trưng bày, bệ đá, mô hình mini, robot chính và khỉ kỹ sư
  2: [
    {
      id: 's3-desk',
      name: 'Bàn trưng bày tiền cảnh',
      clipPath: 'polygon(0% 65%, 100% 65%, 100% 100%, 0% 100%)',
      fromX: 0,
      fromY: 80,
      fromZ: 0,
      delayMs: 100,
      durationMs: 650,
    },
    {
      id: 's3-pedestals',
      name: 'Bục đá cẩm thạch trung tâm',
      clipPath: 'polygon(48% 54%, 78% 54%, 78% 84%, 48% 84%)',
      fromX: 0,
      fromY: 50,
      fromZ: 35,
      delayMs: 240,
      durationMs: 650,
    },
    {
      id: 's3-mini',
      name: 'Robot mini trên bục trái',
      clipPath: 'polygon(39% 44%, 56% 44%, 56% 80%, 39% 80%)',
      fromX: -50,
      fromY: 0,
      fromZ: 30,
      delayMs: 360,
      durationMs: 650,
    },
    {
      id: 's3-hero-robot',
      name: 'Robot Voxel Art Toy trung tâm',
      clipPath: 'polygon(55% 15%, 75% 15%, 75% 64%, 55% 64%)',
      fromX: 0,
      fromY: -70,
      fromZ: 60,
      delayMs: 480,
      durationMs: 680,
    },
    {
      id: 's3-mascot',
      name: 'Khỉ Kỹ Sư kiểm định sản phẩm',
      clipPath: 'polygon(71% 38%, 88% 38%, 88% 82%, 71% 82%)',
      fromX: 60,
      fromY: 0,
      fromZ: 35,
      delayMs: 600,
      durationMs: 660,
    },
  ],

  // Cảnh 04: Xưởng chế tác — Bàn cắt, máy in FDM, máy Resin, mẫu in thử và khỉ kỹ sư
  3: [
    {
      id: 's4-desk',
      name: 'Bàn thao tác & Thảm cắt kỹ thuật',
      clipPath: 'polygon(0% 66%, 100% 66%, 100% 100%, 0% 100%)',
      fromX: 0,
      fromY: 80,
      fromZ: 0,
      delayMs: 100,
      durationMs: 650,
    },
    {
      id: 's4-fdm',
      name: 'Máy in 3D FDM & Cuộn filament PLA+',
      clipPath: 'polygon(37% 12%, 69% 12%, 69% 78%, 37% 78%)',
      fromX: 0,
      fromY: -90,
      fromZ: 50,
      delayMs: 240,
      durationMs: 680,
    },
    {
      id: 's4-resin',
      name: 'Máy in Resin nắp hổ phách',
      clipPath: 'polygon(65% 30%, 87% 30%, 87% 78%, 65% 78%)',
      fromX: 0,
      fromY: -60,
      fromZ: 40,
      delayMs: 360,
      durationMs: 660,
    },
    {
      id: 's4-product',
      name: 'Mẫu sản phẩm hoàn thiện trên bục',
      clipPath: 'polygon(79% 40%, 100% 40%, 100% 82%, 79% 82%)',
      fromX: 55,
      fromY: 0,
      fromZ: 25,
      delayMs: 480,
      durationMs: 640,
    },
    {
      id: 's4-mascot',
      name: 'Khỉ Kỹ Sư xác nhận đạt chuẩn 0.12mm',
      clipPath: 'polygon(59% 40%, 76% 40%, 76% 80%, 59% 80%)',
      fromX: 0,
      fromY: 40,
      fromZ: 35,
      delayMs: 600,
      durationMs: 650,
    },
  ],

  // Cảnh 05: In theo yêu cầu — Bàn kỹ thuật, bản vẽ CAD, khối voxel và khỉ kỹ sư
  4: [
    {
      id: 's5-desk',
      name: 'Mặt bàn kỹ thuật gỗ Walnut',
      clipPath: 'polygon(0% 64%, 100% 64%, 100% 100%, 0% 100%)',
      fromX: 0,
      fromY: 80,
      fromZ: 0,
      delayMs: 100,
      durationMs: 650,
    },
    {
      id: 's5-blueprint',
      name: 'Bản vẽ CAD kỹ thuật & Lưới đo',
      clipPath: 'polygon(31% 22%, 89% 22%, 89% 86%, 31% 86%)',
      fromX: 0,
      fromY: -50,
      fromZ: 25,
      scale: 0.94,
      delayMs: 240,
      durationMs: 650,
    },
    {
      id: 's5-voxel-parts',
      name: 'Các khối voxel lơ lửng trên bản vẽ',
      clipPath: 'polygon(59% 0%, 81% 0%, 81% 48%, 59% 48%)',
      fromX: 0,
      fromY: -80,
      fromZ: 60,
      delayMs: 380,
      durationMs: 680,
    },
    {
      id: 's5-mascot',
      name: 'Khỉ Kỹ Sư tư vấn thông số in',
      clipPath: 'polygon(68% 12%, 92% 12%, 92% 55%, 68% 55%)',
      fromX: 60,
      fromY: 0,
      fromZ: 35,
      delayMs: 520,
      durationMs: 650,
    },
  ],

  // Cảnh 06: Góc riêng — Bàn làm việc, robot trên kệ, hộp quà, robot mini và khỉ kỹ sư
  5: [
    {
      id: 's6-desk',
      name: 'Bàn làm việc desk setup & Bàn phím',
      clipPath: 'polygon(0% 63%, 100% 63%, 100% 100%, 0% 100%)',
      fromX: 0,
      fromY: 80,
      fromZ: 0,
      delayMs: 100,
      durationMs: 650,
    },
    {
      id: 's6-shelf-robot',
      name: 'Mô hình robot trên kệ sách',
      clipPath: 'polygon(63% 3%, 81% 3%, 81% 46%, 63% 46%)',
      fromX: 0,
      fromY: -60,
      fromZ: 35,
      delayMs: 240,
      durationMs: 650,
    },
    {
      id: 's6-packaging',
      name: 'Hộp quà đóng gói chống sốc MinhLab',
      clipPath: 'polygon(67% 56%, 99% 56%, 99% 86%, 67% 86%)',
      fromX: 60,
      fromY: 0,
      fromZ: 25,
      delayMs: 360,
      durationMs: 640,
    },
    {
      id: 's6-mini-robot',
      name: 'Robot mini để bàn làm việc',
      clipPath: 'polygon(53% 51%, 71% 51%, 71% 84%, 53% 84%)',
      fromX: 0,
      fromY: -40,
      fromZ: 35,
      delayMs: 480,
      durationMs: 640,
    },
    {
      id: 's6-mascot',
      name: 'Khỉ Kỹ Sư đồng hành chào bạn',
      clipPath: 'polygon(76% 40%, 99% 40%, 99% 87%, 76% 87%)',
      fromX: 60,
      fromY: 0,
      fromZ: 35,
      delayMs: 600,
      durationMs: 650,
    },
  ],
};

export default function StoryAssemblyStage({ scene, reducedMotion = false }: StoryAssemblyStageProps) {
  const current = SCENE_PLATES[scene];
  const activeObjects = SCENE_OBJECTS[scene] ?? [];

  return (
    <div
      className={styles.stage}
      data-story-assembly
      data-scene={scene}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      role="img"
      aria-label={`Bức tranh lắp ghép cảnh ${current.index}: ${current.label}`}
    >
      {/* Sân khấu lưới kỹ thuật / Khung bàn lắp ráp */}
      <div className={styles.blueprintGrid} aria-hidden="true" />

      <div className={styles.plates} aria-hidden="true">
        {SCENE_PLATES.map((plate, index) => {
          const isActive = index === scene;

          return (
            <div
              key={plate.src}
              className={styles.scenePlate}
              data-active={isActive ? 'true' : 'false'}
              data-plate={index}
            >
              {/* Tấm phôi tranh nền xưởng — tự xuất hiện như tấm canvas đầu tiên */}
              <div className={styles.baseImageWrap}>
                <Image
                  className={styles.sceneImage}
                  src={plate.src}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  style={{ objectPosition: plate.focus }}
                />
              </div>

              {/* Lớp các mảnh ghép vật thể tách rời của bộ lắp ghép tranh ảnh */}
              {isActive && !reducedMotion && (
                <div key={`assembly-${scene}`} className={styles.objectAssemblyLayer}>
                  {activeObjects.map((obj) => (
                    <div
                      key={obj.id}
                      className={styles.sceneObject}
                      style={{
                        '--clip': obj.clipPath,
                        '--from-x': `${obj.fromX}px`,
                        '--from-y': `${obj.fromY}px`,
                        '--from-z': `${obj.fromZ}px`,
                        '--rot-x': `${obj.rotX ?? 0}deg`,
                        '--rot-y': `${obj.rotY ?? 0}deg`,
                        '--scale': obj.scale ?? 1,
                        '--delay': `${obj.delayMs}ms`,
                        '--duration': `${obj.durationMs}ms`,
                      } as React.CSSProperties}
                    >
                      {/* Mảnh ghép hình ảnh mang hình khối vật thể */}
                      <div className={styles.objectClip}>
                        <Image
                          className={styles.sceneImage}
                          src={plate.src}
                          alt=""
                          fill
                          sizes="100vw"
                          style={{ objectPosition: plate.focus }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.copyScrim} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      {!reducedMotion && <span key={scene} className={styles.transitionSweep} aria-hidden="true" />}

      {/* Chỉ báo bộ lắp ghép tranh ảnh (Assembly Kit Badge) */}
      <div className={styles.assemblyBadge} aria-hidden="true">
        <span className={styles.assemblyDot} />
        <span>BỘ LẮP GHÉP TRANH · {activeObjects.length} CHI TIẾT</span>
      </div>

      <div className={styles.sceneMark} aria-hidden="true">
        <span>{current.index}</span>
        <span>{current.label}</span>
      </div>
    </div>
  );
}
