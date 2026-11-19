import { estimatePrint, type EstimateConfig } from './estimate/estimate';
import type { MeshFeatures } from './stl/analyze';
import { priceFdm } from './pricing/pricing';
import type { CustomerQuoteView, Quote, QuoteParams, RateCard } from './types';

export interface QuoteConfig extends EstimateConfig {
  readonly rateCard: RateCard;
}

const FLAG_REASONS: Readonly<Record<string, string>> = {
  INCONSISTENT_WINDING: 'Lưới STL có các mặt không đồng nhất hướng.',
  MISSING_MODEL_GEOMETRY: 'Chưa trích xuất đủ đặc trưng hình học cho mô hình báo giá.',
  OPEN_MESH: 'Lưới STL bị hở.',
  NON_MANIFOLD: 'Lưới STL có cạnh không manifold.',
  INVERTED_NORMALS: 'Một phần normal của lưới STL bị đảo.',
  DEGENERATE_TRIANGLES: 'Tệp STL có một số tam giác bị lỗi.',
  SUSPICIOUS_UNITS: 'Đơn vị hoặc kích thước STL cần xác nhận.',
  EXCEEDS_BUILD_VOLUME: 'Kích thước vượt khổ in của máy đã chọn.',
  OUT_OF_TRAINING_RANGE: 'Mẫu hoặc cấu hình nằm ngoài phạm vi dữ liệu huấn luyện.',
  MODEL_PROVISIONAL: 'Giá là ước tính theo slicer, cần xưởng xác nhận trước khi đặt in.',
  TOPOLOGY_SKIPPED: 'Tệp lớn nên hệ thống chưa kiểm tra toàn bộ lưới.',
};

export function computeQuote(
  features: MeshFeatures,
  params: QuoteParams,
  config: QuoteConfig,
): Quote {
  const estimate = estimatePrint(features, params, config);
  const developerPreview = priceFdm(estimate.massG, estimate.timeS, params.material, config.rateCard);
  const flags = new Set(estimate.flags);
  const needsReview = flags.size > 0;
  const customerVisiblePriceVnd = needsReview ? null : developerPreview.orderTotalVnd;

  return {
    estimate,
    developerPreview,
    customerVisiblePriceVnd,
    flags: Array.from(flags),
    needsReview,
    reviewReasons: Array.from(flags, (flag) => FLAG_REASONS[flag]),
    modelVersion: config.model.version,
    rateCardVersion: config.rateCard.version,
  };
}

export function toCustomerQuoteView(quote: Quote): CustomerQuoteView {
  if (quote.customerVisiblePriceVnd === null || quote.needsReview) {
    return { status: 'awaiting_review', price: null };
  }

  return {
    status: 'ready',
    price: {
      productVnd: quote.developerPreview.productVnd,
      shippingVnd: quote.developerPreview.shippingVnd,
      orderTotalVnd: quote.developerPreview.orderTotalVnd,
    },
  };
}
