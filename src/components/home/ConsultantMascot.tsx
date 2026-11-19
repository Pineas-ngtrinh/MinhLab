'use client';

import { Component, useState, useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { SITE_CONFIG } from '../../config/site.config';

const ConsultantCanvas = dynamic(() => import('./ConsultantMascotCanvas'), {
  ssr: false,
  loading: () => <MascotStill loading />,
});

function MascotStill({ loading = false }: { loading?: boolean }) {
  return <div className="relative h-full w-full overflow-hidden">
    <Image src="/images/minhlab-mascot-free-v2.png" alt={SITE_CONFIG.homeConsultant.fallback}
      fill sizes="(max-width: 767px) 80px, 140px" className="object-cover" style={{ objectPosition: '50% 61%' }} priority />
    {loading && <span role="status" className="absolute bottom-4 inset-x-0 text-center text-xs text-[#A5ADB8]">
      {SITE_CONFIG.homeConsultant.loading}
    </span>}
  </div>;
}

class MascotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <MascotStill /> : this.props.children; }
}

export type MascotAction = 'idle' | 'walk' | 'greet' | 'point' | 'inspect' | 'work' | 'hop' | 'celebrate';

export interface ConsultantMascotProps {
  action: MascotAction;
  facing: -1 | 1;
  actionTrigger: number;
  reducedMotion: boolean;
  active: boolean;
}

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export default function ConsultantMascot(props: ConsultantMascotProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes browser, WebGL or remote API state after mount; keep SSR hydration deterministic.
    setSupported(isWebGLAvailable());
  }, []);

  if (supported === false) {
    return <MascotStill />;
  }

  return (
    <div className="relative w-full h-full">
      {!modelReady && (
        <div className="absolute inset-0 z-0">
          <MascotStill loading />
        </div>
      )}
      <div className={`relative z-10 w-full h-full transition-opacity duration-300 ${modelReady ? 'opacity-100' : 'opacity-0'}`}>
        <MascotBoundary>
          <ConsultantCanvas {...props} onLoaded={() => setModelReady(true)} />
        </MascotBoundary>
      </div>
    </div>
  );
}
