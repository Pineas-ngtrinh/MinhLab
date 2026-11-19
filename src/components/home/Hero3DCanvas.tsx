'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { createMascotInstance } from '../../lib/mascot-instance';
import { useCanvasActivity } from '../../hooks/useCanvasActivity';

// Preload 3D model asset
useGLTF.preload('/models/minhlab-mascot-v1.glb');

export type HeroMascotAction = 'idle' | 'greet';

interface Hero3DCanvasProps {
  action: HeroMascotAction;
  wireframe: boolean;
  onLoaded?: () => void;
  animate?: boolean;
}

function MascotModel({
  action,
  wireframe,
  onLoaded,
  active,
}: {
  action: HeroMascotAction;
  wireframe: boolean;
  onLoaded?: () => void;
  active: boolean;
}) {
  const { scene } = useGLTF('/models/minhlab-mascot-v1.glb');
  const root = useRef<THREE.Group>(null);
  const motion = useRef<THREE.Group>(null);
  const { camera, size, invalidate } = useThree();
  const [targetY, setTargetY] = useState(0);

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  const { instance, head, left, right, rest, bounds, center, setWireframe, dispose } = useMemo(() => {
    const { instance, setWireframe, dispose } = createMascotInstance(scene);

    const head = instance.getObjectByName('Mascot_Head');
    const left = instance.getObjectByName('Mascot_LeftArm');
    const right = instance.getObjectByName('Mascot_RightArm');
    const bounds = new THREE.Box3().setFromObject(instance);
    const center = bounds.getCenter(new THREE.Vector3());

    return {
      instance,
      setWireframe,
      dispose,
      head,
      left,
      right,
      bounds,
      center,
      rest: {
        head: head?.rotation.clone() ?? new THREE.Euler(),
        left: left?.rotation.clone() ?? new THREE.Euler(),
        right: right?.rotation.clone() ?? new THREE.Euler(),
      },
    };
  }, [scene]);

  // Keep the model's proportions uniform and fit its complete silhouette to the
  // current canvas, including the wider orbit needed to turn it all the way around.
  useEffect(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const modelSize = bounds.getSize(new THREE.Vector3());
    const modelScale = 1.4;
    const groundY = -0.66;
    const focalY = groundY + modelSize.y * modelScale * 0.5;
    const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
    const horizontalFov = 2 * Math.atan(
      Math.tan(verticalFov * 0.5) * (size.width / Math.max(size.height, 1))
    );
    const margin = 0.76;
    const verticalDistance = (modelSize.y * modelScale * 0.5) / Math.tan(verticalFov * 0.5);
    const orbitHalfWidth = Math.hypot(modelSize.x, modelSize.z) * modelScale * 0.5;
    const horizontalDistance = orbitHalfWidth / Math.tan(horizontalFov * 0.5);
    const distance = Math.max(verticalDistance, horizontalDistance) / margin;

    if (root.current) root.current.position.y = focalY;
    perspectiveCamera.position.set(0, focalY + distance * 0.08, distance);
    perspectiveCamera.lookAt(0, focalY, 0);
    perspectiveCamera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes browser, WebGL or remote API state after mount; keep SSR hydration deterministic.
    setTargetY(focalY);
  }, [bounds, camera, size.height, size.width]);

  useEffect(() => dispose, [dispose]);

  useEffect(() => {
    setWireframe(wireframe);
    invalidate();
  }, [wireframe, setWireframe, invalidate]);

  useFrame(({ clock }, delta) => {
    if (!active || !root.current) return;
    if (!motion.current) return;
    const time = clock.elapsedTime;
    const blend = (cur: number, tgt: number, speed = 8) =>
      THREE.MathUtils.damp(cur, tgt, speed, delta);

    let targetPosY = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    let targetHeadX = rest.head.x;
    let targetHeadY = rest.head.y;
    let targetHeadZ = rest.head.z;

    let targetLeftX = rest.left.x;
    let targetLeftY = rest.left.y;
    let targetLeftZ = rest.left.z;

    let targetRightX = rest.right.x;
    let targetRightY = rest.right.y;
    let targetRightZ = rest.right.z;

    switch (action) {
      case 'idle': {
        targetPosY = Math.sin(time * 1.8) * 0.025;
        targetHeadY = rest.head.y + Math.sin(time * 0.8) * 0.1;
        targetHeadX = rest.head.x + Math.sin(time * 1.2) * 0.04;
        targetLeftZ = rest.left.z + Math.sin(time * 1.8) * 0.04;
        targetRightZ = rest.right.z - Math.sin(time * 1.8) * 0.04;
        break;
      }
      case 'greet': {
        targetPosY = Math.sin(time * 2.5) * 0.03;
        targetHeadY = rest.head.y + Math.sin(time * 2) * 0.06;
        targetHeadX = rest.head.x - 0.05;
        // Waving left hand
        targetLeftZ = rest.left.z - 1.2 + Math.sin(time * 8) * 0.3;
        targetLeftX = rest.left.x - 0.35;
        targetLeftY = rest.left.y + 0.25;
        targetRightZ = rest.right.z - 0.15;
        break;
      }
    }

    root.current.rotation.x = blend(root.current.rotation.x, targetRotX, 6);
    root.current.rotation.y = blend(root.current.rotation.y, targetRotY, 6);
    motion.current.position.y = blend(motion.current.position.y, targetPosY, 6);

    if (head) {
      head.rotation.set(
        blend(head.rotation.x, targetHeadX, 6),
        blend(head.rotation.y, targetHeadY, 6),
        blend(head.rotation.z, targetHeadZ, 6)
      );
    }
    if (left) {
      left.rotation.set(
        blend(left.rotation.x, targetLeftX, 6),
        blend(left.rotation.y, targetLeftY, 6),
        blend(left.rotation.z, targetLeftZ, 6)
      );
    }
    if (right) {
      right.rotation.set(
        blend(right.rotation.x, targetRightX, 6),
        blend(right.rotation.y, targetRightY, 6),
        blend(right.rotation.z, targetRightZ, 6)
      );
    }
  });

  return (
    <>
      <group ref={root} scale={1.4}>
        <group ref={motion}>
          <primitive object={instance} position={center.clone().negate()} dispose={null} />
        </group>
      </group>
      <OrbitControls
        enableRotate
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        enableDamping={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, targetY, 0]}
      />
    </>
  );
}

