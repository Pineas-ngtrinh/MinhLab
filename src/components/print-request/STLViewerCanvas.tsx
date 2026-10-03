'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Center, Text } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Box, RotateCw, Layers, Sparkles, CheckCircle2 } from 'lucide-react';
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary';

interface STLViewerCanvasProps {
  file: File | null;
  filamentColor: string;
  wireframe: boolean;
  onDimensionsDetected?: (dims: { x: number; y: number; z: number; volumeCm3: number }) => void;
}

// Bàn in 3D FDM (Build Plate 220x220mm)
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

// Mẫu thử mặc định khi chưa tải file (Benchmark Calibration Cube)
function DefaultDemoModel({
  filamentColor,
  wireframe,
}: {
  filamentColor: string;
  wireframe: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group position={[0, 0.6, 0]}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial
          color={filamentColor}
          roughness={0.35}
          metalness={0.15}
          wireframe={wireframe}
        />
      </mesh>
      {/* Điểm định vị góc */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.04, 32]} />
        <meshStandardMaterial color="#27313C" roughness={0.6} />
      </mesh>
    </group>
  );
}

// Mô hình STL tải lên thực tế
function UserSTLModel({
  file,
  filamentColor,
  wireframe,
  onDimensionsDetected,
}: {
  file: File;
  filamentColor: string;
  wireframe: boolean;
  onDimensionsDetected?: (dims: { x: number; y: number; z: number; volumeCm3: number }) => void;
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) return;

        const loader = new STLLoader();
        const geom = loader.parse(buffer);

        geom.computeVertexNormals();
        geom.computeBoundingBox();

        if (geom.boundingBox && active) {
          const bbox = geom.boundingBox;
          const sizeX = bbox.max.x - bbox.min.x;
          const sizeY = bbox.max.y - bbox.min.y;
          const sizeZ = bbox.max.z - bbox.min.z;

          // Normalize model size to fit build plate (scale factor)
          const maxDim = Math.max(sizeX, sizeY, sizeZ);
          const scale = maxDim > 0 ? 2.5 / maxDim : 1;
          geom.scale(scale, scale, scale);
          geom.center();

          // Calculate approximate volume in cm3 (assuming 1 unit = 1mm before normalization)
          const volumeCm3 = Math.round((sizeX * sizeY * sizeZ * 0.0004) * 10) / 10;

          onDimensionsDetected?.({
            x: Math.round(sizeX),
            y: Math.round(sizeY),
            z: Math.round(sizeZ),
            volumeCm3: Math.max(volumeCm3, 5),
          });

          setGeometry(geom);
          setError(null);
        }
      } catch (err) {
        if (active) setError('Không thể đọc file STL. Vui lòng kiểm tra định dạng nhị phân/ASCII.');
      }
    };

    reader.onerror = () => {
      if (active) setError('Lỗi khi đọc tệp.');
    };

    reader.readAsArrayBuffer(file);

    return () => {
      active = false;
    };
  }, [file, onDimensionsDetected]);

  if (error) {
    return (
      <group position={[0, 0.5, 0]}>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#EB4037" wireframe />
        </mesh>
      </group>
    );
  }

  if (!geometry) return null;

  return (
    <group position={[0, 0.8, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={filamentColor}
          roughness={0.4}
          metalness={0.1}
          wireframe={wireframe}
        />
      </mesh>
    </group>
  );
}

export default function STLViewerCanvas({
  file,
  filamentColor,
  wireframe,
  onDimensionsDetected,
}: STLViewerCanvasProps) {
  const isSTL = file?.name?.toLowerCase().endsWith('.stl');

  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
      <CanvasErrorBoundary
        fallback={
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#070A0E] text-center text-xs font-mono text-[#A5ADB8]">
            <Box className="w-8 h-8 text-[#EB4037] mb-2" />
            <span>Chế độ xem 3D bàn máy FDM</span>
            <span className="text-[10px] text-[#737D89] mt-1">Đang chạy ở chế độ tối ưu đồ họa nhẹ</span>
          </div>
        }
      >
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [3.5, 3.2, 4.2], fov: 38 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={1.6} />
          <directionalLight
            position={[5, 8, 4]}
            intensity={2.8}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-4, 3, -3]} intensity={1.4} color="#FFE6CC" />

          <Suspense fallback={null}>
            <BuildPlate />

            {isSTL && file ? (
              <UserSTLModel
                file={file}
                filamentColor={filamentColor}
                wireframe={wireframe}
                onDimensionsDetected={onDimensionsDetected}
              />
            ) : (
              <DefaultDemoModel filamentColor={filamentColor} wireframe={wireframe} />
            )}
          </Suspense>

          <OrbitControls
            minDistance={2.5}
            maxDistance={8}
            maxPolarAngle={Math.PI / 2.05} // Không cho camera chìm dưới đáy bàn
            autoRotate={!file}
            autoRotateSpeed={0.8}
          />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
