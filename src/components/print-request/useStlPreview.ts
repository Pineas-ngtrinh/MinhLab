'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { previewFileKey, type PreviewDimensions } from './stl-preview-layout';

export interface PreviewModel { geometry: THREE.BufferGeometry; dimensions: PreviewDimensions }
export interface PreviewEntry { model?: PreviewModel; error?: string }
export function preparePreviewGeometry(buffer: ArrayBuffer): PreviewModel {
  const geometry = new STLLoader().parse(buffer);
  try {
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) throw new Error('Lưới STL không có khung bao.');
    const dimensions = { x: bounds.max.x - bounds.min.x, y: bounds.max.y - bounds.min.y, z: bounds.max.z - bounds.min.z };
    if (!Object.values(dimensions).every(value => Number.isFinite(value) && value > 0)) throw new Error('Khung bao STL không hợp lệ.');
    // STL Z-up -> Three Y-up; retain millimetres, center XY and ground the bottom.
    geometry.translate(-(bounds.max.x + bounds.min.x) / 2, -(bounds.max.y + bounds.min.y) / 2, -bounds.min.z);
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return { geometry, dimensions };
  } catch (error) { geometry.dispose(); throw error; }
}

/** Parse one file at a time; keep owned geometry when selection/color/scale changes. */
export function useStlPreview(files: File[]) {
  const cache = useRef(new Map<string, PreviewEntry>());
  const [entries, setEntries] = useState<Map<string, PreviewEntry>>(() => new Map());
  useEffect(() => {
    let active = true;
    let reader: FileReader | null = null;
    const retained = new Set(files.map(previewFileKey));
    for (const [key, value] of cache.current) if (!retained.has(key)) { value.model?.geometry.dispose(); cache.current.delete(key); }
    const publish = () => { if (active) setEntries(new Map(cache.current)); };
    const timer = window.setTimeout(() => {
      publish();
      let index = 0;
      function next() {
        if (!active) return;
        while (index < files.length && cache.current.has(previewFileKey(files[index]))) index++;
        if (index >= files.length) return;
        const file = files[index++], key = previewFileKey(file);
        reader = new FileReader();
        reader.onload = () => {
          if (!active) return;
          try {
            if (!(reader?.result instanceof ArrayBuffer)) throw new Error('Không đọc được file.');
            cache.current.set(key, { model: preparePreviewGeometry(reader.result) });
          } catch { cache.current.set(key, { error: 'Không thể hiển thị STL này. Hãy kiểm tra lưới hoặc xuất lại file.' }); }
          publish(); next();
        };
        reader.onerror = () => { if (active) { cache.current.set(key, { error: 'Không đọc được file trên thiết bị.' }); publish(); next(); } };
        reader.readAsArrayBuffer(file);
      }
      next();
    }, 0);
    return () => { active = false; window.clearTimeout(timer); if (reader?.readyState === FileReader.LOADING) reader.abort(); };
  }, [files]);
  useEffect(() => {
    const owned = cache.current;
    return () => { for (const value of owned.values()) value.model?.geometry.dispose(); owned.clear(); };
  }, []);
  return entries;
}
