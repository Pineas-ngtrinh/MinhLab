import type { MeshFeatures, QuoteFlag } from './stl/analyze';

export type Material = 'PLA' | 'PETG' | 'TPU';
export type InfillFraction = 0.15 | 0.4 | 0.8;

export interface QuoteParams {
  material: Material;
  scale: number;
  infill: InfillFraction;
}

export interface PrinterConfig {
  readonly version: string;
  readonly slicingProfileId: string;
  readonly buildVolumeMm: { readonly w: number; readonly d: number; readonly h: number };
  readonly nozzleDiameterMm: number;
  readonly layerHeightMm: number;
  readonly supports: 'auto' | 'off';
  readonly slicerVersion: string;
}

export interface LogRidgeTarget {
  readonly engine: string;
  readonly family?: string;
  readonly feature_names: readonly string[];
  readonly mu: readonly number[];
  readonly sd: readonly number[];
  readonly beta: readonly number[];
  readonly intercept?: number;
}

export interface NonnegativeResourceTarget {
  readonly engine: 'nonnegative_resource_ridge';
  readonly feature_names: readonly string[];
  readonly coefficients: readonly number[];
  readonly feature_scales: readonly number[];
  readonly target_scale: number;
}

export type RegressionTarget = LogRidgeTarget | NonnegativeResourceTarget;

export interface ModelParams {
  readonly version: string;
  readonly slicingProfileId: string;
  /** Estimates remain advisory until staff approval; no independent external test yet. */
  readonly provisional: boolean;
  readonly supportedMaterials: readonly Material[];
  readonly densityGPerCm3: Readonly<Record<Material, number>>;
  readonly targets: { readonly grams: RegressionTarget; readonly time_min: RegressionTarget };
  readonly usableXyMm: readonly number[];
  readonly assumedBrimWidthMm: number;
  readonly trainedScaleRange: readonly number[];
  readonly maxHeightMm?: number;
  readonly requiredProfile?: Pick<PrinterConfig, 'nozzleDiameterMm' | 'layerHeightMm' | 'supports' | 'slicerVersion'>;
  /** Development OOF error summary, not a calibrated confidence interval. */
  readonly relativeErrorP90: { readonly grams: number; readonly time: number };
}

export interface RateCard {
  readonly version: string;
  readonly currency: 'VND';
  readonly pricePerGramVnd: Readonly<Record<Material, number>>;
  readonly profitIncludedInMaterialPrice: boolean;
  readonly electricityVndPerHour: number;
  readonly laborVnd: number;
  readonly shippingFeeVnd: number;
  readonly freeShippingAboveProductVnd: number;
  readonly rounding: 'half_up_vnd';
}

export interface PrintEstimate {
  readonly materialVolumeMm3: number;
  readonly massG: number;
  readonly timeS: number;
  readonly massRangeG: readonly [number, number];
  readonly timeRangeS: readonly [number, number];
  readonly scaledFeatures: MeshFeatures;
}

export interface PriceBreakdown {
  readonly materialVnd: number;
  readonly electricityVnd: number;
  readonly laborVnd: number;
  readonly productVnd: number;
  readonly shippingVnd: number;
  readonly orderTotalVnd: number;
  readonly profitIncludedInMaterialPrice: true;
}

export interface Quote {
  readonly estimate: PrintEstimate;
  /** Internal developer preview; do not return this object in customer responses. */
  readonly developerPreview: PriceBreakdown;
  readonly customerVisiblePriceVnd: number | null;
  readonly flags: readonly QuoteFlag[];
  readonly needsReview: boolean;
  readonly reviewReasons: readonly string[];
  readonly modelVersion: string;
  readonly rateCardVersion: string;
}

export interface CustomerQuoteView {
  readonly status: 'ready' | 'awaiting_review';
  readonly price: {
    readonly productVnd: number;
    readonly shippingVnd: number;
    readonly orderTotalVnd: number;
  } | null;
}
