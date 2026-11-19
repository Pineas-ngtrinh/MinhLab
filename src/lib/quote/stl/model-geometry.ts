/** Exact geometry transforms used by model_improved_v3/geometry.py (schema 2). */
export interface ModelGeometry {
  x_mm: number; y_mm: number; z_mm: number;
  volume_mm3: number; surface_mm2: number; bbox_mm3: number; triangles: number;
  vertical_area_mm2: number; horizontal_area_mm2: number;
  overhang_projected_mm2: number; support_envelope_mm3: number; bottom_area_mm2: number;
  section_perimeter_mean_mm: number; section_perimeter_max_mm: number; section_perimeter_cv: number;
  section_area_mean_mm2: number; section_area_max_mm2: number; section_area_cv: number;
  section_complexity: number;
}

type Visitor = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number) => void;
interface Source { triangleCount: number; forEachTriangle(visitor: Visitor): void }
type Point = readonly [number, number, number];

function summarize(values: number[]): { mean: number; max: number; cv: number } {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, max: Math.max(...values), cv: Math.sqrt(variance) / Math.max(mean, 1e-9) };
}

export function extractModelGeometry(source: Source, min: Point, dims: Point, winding: number): ModelGeometry | undefined {
  if (dims.some(value => value <= 0)) return undefined;
  let signedVolume = 0, surface = 0, vertical = 0, horizontal = 0, overhang = 0, support = 0, bottom = 0;
  const perimeters = Array<number>(24).fill(0);
  const sections = Array<number>(24).fill(0);
  const orientation = winding > 0 ? 1 : -1;
  source.forEachTriangle((x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
    const t: Point[] = [[x1 - min[0], y1 - min[1], z1 - min[2]],
      [x2 - min[0], y2 - min[1], z2 - min[2]], [x3 - min[0], y3 - min[1], z3 - min[2]]];
    const ab = t[1].map((v, i) => v - t[0][i]);
    const ac = t[2].map((v, i) => v - t[0][i]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const doubleArea = Math.hypot(...cross);
    if (doubleArea <= 1e-12) return;
    signedVolume += (t[0][0] * cross[0] + t[0][1] * cross[1] + t[0][2] * cross[2]) / 6;
    const normals = cross.map(v => v / doubleArea * orientation);
    const nz = normals[2], area = doubleArea / 2;
    const zMin = Math.min(t[0][2], t[1][2], t[2][2]);
    const zMax = Math.max(t[0][2], t[1][2], t[2][2]);
    surface += area;
    vertical += area * Math.sqrt(Math.max(0, 1 - nz ** 2));
    horizontal += area * Math.abs(nz);
    if (nz < -Math.SQRT1_2 && zMin > dims[2] * 0.002) {
      const projected = area * -nz;
      overhang += projected;
      support += projected * (t[0][2] + t[1][2] + t[2][2]) / 3;
    }
    if (zMax < dims[2] * 0.002 && nz < 0) bottom += area;
    for (let index = 0; index < 24; index++) {
      const height = dims[2] * (0.01 + index * (0.98 / 23));
      if (zMin >= height || zMax <= height) continue;
      const points: number[][] = [];
      for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
        const a = t[i], b = t[j];
        if ((a[2] < height && b[2] >= height) || (b[2] < height && a[2] >= height)) {
          const fraction = (height - a[2]) / (b[2] - a[2]);
          points.push([a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])]);
        }
      }
      if (points.length !== 2) continue;
      const [first, second] = points;
      const dx = second[0] - first[0], dy = second[1] - first[1];
      const sign = Math.sign(-dx * normals[1] + dy * normals[0]);
      perimeters[index] += Math.hypot(dx, dy);
      sections[index] += (first[0] * second[1] - second[0] * first[1]) * sign / 2;
    }
  });
  const volume = Math.abs(signedVolume);
  if (volume <= 0) return undefined;
  const perimeter = summarize(perimeters), section = summarize(sections.map(Math.abs));
  return {
    x_mm: dims[0], y_mm: dims[1], z_mm: dims[2], volume_mm3: volume,
    surface_mm2: surface, bbox_mm3: dims[0] * dims[1] * dims[2], triangles: source.triangleCount,
    vertical_area_mm2: vertical, horizontal_area_mm2: horizontal,
    overhang_projected_mm2: overhang, support_envelope_mm3: support, bottom_area_mm2: bottom,
    section_perimeter_mean_mm: perimeter.mean, section_perimeter_max_mm: perimeter.max, section_perimeter_cv: perimeter.cv,
    section_area_mean_mm2: section.mean, section_area_max_mm2: section.max, section_area_cv: section.cv,
    section_complexity: perimeter.mean ** 2 / Math.max(4 * Math.PI * section.mean, 1e-9),
  };
}
