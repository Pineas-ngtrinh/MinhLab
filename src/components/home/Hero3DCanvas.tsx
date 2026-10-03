'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { removeMascotHandheld } from '../../lib/scene-customization';

// Preload 3D model asset
useGLTF.preload('/models/minhlab-mascot-v1.glb');

export type HeroMascotAction = 'idle' | 'greet' | 'point' | 'inspect' | 'hop';

interface Hero3DCanvasProps {
  action: HeroMascotAction;
  actionTrigger: number;
  wireframe: boolean;
  autoRotate: boolean;
  onLoaded?: () => void;
}

function MascotModel({
  action,
  actionTrigger,
  wireframe,
  onLoaded,
}: {
  action: HeroMascotAction;
  actionTrigger: number;
  wireframe: boolean;
  onLoaded?: () => void;
}) {
  const { scene } = useGLTF('/models/minhlab-mascot-v1.glb');
  const root = useRef<THREE.Group>(null);
  const hopProgress = useRef({ value: 0 });

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  const { instance, head, left, right, rest } = useMemo(() => {
    const instance = scene.clone(true);
    removeMascotHandheld(instance);

    instance.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const mat = child.material.clone() as THREE.MeshStandardMaterial;
          child.material = mat;
        }
      }
    });

    const head = instance.getObjectByName('Mascot_Head');
    const left = instance.getObjectByName('Mascot_LeftArm');
    const right = instance.getObjectByName('Mascot_RightArm');

    return {
      instance,
      head,
      left,
      right,
      rest: {
        head: head?.rotation.clone() ?? new THREE.Euler(),
        left: left?.rotation.clone() ?? new THREE.Euler(),
        right: right?.rotation.clone() ?? new THREE.Euler(),
      },
    };
  }, [scene]);

  // Apply wireframe toggle dynamically
  useEffect(() => {
    instance.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m.wireframe = wireframe;
          });
        } else {
          child.material.wireframe = wireframe;
        }
      }
    });
  }, [wireframe, instance]);

  // Ballistic hop timeline
  useEffect(() => {
    if (action === 'hop') {
      hopProgress.current.value = 0;
      const tween = gsap.to(hopProgress.current, {
        value: 1,
        duration: 0.65,
        ease: 'power1.inOut',
      });
      return () => {
        tween.kill();
      };
    }
  }, [action, actionTrigger]);

  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const time = clock.elapsedTime;
    const blend = (cur: number, tgt: number, speed = 8) =>
      THREE.MathUtils.damp(cur, tgt, speed, delta);

    let targetPosY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let targetScaleY = 1;

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
        targetScaleY = 1 + Math.sin(time * 1.8) * 0.01;
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
      case 'point': {
        targetRotY = 0.2;
        targetHeadY = rest.head.y + 0.2;
        targetHeadX = rest.head.x + 0.05;
        targetLeftZ = rest.left.z - 1.0;
        targetLeftX = rest.left.x - 0.45;
        targetLeftY = rest.left.y + 0.3;
        targetRightZ = rest.right.z - 0.2;
        break;
      }
      case 'inspect': {
        targetPosY = -0.04;
        targetRotX = 0.18;
        targetHeadX = rest.head.x + 0.25;
        targetHeadY = rest.head.y + Math.sin(time * 2) * 0.08;
        targetLeftZ = rest.left.z - 0.45;
        targetLeftX = rest.left.x - 0.3;
        targetRightZ = rest.right.z - 0.3;
        targetRightX = rest.right.x - 0.2;
        break;
      }
      case 'hop': {
        const p = hopProgress.current.value;
        if (p < 0.2) {
          targetScaleY = 0.82;
          targetPosY = -0.12;
        } else if (p < 0.7) {
          const arc = Math.sin(((p - 0.2) / 0.5) * Math.PI);
          targetPosY = arc * 0.4;
          targetScaleY = 1.15;
          targetRotY = Math.PI * 0.2;
        } else if (p < 0.9) {
          targetScaleY = 0.85;
          targetPosY = -0.06;
        } else {
          targetScaleY = 1;
          targetPosY = 0;
        }
        break;
      }
    }

    root.current.position.y = blend(root.current.position.y, targetPosY, 6);
    root.current.rotation.x = blend(root.current.rotation.x, targetRotX, 6);
    root.current.rotation.y = blend(root.current.rotation.y, targetRotY, 6);
    root.current.scale.y = blend(root.current.scale.y, targetScaleY, 6);

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
    <group ref={root} position={[0, -0.65, 0]} scale={[1.4, 1.4, 1.4]}>
      <primitive object={instance} dispose={null} />
    </group>
  );
}

export default function Hero3DCanvas({
  action,
  actionTrigger,
  wireframe,
  autoRotate,
  onLoaded,
}: Hero3DCanvasProps) {
  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.4, 3.8], fov: 36 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
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
            actionTrigger={actionTrigger}
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

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={1.5}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}
