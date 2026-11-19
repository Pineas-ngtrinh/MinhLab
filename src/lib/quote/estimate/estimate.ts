import { scaleMeshFeatures, type BuildVolumeMm, type MeshFeatures, type QuoteFlag } from '../stl/analyze';
import type { ModelParams, PrinterConfig, PrintEstimate, QuoteParams } from '../types';
import { modelFeatures, predictRegression } from './regression';

export interface EstimateConfig {
  readonly model: ModelParams;
  readonly printer: PrinterConfig;
}

export function estimatePrint(
  originalFeatures: MeshFeatures,
  params: QuoteParams,
  config: EstimateConfig,
  buildVolumeMm: BuildVolumeMm = config.printer.buildVolumeMm,
): PrintEstimate & { readonly flags: readonly QuoteFlag[] } {
  const model = config.model;
  const brim = model.assumedBrimWidthMm * 2;
  const scaledFeatures = scaleMeshFeatures(originalFeatures, params.scale, {
    w: Math.min(buildVolumeMm.w, model.usableXyMm[0] - brim),
    d: Math.min(buildVolumeMm.d, model.usableXyMm[1] - brim), h: Math.min(buildVolumeMm.h, model.maxHeightMm ?? buildVolumeMm.h),
  });
  const flags = new Set<QuoteFlag>(scaledFeatures.flags);
  if (model.provisional) flags.add('MODEL_PROVISIONAL');
  if (config.printer.slicingProfileId !== model.slicingProfileId ||
      !model.supportedMaterials.includes(params.material) ||
      params.scale < model.trainedScaleRange[0] || params.scale > model.trainedScaleRange[1] ||
      ![0.15, 0.4, 0.8].includes(params.infill)) flags.add('OUT_OF_TRAINING_RANGE');
  if (model.requiredProfile && (config.printer.nozzleDiameterMm !== model.requiredProfile.nozzleDiameterMm ||
      config.printer.layerHeightMm !== model.requiredProfile.layerHeightMm || config.printer.supports !== model.requiredProfile.supports ||
      config.printer.slicerVersion !== model.requiredProfile.slicerVersion)) flags.add('OUT_OF_TRAINING_RANGE');
  const geometry = originalFeatures.modelGeometry;
  if (!geometry) {
    flags.add('MISSING_MODEL_GEOMETRY');
    return { materialVolumeMm3: 0, massG: 0, timeS: 0, massRangeG: [0, 0], timeRangeS: [0, 0],
      scaledFeatures, flags: Array.from(flags) };
  }
  const features = modelFeatures(geometry, params.scale, params.material, params.infill);
  const massG = predictRegression(model.targets.grams, features);
  const timeS = predictRegression(model.targets.time_min, features) * 60;
  const massP90 = model.relativeErrorP90.grams, timeP90 = model.relativeErrorP90.time;
  return {
    materialVolumeMm3: massG / model.densityGPerCm3[params.material] * 1000,
    massG, timeS,
    massRangeG: [Math.max(0, massG * (1 - massP90)), massG * (1 + massP90)],
    timeRangeS: [Math.max(0, timeS * (1 - timeP90)), timeS * (1 + timeP90)],
    scaledFeatures, flags: Array.from(flags),
  };
}
