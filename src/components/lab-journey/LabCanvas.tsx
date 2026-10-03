'use client';

/**
 * =====================================================================
 * MINHLAB 3D - LAB CANVAS (KHÔNG GIAN XƯỞNG CHẾ TÁC THREE.JS CHUẨN XÁC)
 * =====================================================================
 * Thiết kế theo chỉ đạo nghệ thuật: Cinematic Dark Workshop
 * - 5 trạm thực tế trong mô hình 3D:
 *   1. Trạm Terminal & Soi File Lưới (DesignTerminal)
 *   2. Chuẩn bị thông số & Cuộn Filament (FilamentRack & Spools)
 *   3. Tiến hành in (Một máy FDM và một máy Resin)
 *   4. Hoàn thiện thủ công (Bàn Dụng Cụ Workbench & Gọt bavia)
 *   5. Kiểm định, đóng gói & Sản phẩm hoàn thiện (Mascot & Robot bàn kiểm định)
 * - Điều khiển chuyển động camera lerp mượt mà theo step active (Primary Control: Buttons)
 * - Đèn spotlight kỹ thuật tập trung vào trạm đang hoạt động
 * - Tối ưu hiệu năng: Tắt render khi khuất màn hình hoặc tab ẩn, DPR giới hạn 1.5
 * =====================================================================
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { createCustomizedLabScene } from '../../lib/scene-customization';

export type LabPhase = 'assembly' | 'explore';

export interface LabCanvasProps {
  phase?: LabPhase;
  assemblyProgress?: number;
  activeStep?: number; // 0 (Toàn cảnh) | 1..5 (Từng trạm)
  scrollProgress?: number; // 0 to 1
  isInView: boolean;
  isMobile: boolean;
  onReady?: () => void;
  onFail?: () => void;
}

// 6 Điểm Tọa Độ Vàng (0: Toàn cảnh, 1: Soi file, 2: Chuẩn bị, 3: Tiến hành in, 4: Hoàn thiện, 5: Kiểm định):
export const LAB_STEP_WAYPOINTS = [
  // 0: Toàn cảnh không gian xưởng MinhLab (Panoramic Overview)
  {
    pos: new THREE.Vector3(9.8, 7.8, 11.8),
    target: new THREE.Vector3(0.0, 1.4, -0.2),
    lightPos: new THREE.Vector3(0.0, 8.5, 0.0),
    lightColor: '#F4F1EA',
    spotIntensity: 2.2,
    spotAngle: Math.PI / 2.2,
  },
  // 1: Bước 01 — Trạm Terminal & Soi File Lưới (DesignTerminal)
  {
    pos: new THREE.Vector3(5.2, 3.8, 2.2),
    target: new THREE.Vector3(2.6, 1.6, -1.8),
    lightPos: new THREE.Vector3(2.8, 3.2, -1.5),
    lightColor: '#8492BD', // Technical blue
    spotIntensity: 3.5,
    spotAngle: Math.PI / 4,
  },
  // 2: Bước 02 — Chuẩn bị thông số & Cuộn Filament (FilamentRack)
  {
    pos: new THREE.Vector3(-1.8, 4.0, 3.8),
    target: new THREE.Vector3(-3.8, 1.6, -0.8),
    lightPos: new THREE.Vector3(-3.8, 3.2, -0.5),
    lightColor: '#D48955', // Warm filament light
    spotIntensity: 3.5,
    spotAngle: Math.PI / 4,
  },
  // 3: Bước 03 — Tiến hành in FDM (Cụm Máy In FDM 3D)
  {
    pos: new THREE.Vector3(-0.4, 3.2, 2.4),
    target: new THREE.Vector3(-2.2, 1.6, -1.9),
    lightPos: new THREE.Vector3(-2.2, 2.8, -1.9),
    lightColor: '#EB4037', // Brand red / heated nozzle
    spotIntensity: 3.8,
    spotAngle: Math.PI / 4,
  },
  // 4: Bước 04 — Hoàn thiện thủ công & Xử lý bavia (Bàn dụng cụ)
  {
    pos: new THREE.Vector3(-0.8, 3.0, 4.6),
    target: new THREE.Vector3(-2.4, 1.2, 1.4),
    lightPos: new THREE.Vector3(-2.4, 2.6, 1.4),
    lightColor: '#6F9576', // Precision green
    spotIntensity: 3.5,
    spotAngle: Math.PI / 4,
  },
  // 5: Bước 05 — Kiểm định, đóng gói & Sản phẩm hoàn thiện (Mascot & Robot bàn kiểm định)
  {
    pos: new THREE.Vector3(4.8, 3.8, 5.2),
    target: new THREE.Vector3(1.36, 1.4, 0.92),
    lightPos: new THREE.Vector3(1.36, 3.4, 0.92),
    lightColor: '#F4F1EA', // Clean spotlight
    spotIntensity: 3.5,
    spotAngle: Math.PI / 4,
  },
];

// Extras camera presets từ GLB
export const CAMERA_HERO_POSITION = new THREE.Vector3(11, 8.5, 13);
export const CAMERA_HERO_TARGET = new THREE.Vector3(0, 1.55, -0.25);
export const CAMERA_HERO_START_POSITION = new THREE.Vector3(10.2, 8.0, 12.0); // Dolly lùi nhẹ khi ráp

interface AssemblyPart {
  name: string;
  group: THREE.Object3D;
  finalPos: THREE.Vector3;
  startPos: THREE.Vector3;
  finalScale: THREE.Vector3;
  startScale: THREE.Vector3;
  isMascot: boolean;
  isRoom: boolean;
  startProgress: number;
  endProgress: number;
  materials: Array<{
    material: THREE.Material & { opacity?: number; transparent?: boolean };
    origTransparent: boolean;
    origOpacity: number;
  }>;
}

useGLTF.preload('/models/minhlab-lab-v1.glb');

function LabModel({
  animate,
  activeStep,
  phase = 'explore',
  assemblyProgress = 1,
  reducedMotion,
}: {
  animate: boolean;
  activeStep: number;
  phase?: LabPhase;
  assemblyProgress?: number;
  reducedMotion: boolean;
}) {
  const { scene, animations } = useGLTF('/models/minhlab-lab-v1.glb');
  const root = useRef<THREE.Group>(null);
  const wavedRef = useRef(false);

  const { instance, resinLift, dispose } = useMemo(() => createCustomizedLabScene(scene), [scene]);
  useEffect(() => dispose, [dispose]);

  // Cấu hình 7 nhóm node lắp ráp theo đúng cấu trúc GLB
  const assemblyParts = useMemo<AssemblyPart[]>(() => {
    if (!instance) return [];

    const definitions: Array<{
      names: string[];
      offset: THREE.Vector3;
      startProgress: number;
      endProgress: number;
      isMascot?: boolean;
      isRoom?: boolean;
    }> = [
      {
        names: ['Room_Static'],
        offset: new THREE.Vector3(0, 0, 0),
        startProgress: 0.0,
        endProgress: 0.22,
        isRoom: true,
      },
      {
        names: ['Workbench_Back'],
        offset: new THREE.Vector3(0, 2.5, -3.5),
        startProgress: 0.14,
        endProgress: 0.42,
      },
      {
        names: ['FilamentRack'],
        offset: new THREE.Vector3(-3.5, 0, 0),
        startProgress: 0.28,
        endProgress: 0.56,
      },
      {
        names: ['Printer_A', 'Printer_Resin', 'Printer_B'],
        offset: new THREE.Vector3(0, 3.2, 0),
        startProgress: 0.42,
        endProgress: 0.70,
      },
      {
        names: ['DesignTerminal'],
        offset: new THREE.Vector3(3.5, 1.2, 0),
        startProgress: 0.56,
        endProgress: 0.82,
      },
      {
        names: ['Workbench_Front'],
        offset: new THREE.Vector3(0, -1.8, 3.0),
        startProgress: 0.68,
        endProgress: 0.90,
      },
      {
        names: ['Mascot'],
        offset: new THREE.Vector3(0, 0, 0),
        startProgress: 0.78,
        endProgress: 1.0,
        isMascot: true,
      },
    ];

    const parts: AssemblyPart[] = [];

    for (const def of definitions) {
      for (const name of def.names) {
        const obj = instance.getObjectByName(name);
        if (!obj) continue;

        // Lưu position và scale gốc vào userData
        const finalPos = obj.position.clone();
        const finalScale = obj.scale.clone();
        obj.userData.finalPos = finalPos;
        obj.userData.finalScale = finalScale;

        const startPos = finalPos.clone().add(def.offset);
        const startScale = def.isMascot
          ? new THREE.Vector3(0.001, 0.001, 0.001)
          : finalScale.clone();

        // Thu thập toàn bộ material của nhóm
        const materialRecords: AssemblyPart['materials'] = [];
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of mats) {
              materialRecords.push({
                material: m,
                origTransparent: m.transparent,
                origOpacity: typeof m.opacity === 'number' ? m.opacity : 1,
              });
            }
          }
        });

        parts.push({
          name,
          group: obj,
          finalPos,
          startPos,
          finalScale,
          startScale,
          isMascot: !!def.isMascot,
          isRoom: !!def.isRoom,
          startProgress: def.startProgress,
          endProgress: def.endProgress,
          materials: materialRecords,
        });
      }
    }

    return parts;
  }, [instance]);

  useFrame(({ clock }) => {
    if (resinLift && animate && !reducedMotion) {
      resinLift.position.y = 1.38 + Math.pow(Math.sin(clock.elapsedTime * 0.35), 2) * 0.07;
    }

    if (!assemblyParts.length) return;

    const isAssembly = phase === 'assembly' && !reducedMotion && (assemblyProgress ?? 0) < 1;

    if (!isAssembly) {
      // Bàn giao hoàn toàn về trạng thái đã ráp xong
      for (const part of assemblyParts) {
        part.group.position.copy(part.finalPos);
        part.group.scale.copy(part.finalScale);
        for (const record of part.materials) {
          record.material.transparent = record.origTransparent;
          record.material.opacity = record.origOpacity;
        }
      }
      return;
    }

    const p = Math.max(0, Math.min(1, assemblyProgress ?? 0));

    for (const part of assemblyParts) {
      const rawT = (p - part.startProgress) / (part.endProgress - part.startProgress);
      const t = Math.max(0, Math.min(1, rawT));
      // Easing power2.out cho chuyển động rơi/trượt êm ái
      const ease = 1 - Math.pow(1 - t, 2);

      if (part.isRoom) {
        // Room_Static chỉ fade opacity
        part.group.position.copy(part.finalPos);
        part.group.scale.copy(part.finalScale);
        for (const record of part.materials) {
          record.material.transparent = true;
          record.material.opacity = ease * record.origOpacity;
        }
      } else if (part.isMascot) {
        // Mascot: scale từ 0.001 với pop-in nhẹ
        part.group.position.copy(part.finalPos);
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const mascotEase = t === 0 ? 0 : t === 1 ? 1 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        const scaleFactor = Math.max(0.001, mascotEase);
        part.group.scale.set(
          part.finalScale.x * scaleFactor,
          part.finalScale.y * scaleFactor,
          part.finalScale.z * scaleFactor
        );
        for (const record of part.materials) {
          record.material.transparent = record.origTransparent;
          record.material.opacity = record.origOpacity;
        }
      } else {
        // Các nhóm cơ khí (bàn, máy in, kệ): tween position và opacity
        part.group.position.lerpVectors(part.startPos, part.finalPos, ease);
        part.group.scale.copy(part.finalScale);
        for (const record of part.materials) {
          record.material.transparent = true;
          record.material.opacity = ease * record.origOpacity;
        }
      }
    }
  });

  const { actions } = useAnimations(animations, root);

  useEffect(() => {
    if (!actions) return;

    if (!animate || reducedMotion) {
      Object.values(actions).forEach((action) => action?.stop());
      return;
    }

    // Luôn chạy hoạt ảnh máy in khi ở explore mode hoặc khi đã ráp xong
    if (actions['Printer_A_Printing']) {
      actions['Printer_A_Printing'].reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
    if (actions['Mascot_Look']) {
      actions['Mascot_Look'].reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }

    return () => {
      Object.values(actions).forEach((action) => action?.stop());
    };
  }, [actions, animate, reducedMotion]);

  useEffect(() => {
    if (!actions || !animate || reducedMotion) return;

    // Khi ở bước 5 (kiểm định & đóng gói), kích hoạt cử chỉ Mascot vẫy tay chào mừng
    if (activeStep === 5 && phase === 'explore') {
      if (!wavedRef.current && actions['Mascot_Wave']) {
        wavedRef.current = true;
        actions['Mascot_Wave'].reset().setLoop(THREE.LoopOnce, 1).play();
      }
    } else {
      wavedRef.current = false;
    }
  }, [activeStep, actions, animate, reducedMotion, phase]);

  return (
    <group ref={root}>
      <primitive object={instance} dispose={null} />
    </group>
  );
}

// Điều chỉnh FOV thông minh trên mobile
function ResponsiveLabCamera({ isMobile }: { isMobile: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = isMobile ? 44 : 35;
      camera.updateProjectionMatrix();
    }
  }, [camera, isMobile]);
  return null;
}

// Bộ điều khiển camera lerp êm ái tới tọa độ của từng bước hoặc camera hero trong pha assembly
function CameraController({
  activeStep,
  phase = 'explore',
  assemblyProgress = 1,
  reducedMotion,
}: {
  activeStep: number;
  phase?: LabPhase;
  assemblyProgress?: number;
  reducedMotion: boolean;
}) {
  const currentPos = useRef(new THREE.Vector3().copy(CAMERA_HERO_POSITION));
  const currentTarget = useRef(new THREE.Vector3().copy(CAMERA_HERO_TARGET));

  function LAB_WAYPOINTS_TARGET(idx: number) {
    const clamped = Math.max(0, Math.min(LAB_STEP_WAYPOINTS.length - 1, idx));
    return LAB_STEP_WAYPOINTS[clamped].target;
  }

  function LAB_WAYPOINTS_POS(idx: number) {
    const clamped = Math.max(0, Math.min(LAB_STEP_WAYPOINTS.length - 1, idx));
    return LAB_STEP_WAYPOINTS[clamped].pos;
  }

  useFrame(({ camera }) => {
    let targetPos: THREE.Vector3;
    let targetLook: THREE.Vector3;

    if (phase === 'assembly' && !reducedMotion && (assemblyProgress ?? 0) < 1) {
      const p = Math.max(0, Math.min(1, assemblyProgress ?? 0));
      targetPos = new THREE.Vector3().lerpVectors(CAMERA_HERO_START_POSITION, CAMERA_HERO_POSITION, p);
      targetLook = CAMERA_HERO_TARGET;
    } else {
      targetPos = LAB_WAYPOINTS_POS(activeStep);
      targetLook = LAB_WAYPOINTS_TARGET(activeStep);
    }

    if (reducedMotion) {
      camera.position.copy(targetPos);
      camera.lookAt(targetLook);
      return;
    }

    // Lerp mượt mà với hệ số 0.075: chuyển cảnh trôi như drone quay phim điện ảnh
    currentPos.current.lerp(targetPos, 0.075);
    currentTarget.current.lerp(targetLook, 0.075);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);
  });

  return null;
}

// Đèn chiếu điểm kỹ thuật theo dõi trạm active
function StationHighlightLight({
  activeStep,
  phase = 'explore',
}: {
  activeStep: number;
  phase?: LabPhase;
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetObjRef = useRef<THREE.Object3D>(new THREE.Object3D());

  const effectiveStep = phase === 'assembly' ? 0 : activeStep;
  const currentStation = LAB_STEP_WAYPOINTS[Math.max(0, Math.min(LAB_STEP_WAYPOINTS.length - 1, effectiveStep))];

  useEffect(() => {
    if (lightRef.current && targetObjRef.current) {
      targetObjRef.current.position.copy(currentStation.target);
      lightRef.current.target = targetObjRef.current;
    }
  }, [currentStation]);

  // Khi activeStep đổi, lerp lightColor giữa waypoint cũ và mới trong khoảng 0.6-0.8s bằng gsap.to thay vì đổi tức thời
  useEffect(() => {
    if (!lightRef.current) return;
    const targetColor = new THREE.Color(currentStation.lightColor);
    const tween = gsap.to(lightRef.current.color, {
      r: targetColor.r,
      g: targetColor.g,
      b: targetColor.b,
      duration: 0.7,
      ease: 'power2.out',
    });
    return () => {
      tween.kill();
    };
  }, [currentStation.lightColor]);

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.position.lerp(currentStation.lightPos, 0.08);
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, currentStation.spotIntensity || 3.5, 0.08);
      lightRef.current.angle = THREE.MathUtils.lerp(lightRef.current.angle, currentStation.spotAngle || Math.PI / 4, 0.08);
    }
  });

  return (
    <>
      <primitive object={targetObjRef.current} />
      <spotLight
        ref={lightRef}
        position={currentStation.lightPos.toArray()}
        color={currentStation.lightColor}
        intensity={currentStation.spotIntensity || 3.5}
        distance={16}
        angle={currentStation.spotAngle || Math.PI / 4}
        penumbra={0.6}
        castShadow
        shadow-bias={-0.001}
      />
    </>
  );
}

export const LabCanvas: React.FC<LabCanvasProps> = ({
  phase = 'explore',
  assemblyProgress = 1,
  activeStep,
  scrollProgress,
  isInView,
  isMobile,
  onReady,
  onFail,
}) => {
  const resolvedStep = typeof activeStep === 'number'
    ? activeStep
    : Math.min(5, Math.max(0, Math.floor((scrollProgress || 0) * 6)));

  const [reducedMotion, setReducedMotion] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const handleMedia = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', handleMedia);

    const handleVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      media.removeEventListener('change', handleMedia);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const shouldAnimate = isInView && !reducedMotion && tabVisible;

  return (
    <div className="w-full h-full relative bg-[#0B0F14]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [11, 8.5, 13], fov: 35, near: 0.1, far: 100 }}
        frameloop={shouldAnimate ? 'always' : 'demand'}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={() => onReady?.()}
        onError={() => onFail?.()}
      >
        <ResponsiveLabCamera isMobile={isMobile} />
        <color attach="background" args={['#0B0F14']} />

        {/* Ánh sáng xưởng chế tác trầm ấm */}
        <ambientLight intensity={1.1} />
        <hemisphereLight args={['#F4F1EA', '#141A21', 1.2]} />

        <directionalLight
          position={[8, 14, 8]}
          intensity={2.4}
          color="#FFF9F2"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0005}
        />

        <directionalLight position={[-6, 6, -6]} intensity={1.2} color="#8492BD" />
        
        {/* Điểm nhấn đèn ấm tại bàn in */}
        <pointLight position={[-1.72, 2.8, -2.32]} intensity={3.5} distance={5} color="#D48955" />

        {/* Đèn spotlight động theo trạm */}
        <StationHighlightLight activeStep={resolvedStep} phase={phase} />

        <Suspense fallback={null}>
          <LabModel
            animate={shouldAnimate}
            activeStep={resolvedStep}
            phase={phase}
            assemblyProgress={assemblyProgress}
            reducedMotion={reducedMotion}
          />
          <CameraController
            activeStep={resolvedStep}
            phase={phase}
            assemblyProgress={assemblyProgress}
            reducedMotion={reducedMotion}
          />
        </Suspense>

        {/* Hiệu ứng Bloom hậu kỳ tác động lên các vật liệu emissive (đèn LED, đầu in, màn hình) */}
        {!reducedMotion && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom
              luminanceThreshold={0.9}
              luminanceSmoothing={0.15}
              intensity={isMobile ? 0.45 : 1.15}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
};

export default LabCanvas;
