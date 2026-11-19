import modelSource from './model_v3.json';
import resourceModel from './model_resource_v1.json';
import metadata from './model_v3_metadata.json';
import printerSource from './printer.json';
import rateCardSource from './rate_card.json';
import type { QuoteConfig } from '../quote';
import type { ModelParams, PrinterConfig, RateCard } from '../types';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  version: printerSource.version,
  slicingProfileId: printerSource.slicingProfileId,
  buildVolumeMm: printerSource.buildVolumeMm,
  nozzleDiameterMm: printerSource.nozzleDiameterMm,
  layerHeightMm: printerSource.layerHeightMm,
  supports: 'auto',
  slicerVersion: printerSource.slicerVersion,
};

export const V3_MODEL_PARAMS: ModelParams = {
  version: `minhlab-stl-v${modelSource.version}`,
  slicingProfileId: 'bambu_a1mini_04_020_auto_pei_02.08.02.61',
  provisional: true,
  supportedMaterials: ['PLA', 'PETG', 'TPU'],
  densityGPerCm3: { PLA: 1.26, PETG: 1.28, TPU: 1.22 },
  targets: modelSource.targets,
  usableXyMm: modelSource.usable_xy_mm,
  assumedBrimWidthMm: modelSource.assumed_brim_width_mm,
  trainedScaleRange: modelSource.trained_scale_range,
  relativeErrorP90: metadata.relativeErrorP90,
};

export const DEFAULT_MODEL_PARAMS: ModelParams = {
  version: resourceModel.version,
  slicingProfileId: 'bambu_a1mini_04_020_auto_pei_02.08.02.61',
  provisional: true,
  supportedMaterials: ['PLA', 'PETG', 'TPU'],
  densityGPerCm3: { PLA: 1.26, PETG: 1.28, TPU: 1.22 },
  targets: {
    grams: { ...resourceModel.targets.grams, engine: 'nonnegative_resource_ridge' },
    time_min: { ...resourceModel.targets.time_min, engine: 'nonnegative_resource_ridge' },
  },
  usableXyMm: resourceModel.usable_xy_mm,
  assumedBrimWidthMm: resourceModel.brim_mm,
  trainedScaleRange: resourceModel.scale_range,
  maxHeightMm: resourceModel.max_height_mm,
  requiredProfile: { nozzleDiameterMm: 0.4, layerHeightMm: 0.2, supports: 'auto', slicerVersion: '02.08.02.61' },
  relativeErrorP90: resourceModel.relativeErrorP90,
};

export const DEFAULT_RATE_CARD: RateCard = {
  version: rateCardSource.version,
  currency: 'VND',
  pricePerGramVnd: rateCardSource.pricePerGramVnd,
  profitIncludedInMaterialPrice: rateCardSource.profitIncludedInMaterialPrice,
  electricityVndPerHour: rateCardSource.electricityVndPerHour,
  laborVnd: rateCardSource.laborVnd,
  shippingFeeVnd: rateCardSource.shippingFeeVnd,
  freeShippingAboveProductVnd: rateCardSource.freeShippingAboveProductVnd,
  rounding: 'half_up_vnd',
};

export const DEFAULT_QUOTE_CONFIG: QuoteConfig = {
  model: DEFAULT_MODEL_PARAMS, printer: DEFAULT_PRINTER_CONFIG, rateCard: DEFAULT_RATE_CARD,
};

export const V3_QUOTE_CONFIG: QuoteConfig = {
  model: V3_MODEL_PARAMS, printer: DEFAULT_PRINTER_CONFIG, rateCard: DEFAULT_RATE_CARD,
};
