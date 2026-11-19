import type { Material, PriceBreakdown, RateCard } from '../types';

function assertNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} phải là số hữu hạn không âm.`);
}

/** Model time is seconds here; exported Python model predicts minutes. Round the sum once. */
export function priceFdm(massG: number, modelTimeS: number, material: Material, rateCard: RateCard): PriceBreakdown {
  assertNonNegativeFinite('Khối lượng', massG);
  assertNonNegativeFinite('Thời gian in', modelTimeS);
  if (!rateCard.profitIncludedInMaterialPrice) throw new Error('Đơn giá vật liệu phải gồm lợi nhuận.');
  const pricePerGram = rateCard.pricePerGramVnd[material];
  assertNonNegativeFinite('Đơn giá vật liệu', pricePerGram);
  assertNonNegativeFinite('Đơn giá điện mỗi giờ', rateCard.electricityVndPerHour);
  assertNonNegativeFinite('Công', rateCard.laborVnd);
  assertNonNegativeFinite('Phí ship', rateCard.shippingFeeVnd);
  assertNonNegativeFinite('Ngưỡng miễn ship', rateCard.freeShippingAboveProductVnd);
  if (rateCard.rounding !== 'half_up_vnd') throw new Error('Quy tắc làm tròn không được hỗ trợ.');
  const materialVnd = massG * pricePerGram;
  const electricityVnd = modelTimeS / 3600 * rateCard.electricityVndPerHour;
  const productVnd = Math.round(materialVnd + electricityVnd + rateCard.laborVnd);
  if (!Number.isSafeInteger(productVnd)) throw new RangeError('Giá vượt giới hạn số học.');
  const shippingVnd = productVnd > rateCard.freeShippingAboveProductVnd ? 0 : Math.round(rateCard.shippingFeeVnd);
  return { materialVnd, electricityVnd, laborVnd: rateCard.laborVnd, productVnd, shippingVnd,
    orderTotalVnd: productVnd + shippingVnd, profitIncludedInMaterialPrice: true };
}
