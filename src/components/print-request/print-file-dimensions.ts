import type { MeshFeatures } from '../../lib/quote';

export interface PrintFileDimensions {
  x: number;
  y: number;
  z: number;
}

/** Measurements must remain available when the optional WebGL preview cannot run. */
export function resolvePrintFileDimensions(
  previewDimensions: PrintFileDimensions | null,
  features: Pick<MeshFeatures, 'bboxMm'> | null,
): PrintFileDimensions | null {
  if (previewDimensions) return previewDimensions;
  if (!features) return null;
  const { w, d, h } = features.bboxMm;
  if (![w, d, h].every((size) => Number.isFinite(size) && size > 0)) return null;
  return { x: w, y: d, z: h };
}
