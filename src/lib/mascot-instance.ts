import * as THREE from 'three';
import { removeMascotHandheld } from './scene-customization';

/** Clone mutable materials once per source material; keep cached geometry/textures shared. */
export function createMascotInstance(source: THREE.Group) {
  const instance = source.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  const cloneMaterial = (material: THREE.Material) => {
    let clone = materials.get(material);
    if (!clone) {
      clone = material.clone();
      materials.set(material, clone);
    }
    return clone;
  };

  removeMascotHandheld(instance);
  instance.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });

  return {
    instance,
    setWireframe(enabled: boolean) {
      for (const material of materials.values()) {
        if ('wireframe' in material) material.wireframe = enabled;
      }
    },
    dispose() {
      for (const material of materials.values()) material.dispose();
    },
  };
}
