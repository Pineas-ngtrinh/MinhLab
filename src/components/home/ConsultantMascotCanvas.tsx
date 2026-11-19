'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import type { ConsultantMascotProps } from './ConsultantMascot';
import { removeMascotHandheld } from '../../lib/scene-customization';

// Preload 3D model asset immediately
useGLTF.preload('/models/minhlab-mascot-v1.glb');

interface ExtendedCanvasProps extends ConsultantMascotProps {
  onLoaded?: () => void;
}

function ConsultantModel({ action, facing, actionTrigger, reducedMotion, onLoaded }: ExtendedCanvasProps) {
  const { scene } = useGLTF('/models/minhlab-mascot-v1.glb');
  const root = useRef<THREE.Group>(null);
  const hopProgress = useRef({ value: 0 });

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  const { instance, head, left, right, rest } = useMemo(() => {
    const instance = scene.clone(true);
    removeMascotHandheld(instance);
    instance.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
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

  // Handle ballistic hop timeline when actionTrigger fires hop
  useEffect(() => {
    if (action === 'hop' && !reducedMotion) {
      hopProgress.current.value = 0;
      const tween = gsap.to(hopProgress.current, {
        value: 1,
        duration: 0.65,
        ease: 'power1.inOut',
      });
      return () => { tween.kill(); };
    } else {
      hopProgress.current.value = 0;
    }
  }, [action, actionTrigger, reducedMotion]);

  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const time = clock.elapsedTime;
    const blend = (cur: number, tgt: number, speed = 8) =>
      reducedMotion ? tgt : THREE.MathUtils.damp(cur, tgt, speed, delta);

    // Default target poses
    let targetPosX = 0;
    let targetPosY = 0;
    let targetPosZ = 0;
    let targetRotY = facing * 0.15;
    let targetRotX = 0;
    let targetRotZ = 0;
    let targetScaleX = 1;
    let targetScaleY = 1;
    let targetScaleZ = 1;

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
        targetPosY = Math.sin(time * 1.8) * 0.02;
        targetScaleY = 1 + Math.sin(time * 1.8) * 0.01;
        targetRotY = facing * 0.18 + (reducedMotion ? 0 : Math.sin(time * 0.5) * 0.08);
        targetHeadY = rest.head.y + (reducedMotion ? 0 : Math.sin(time * 0.8) * 0.1);
        targetHeadX = rest.head.x + (reducedMotion ? 0 : Math.sin(time * 1.2) * 0.04);
        targetHeadZ = rest.head.z + (reducedMotion ? 0 : Math.sin(time * 0.8) * 0.02);
        targetLeftZ = rest.left.z + (reducedMotion ? 0 : Math.sin(time * 1.8) * 0.03);
        targetRightZ = rest.right.z + (reducedMotion ? 0 : Math.sin(time * 1.8) * 0.02);
        break;
      }

      case 'walk': {
        const stepFreq = 4.8;
        const phase = time * stepFreq;
        targetPosY = Math.abs(Math.sin(phase)) * 0.035;
        targetRotZ = Math.sin(phase) * 0.025;
        targetRotX = 0.04;
        targetRotY = facing * 0.22;
        targetHeadX = rest.head.x + 0.03 + Math.cos(phase) * 0.02;
        targetHeadY = rest.head.y + facing * 0.05;
        targetHeadZ = rest.head.z - Math.sin(phase) * 0.02;
        targetLeftZ = rest.left.z + Math.sin(phase) * 0.25;
        targetLeftX = rest.left.x - Math.cos(phase) * 0.15;
        targetRightZ = rest.right.z - Math.sin(phase) * 0.20;
        targetRightX = rest.right.x + Math.cos(phase) * 0.12;
        break;
      }

      case 'greet': {
        targetPosY = Math.sin(time * 2.5) * 0.025;
        targetRotY = facing * 0.15;
        targetHeadY = rest.head.y + Math.sin(time * 2) * 0.06;
        targetHeadX = rest.head.x - 0.05;
        targetHeadZ = rest.head.z - facing * 0.06;
        targetLeftZ = rest.left.z - 1.15 + Math.sin(time * 8) * 0.25;
        targetLeftX = rest.left.x - 0.35;
        targetLeftY = rest.left.y + 0.25;
        targetRightZ = rest.right.z - 0.15;
        break;
      }

      case 'point': {
        targetRotY = facing * 0.24;
        targetRotX = -0.03;
        targetHeadY = rest.head.y + facing * 0.25;
        targetHeadX = rest.head.x + 0.05;
        targetLeftZ = rest.left.z - 0.95;
        targetLeftX = rest.left.x - 0.45;
        targetLeftY = rest.left.y + 0.3;
        targetRightZ = rest.right.z - 0.2;
        break;
      }

      case 'inspect': {
        targetPosY = -0.03;
        targetRotX = 0.18;
        targetRotY = facing * 0.20;
        targetHeadX = rest.head.x + 0.25;
        targetHeadZ = rest.head.z - facing * 0.10;
        targetHeadY = rest.head.y + Math.sin(time * 2.2) * 0.08;
        targetLeftZ = rest.left.z - 0.45;
        targetLeftX = rest.left.x - 0.3;
        targetLeftY = rest.left.y + 0.35;
        targetRightZ = rest.right.z - 0.3;
        targetRightX = rest.right.x - 0.2;
        break;
      }

      case 'work': {
        targetPosY = Math.sin(time * 6) * 0.006;
        targetRotX = 0.10;
        targetRotY = facing * 0.20;
        targetHeadX = rest.head.x + 0.18;
        targetHeadY = rest.head.y + facing * 0.12;
        targetRightZ = rest.right.z - 0.45 + Math.sin(time * 12) * 0.02;
        targetRightX = rest.right.x - 0.30 + Math.cos(time * 12) * 0.02;
        targetLeftZ = rest.left.z - 0.30;
        targetLeftX = rest.left.x - 0.20;
        break;
      }

      case 'hop': {
        const p = hopProgress.current.value;
        if (p < 0.2) {
          // Anticipation squash
          targetScaleY = 0.82;
          targetPosY = -0.12;
          targetRotX = 0.15;
          targetLeftZ = rest.left.z - 0.3;
          targetRightZ = rest.right.z - 0.3;
        } else if (p < 0.7) {
          // Ballistic arc
          const arcPhase = (p - 0.2) / 0.5;
          const arc = Math.sin(arcPhase * Math.PI);
          targetPosY = arc * 0.38;
          targetScaleY = 1.14;
          targetRotX = -0.12;
          targetRotY = facing * 0.35 * Math.PI;
          targetLeftZ = rest.left.z - 0.7;
          targetRightZ = rest.right.z + 0.2;
        } else if (p < 0.9) {
          // Landing cushion
          targetScaleY = 0.84;
          targetPosY = -0.07;
          targetRotX = 0.1;
          targetLeftZ = rest.left.z - 0.2;
          targetRightZ = rest.right.z - 0.2;
        } else {
          // Recovery
          targetScaleY = 1;
          targetPosY = 0;
        }
        break;
      }

      case 'celebrate': {
        targetPosY = Math.abs(Math.sin(time * 6.5)) * 0.11;
        targetRotY = Math.sin(time * 4) * 0.2;
        targetRotX = -0.08;
        targetHeadX = rest.head.x - 0.18;
        targetHeadZ = rest.head.z + Math.sin(time * 6) * 0.08;
        targetLeftZ = rest.left.z - 1.45;
        targetLeftX = rest.left.x - 0.2;
        targetRightZ = rest.right.z + 0.25 + Math.sin(time * 8) * 0.18;
        targetRightX = rest.right.x - 0.3;
        break;
      }
    }

    // Apply blended transforms to root
    root.current.position.set(
      blend(root.current.position.x, targetPosX, 5.5),
      blend(root.current.position.y, targetPosY, 5.5),
      blend(root.current.position.z, targetPosZ, 5.5)
    );
    root.current.rotation.set(
      blend(root.current.rotation.x, targetRotX, 5.5),
      blend(root.current.rotation.y, targetRotY, 5.5),
      blend(root.current.rotation.z, targetRotZ, 5.5)
    );
    root.current.scale.set(
      blend(root.current.scale.x, targetScaleX, 5.5),
      blend(root.current.scale.y, targetScaleY, 5.5),
      blend(root.current.scale.z, targetScaleZ, 5.5)
    );

    // Apply blended transforms to joints
    if (head) {
      head.rotation.set(
        blend(head.rotation.x, targetHeadX, 5.5),
        blend(head.rotation.y, targetHeadY, 5.5),
        blend(head.rotation.z, targetHeadZ, 5.5)
      );
    }
    if (left) {
      left.rotation.set(
        blend(left.rotation.x, targetLeftX, 5.5),
        blend(left.rotation.y, targetLeftY, 5.5),
        blend(left.rotation.z, targetLeftZ, 5.5)
      );
    }
    if (right) {
      right.rotation.set(
        blend(right.rotation.x, targetRightX, 5.5),
        blend(right.rotation.y, targetRightY, 5.5),
        blend(right.rotation.z, targetRightZ, 5.5)
      );
    }
  });

  return (
    <group ref={root}>
      <primitive object={instance} dispose={null} />
    </group>
  );
}

function CameraFraming() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const halfHeight = Math.max(1.7, 1.85 / Math.min(aspect, 1.2));
    camera.position.set(0, 1.55, halfHeight / Math.tan(THREE.MathUtils.degToRad(16)));
    camera.lookAt(0, 1.45, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

export default function ConsultantMascotCanvas(props: ExtendedCanvasProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.55, 7.5], fov: 32 }}
      frameloop={props.active && !props.reducedMotion ? 'always' : 'demand'}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[-3, 6, 5]} intensity={3} color="#FFF8EB" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[4, 4, 3]} intensity={1.8} />
      <directionalLight position={[0, 4, -3]} intensity={1.3} color="#C8A261" />
      <Suspense fallback={null}>
        <ConsultantModel {...props} />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.45} scale={5} blur={2.2} far={3.5} frames={1} />
      </Suspense>
      <CameraFraming />
      {!props.reducedMotion && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            luminanceThreshold={0.9}
            luminanceSmoothing={0.15}
            intensity={0.4}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}
