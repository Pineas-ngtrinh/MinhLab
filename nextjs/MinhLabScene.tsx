'use client';

// Integration example. Install compatible three, @react-three/fiber and
// @react-three/drei versions in your existing Next.js project first.
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import type { Group, Mesh } from 'three';

function Room({ animate }: { animate: boolean }) {
  const { scene, animations } = useGLTF('/models/minhlab-lab-v1.glb');
  const root = useRef<Group>(null);
  // The supplied model uses rigid parts, not skeletal animation.
  const instance = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);
  const { actions } = useAnimations(animations, root);

  useEffect(() => {
    if (!animate) return;
    const active = Object.values(actions).filter((action) => action != null);
    active.forEach((action) => action.reset().fadeIn(0.25).play());
    return () => { active.forEach((action) => action.stop()); };
  }, [actions, animate]);

  return (
    <group ref={root}>
      <primitive object={instance} dispose={null} />
    </group>
  );
}

export default function MinhLabScene({ onReady }: { onReady?: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    const visibility = () => setTabVisible(!document.hidden);
    update();
    visibility();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (container.current) observer.observe(container.current);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
    };
  }, []);

  const animate = visible && tabVisible && !reducedMotion;
  return (
    <div ref={container} style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [11, 8.5, 13], fov: 40, near: 0.1, far: 100 }}
        frameloop={animate ? 'always' : 'demand'}
        fallback={<p>Thiết bị không hỗ trợ WebGL. Xem ảnh phòng lab bên dưới.</p>}
      >
        <color attach="background" args={['#101629']} />
        <ambientLight intensity={1.3} />
        <hemisphereLight args={['#d0d9ff', '#38425c', 1.7]} />
        <directionalLight
          position={[-3, 10, 8]} intensity={3.2} color="#ffdfbb" castShadow
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} shadow-normalBias={0.035}
          shadow-camera-left={-9} shadow-camera-right={9}
          shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-far={35}
        />
        <directionalLight position={[7, 6, -2]} intensity={1.2} color="#9699ff" />
        <pointLight position={[-2.8, 2.75, -2.4]} intensity={10} distance={4} color="#ffd086" />
        <pointLight position={[2.9, 3.2, -2.6]} intensity={12} distance={4} color="#ffbe78" />
        <Suspense fallback={null}>
          <Ready onReady={onReady}>
            <Room animate={animate} />
          </Ready>
        </Suspense>
        <OrbitControls
          target={[0, 1.55, -0.25]} minDistance={8} maxDistance={30}
          maxPolarAngle={Math.PI / 2.05} minPolarAngle={0.18}
          enablePan={false} enableDamping={!reducedMotion} dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}

function Ready({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  useEffect(() => { onReady?.(); }, [onReady]);
  return children;
}