/** Idle motion needs only 30 scheduled frames/s; OrbitControls still invalidates on interaction. */
function IdleFrames({ enabled }: { enabled: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    if (!enabled) return;
    const timer = window.setInterval(() => invalidate(), 1000 / 30);
    return () => window.clearInterval(timer);
  }, [enabled, invalidate]);
  return null;
}

export default function Hero3DCanvas({
  animate = true,
  action,
  wireframe,
  onLoaded,
}: Hero3DCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const active = useCanvasActivity(container);

  return (
    <div ref={container} className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 8], fov: 36 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <IdleFrames enabled={active && animate} />
        <ambientLight intensity={1.8} />
        <directionalLight
          position={[-3, 6, 5]}
          intensity={3.2}
          color="#FFF8EB"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[4, 3, 3]} intensity={1.6} color="#FFE6CC" />
        <directionalLight position={[0, 4, -4]} intensity={1.5} color="#C8A261" />

        <Suspense fallback={null}>
          <MascotModel
            action={action}
            active={active && animate}
            wireframe={wireframe}
            onLoaded={onLoaded}
          />
          <ContactShadows
            position={[0, -0.66, 0]}
            opacity={0.55}
            scale={4.2}
            blur={2.4}
            far={3.0}
            frames={1}
          />
        </Suspense>

      </Canvas>
    </div>
  );
}
