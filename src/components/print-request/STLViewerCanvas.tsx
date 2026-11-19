'use client';

import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Box } from 'lucide-react';
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary';
import { useStlPreview } from './useStlPreview';
import { layoutPreviewParts, previewFileKey, type PreviewDimensions } from './stl-preview-layout';
import { createFdmPreviewMaterial, PREVIEW_UNITS_PER_MM } from './fdm-preview-material';
import { DEFAULT_QUOTE_CONFIG } from '../../lib/quote';

interface STLViewerCanvasProps {
  files: File[];
  selectedFile: File | null;
  showAll: boolean;
  fdmSurface: boolean;
  filamentColor: string;
  wireframe: boolean;
  scalePercent: number;
  onSelect(file: File): void;
  onDimensionsDetected?: (dims: PreviewDimensions) => void;
}
const BUILD_PLATE_SURFACE_Y = -0.04;
const CAMERA_FOV = 38;
// Bàn in 3D FDM hiển thị theo kích thước Bambu Lab A1 mini (180x180mm)
function BuildPlate() {
  return (
    <group position={[0, -0.05, 0]}>
      {/* Khối bàn in nhôm gia nhiệt */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[4.4, 0.2, 4.4]} />
        <meshStandardMaterial color="#10151C" roughness={0.7} metalness={0.4} />
      </mesh>

      {/* Lớp phủ PEI nhám mờ đen than chì */}
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[4.2, 0.01, 4.2]} />
        <meshStandardMaterial color="#161C24" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Lưới vạch chia milimet */}
      <gridHelper args={[4.0, 20, '#EB4037', '#27313C']} position={[0, 0.012, 0]} />

      {/* Nhãn xưởng MinhLab in trên mép bàn */}
      <mesh position={[0, 0.013, 2.0]}>
        <planeGeometry args={[1.8, 0.15]} />
        <meshBasicMaterial color="#EB4037" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}


function PreviewMesh({ geometry, position, scale, filamentColor, wireframe, fdmSurface, selected, onSelect }: {
  geometry: THREE.BufferGeometry; position: [number, number, number]; scale: number;
  filamentColor: string; wireframe: boolean; fdmSurface: boolean; selected: boolean; onSelect(): void;
}) {
  const material = useMemo(() => {
    const value = fdmSurface && !wireframe
      ? createFdmPreviewMaterial(filamentColor, scale, DEFAULT_QUOTE_CONFIG.printer.layerHeightMm)
      : new THREE.MeshStandardMaterial({ color: filamentColor, roughness: 0.48, metalness: 0 });
    value.wireframe = wireframe;
    value.emissive.set(selected ? '#C8A261' : '#000000');
    value.emissiveIntensity = 0.12;
    return value;
  }, [fdmSurface, filamentColor, scale, selected, wireframe]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} dispose={null} position={position} scale={scale * PREVIEW_UNITS_PER_MM}
    onClick={event => { event.stopPropagation(); if (event.delta < 4) onSelect(); }} />;
}

