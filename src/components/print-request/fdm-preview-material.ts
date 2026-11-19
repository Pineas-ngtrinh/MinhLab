import * as THREE from 'three';

export const PREVIEW_UNITS_PER_MM = 4.2 / 180;
/** Procedural surface illustration only, never a slicer/toolpath prediction. */
export function createFdmPreviewMaterial(color: string, scale: number, layerHeightMm: number) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0 });
  // Three r160 enables derivatives for MeshStandardMaterial (physical shader).
  material.customProgramCacheKey = () => 'minhlab-fdm-surface-v1';
  material.onBeforeCompile = shader => {
    shader.uniforms.fdmScale = { value: scale };
    shader.uniforms.fdmLayer = { value: layerHeightMm };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vFdmPosition;
      varying vec3 vFdmNormal;
      uniform float fdmScale;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vFdmPosition = position * fdmScale;
      vFdmNormal = normalize(normal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vFdmPosition;
      varying vec3 vFdmNormal;
      uniform float fdmLayer;`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float sideCoord = vFdmPosition.y / fdmLayer;
      float topCoord = (vFdmPosition.x + vFdmPosition.z) / (0.42 * 1.41421356);
      float sideFade = 1.0 - smoothstep(0.25, 0.8, fwidth(sideCoord));
      float topFade = 1.0 - smoothstep(0.25, 0.8, fwidth(topCoord));
      float topWeight = smoothstep(0.75, 0.98, abs(normalize(vFdmNormal).y));
      float sideWave = cos(6.2831853 * sideCoord) * sideFade;
      float topWave = cos(6.2831853 * topCoord) * topFade;
      float rib = mix(sideWave, topWave, topWeight);
      diffuseColor.rgb *= 0.96 + 0.04 * rib;
      float ridgeHeight = ${PREVIEW_UNITS_PER_MM.toFixed(10)} * 0.018 * rib;
      vec3 sigmaX = dFdx(-vViewPosition);
      vec3 sigmaY = dFdy(-vViewPosition);
      vec3 r1 = cross(sigmaY, normal);
      vec3 r2 = cross(normal, sigmaX);
      float determinant = dot(sigmaX, r1);
      vec3 gradient = sign(determinant) * (dFdx(ridgeHeight) * r1 + dFdy(ridgeHeight) * r2);
      normal = normalize(abs(determinant) * normal - gradient + normal * 1e-12);`);
  };
  return material;
}
