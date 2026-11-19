import type { ModelGeometry } from '../stl/model-geometry';
import type { LogRidgeTarget, Material, RegressionTarget } from '../types';

/** Keep feature names, scaling and transform identical to the exported Python model. */
export function modelFeatures(g: ModelGeometry, scale: number, material: Material, infill: number): Record<string, number> {
  const v = g.volume_mm3 * scale ** 3, s = g.surface_mm2 * scale ** 2, b = g.bbox_mm3 * scale ** 3;
  const dims = [g.x_mm, g.y_mm, g.z_mm].map(value => value * scale);
  const log = (value: number) => Math.log(Math.max(value, 1e-9));
  const log1 = (value: number) => Math.log1p(Math.max(value, 0));
  const petg = Number(material === 'PETG'), tpu = Number(material === 'TPU');
  const shell = Math.min(v, s * 0.4);
  const f: Record<string, number> = {
    log_volume: log(v), log_surface: log(s), log_bbox: log(b), solid_fraction: v / b,
    log_aspect: log(Math.max(...dims) / Math.min(...dims)), infill, PETG: petg, TPU: tpu,
    log_triangles: log1(g.triangles), log_height: log(dims[2]), log_xy_area: log(dims[0] * dims[1]),
    log_xy_aspect: log(Math.max(...dims.slice(0, 2)) / Math.min(...dims.slice(0, 2))),
    log_vertical_area: log1(g.vertical_area_mm2 * scale ** 2),
    log_horizontal_area: log1(g.horizontal_area_mm2 * scale ** 2),
    log_mean_perimeter: log1(g.section_perimeter_mean_mm * scale),
    perimeter_cv: g.section_perimeter_cv, section_area_cv: g.section_area_cv,
    log_support_envelope: log1(g.support_envelope_mm3 * scale ** 3),
    log_overhang_area: log1(g.overhang_projected_mm2 * scale ** 2),
    log_section_complexity: log1(g.section_complexity),
    log_max_section_area: log1(g.section_area_max_mm2 * scale ** 2),
    log_filled_volume: log(shell + (v - shell) * infill),
    log_perimeter_layer_work: log1(g.vertical_area_mm2 * scale ** 2 / 0.2),
    log_layer_count: log(dims[2] / 0.2), log_top_bottom_work: log1(g.horizontal_area_mm2 * scale ** 2 * 0.8),
  };
  for (const name of ['log_volume', 'log_surface', 'log_bbox']) f[name + '_x_infill'] = f[name] * infill;
  f.log_volume_squared = f.log_volume ** 2;
  f.log_surface_squared = f.log_surface ** 2;
  for (const name of ['log_volume', 'log_surface']) {
    f[name + '_x_PETG'] = f[name] * petg;
    f[name + '_x_TPU'] = f[name] * tpu;
  }
  Object.assign(f, {
    log_mesh_volume_mm3_scaled: f.log_volume, log_surface_area_mm2_scaled: f.log_surface,
    log_bbox_volume_mm3_scaled: f.log_bbox, log_triangle_count: f.log_triangles,
    mesh_solid_fraction: f.solid_fraction, log_aspect_ratio: f.log_aspect,
    infill_fraction: infill, material_PETG_HF: petg, material_TPU_95A_HF: tpu,
    log_mesh_volume_squared: f.log_volume_squared, log_surface_area_squared: f.log_surface_squared,
    log_volume_x_infill: f.log_volume * infill, log_surface_x_infill: f.log_surface * infill,
    log_bbox_x_infill: f.log_bbox * infill, log_volume_x_PETG: f.log_volume * petg,
    log_volume_x_TPU: f.log_volume * tpu, log_surface_x_PETG: f.log_surface * petg,
    log_surface_x_TPU: f.log_surface * tpu,
  });
  const resourceBase = [1, (Math.min(v, s * 0.8) + (v - Math.min(v, s * 0.8)) * infill) / 1000,
    g.vertical_area_mm2 * scale ** 2, g.horizontal_area_mm2 * scale ** 2,
    g.support_envelope_mm3 * scale ** 3 / 1000, dims[2] / 0.2,
    g.section_perimeter_mean_mm * scale * dims[2] / 0.2, g.overhang_projected_mm2 * scale ** 2];
  const resourceNames = ['constant', 'filled_cm3', 'vertical_area', 'horizontal_area', 'support_cm3', 'layers', 'perimeter_work', 'overhang_area'];
  for (const selected of ['PLA', 'PETG', 'TPU'] as const) {
    resourceNames.forEach((name, index) => { f[`physics_${selected}_${name}`] = selected === material ? resourceBase[index] : 0; });
  }
  return f;
}

export function predictRegression(target: RegressionTarget, features: Readonly<Record<string, number>>): number {
  if (!('feature_scales' in target)) return predictLogRidge(target, features);
  if (target.engine !== 'nonnegative_resource_ridge' || target.feature_names.length !== target.coefficients.length ||
      target.feature_names.length !== target.feature_scales.length || !target.feature_names.length ||
      !Number.isFinite(target.target_scale) || target.target_scale <= 0) throw new Error('Schema hồi quy tài nguyên không hợp lệ.');
  let prediction = 0;
  target.feature_names.forEach((name, index) => {
    const value = features[name], coefficient = target.coefficients[index], scale = target.feature_scales[index];
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(coefficient) || coefficient < 0 ||
        !Number.isFinite(scale) || scale <= 0) throw new RangeError('Đặc trưng hoặc hệ số tài nguyên không hợp lệ.');
    prediction += value / scale * coefficient;
  });
  prediction *= target.target_scale;
  if (!Number.isFinite(prediction) || prediction <= 0) throw new RangeError('Dự đoán tài nguyên không hợp lệ.');
  return prediction;
}

export function predictLogRidge(target: LogRidgeTarget, features: Readonly<Record<string, number>>): number {
  const frozen = target.engine === 'frozen_v2_log_ridge';
  if (!frozen && (target.engine !== 'v3_log_ridge' || target.family !== 'physical')) {
    throw new Error('Engine hoặc họ đặc trưng của model chưa được hỗ trợ.');
  }
  const offset = frozen ? 1 : 0;
  if (target.mu.length !== target.feature_names.length || target.sd.length !== target.mu.length ||
      target.beta.length !== target.mu.length + offset) throw new Error('Schema hệ số model không hợp lệ.');
  const intercept = frozen ? target.beta[0] : target.intercept;
  if (intercept === undefined || !Number.isFinite(intercept)) throw new Error('Thiếu intercept model.');
  let value = intercept;
  target.feature_names.forEach((name, index) => {
    const x = features[name], sd = target.sd[index], mu = target.mu[index], beta = target.beta[index + offset];
    if (!Number.isFinite(x) || !Number.isFinite(mu) || !Number.isFinite(sd) || sd <= 0 || !Number.isFinite(beta)) {
      throw new RangeError('Đặc trưng hoặc hệ số model không hữu hạn.');
    }
    value += (x - mu) / sd * beta;
  });
  if (!Number.isFinite(value)) throw new RangeError('Dự đoán model vượt giới hạn số học.');
  return Math.exp(Math.max(-25, Math.min(25, value)));
}
