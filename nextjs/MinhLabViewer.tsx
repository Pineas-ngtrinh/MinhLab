'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Component, useCallback, useState, type ReactNode } from 'react';

// ssr: false is intentionally declared in a Client Component, not app/page.tsx.
const Scene = dynamic(() => import('./MinhLabScene'), { ssr: false });

class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function MinhLabViewer() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const markFailed = useCallback(() => { setReady(false); setFailed(true); }, []);

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ position: 'relative', height: 'clamp(340px, 65vh, 720px)', background: '#101629' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <SceneBoundary onFailure={markFailed}><Scene onReady={markReady} /></SceneBoundary>
        </div>
        {!ready && (
          <Image
            src="/images/minhlab-lab-preview.png" alt="Phòng lab voxel MinhLab với hai máy in 3D và mascot khỉ"
            fill sizes="(max-width: 900px) 100vw, 1200px" style={{ objectFit: 'contain', pointerEvents: 'none' }}
          />
        )}
      </div>
      <figcaption style={{ padding: '0.75rem 0', fontSize: '0.875rem' }}>
        {failed ? 'Đang hiển thị ảnh thay thế.' : ready ? 'Kéo để xoay mô hình · Cuộn để phóng to/thu nhỏ' : 'Đang chuẩn bị mô hình 3D…'}
      </figcaption>
    </figure>
  );
}