export default function STLViewerCanvas({ files, selectedFile, showAll, fdmSurface, filamentColor, wireframe, scalePercent, onSelect, onDimensionsDetected }: STLViewerCanvasProps) {
  const entries = useStlPreview(files);
  const selectedModel = selectedFile ? entries.get(previewFileKey(selectedFile))?.model : null;
  useEffect(() => { if (selectedModel) onDimensionsDetected?.(selectedModel.dimensions); }, [selectedModel, onDimensionsDetected]);
  const scale = Number.isFinite(scalePercent) && scalePercent > 0 ? scalePercent / 100 : 1;
  const visible = (showAll ? files : files.filter(file => file === selectedFile)).flatMap(file => {
    const model = entries.get(previewFileKey(file))?.model;
    return model ? [{ file, model }] : [];
  });
  const layout = layoutPreviewParts(visible.map(part => part.model.dimensions), scale);
  const bounds = { x: Math.max(180, layout.width) * PREVIEW_UNITS_PER_MM,
    y: Math.max(1, layout.height) * PREVIEW_UNITS_PER_MM, z: Math.max(180, layout.depth) * PREVIEW_UNITS_PER_MM };
  const targetY = BUILD_PLATE_SURFACE_Y + bounds.y / 2;
  const fitExtent = Math.hypot(bounds.x, bounds.y + 0.4, bounds.z);
  const failed = files.filter(file => entries.get(previewFileKey(file))?.error);
  const completed = files.filter(file => entries.has(previewFileKey(file))).length;
  return <div className="relative h-full w-full select-none cursor-grab active:cursor-grabbing">
    <CanvasErrorBoundary fallback={<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-[#A5ADB8]"><Box aria-hidden="true" className="h-8 w-8" /><p>Thiết bị chưa mở được khung 3D. Bạn vẫn xem kết quả từng linh kiện ở danh sách bên dưới.</p></div>}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [3.5, 3.2, 4.2], fov: CAMERA_FOV, near: 0.001, far: Math.max(1000, fitExtent * 100) }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 3]} intensity={2.2} />
        <directionalLight position={[-4, 2, -2]} intensity={0.7} color="#FFE6CC" />
        <BuildPlate />
        {visible.map(({ file, model }, index) => <PreviewMesh key={previewFileKey(file)} geometry={model.geometry}
          position={[layout.positions[index].x * PREVIEW_UNITS_PER_MM, BUILD_PLATE_SURFACE_Y, layout.positions[index].z * PREVIEW_UNITS_PER_MM]}
          scale={scale} filamentColor={filamentColor} wireframe={wireframe} fdmSurface={fdmSurface} selected={file === selectedFile}
          onSelect={() => onSelect(file)} />)}
        <OrbitControls makeDefault minDistance={0.05} maxDistance={Math.max(16, fitExtent * 50)} maxPolarAngle={Math.PI / 2.05} target={[0, targetY, 0]} />
        <CameraFrame targetY={targetY} fitExtent={fitExtent} />
      </Canvas>
    </CanvasErrorBoundary>
    <div className="pointer-events-none absolute left-2 right-2 top-2 space-y-1 text-[11px] leading-5 text-[#A5ADB8]" role="status" aria-live="polite">
      {completed < files.length && <p className="w-fit rounded bg-[#0B0F14]/95 px-2">Đang mở 3D: {completed}/{files.length} file…</p>}
      {failed.map(file => <p key={previewFileKey(file)} className="break-words rounded bg-[#0B0F14]/95 px-2 text-[#FF8179]">{file.name}: {entries.get(previewFileKey(file))?.error}</p>)}
      {(layout.width > 180 || layout.depth > 180 || layout.height > 180) && <p className="rounded bg-[#0B0F14]/95 px-2 text-[#C8A261]">Bố trí xem trước vượt khổ 180 mm; cần xưởng sắp mẻ hoặc kiểm tra tỷ lệ.</p>}
    </div>
  </div>;
}

function CameraFrame({ targetY, fitExtent }: { targetY: number; fitExtent: number }) {
  const { camera, size } = useThree();
  const controls = useThree(state => state.controls) as OrbitControlsImpl | undefined;
  useEffect(() => {
    const aspect = Math.max(0.1, size.width / Math.max(1, size.height));
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * Math.min(1, aspect));
    const distance = Math.max(4.5, fitExtent / (2 * Math.sin(halfFov)) * 1.12);
    const target = new THREE.Vector3(0, targetY, 0);
    camera.position.copy(target).addScaledVector(new THREE.Vector3(0.55, 0.42, 0.72).normalize(), distance);
    camera.lookAt(target); camera.updateProjectionMatrix();
    if (controls) { controls.target.copy(target); controls.update(); }
  }, [camera, controls, fitExtent, targetY, size.width, size.height]);
  return null;
}
