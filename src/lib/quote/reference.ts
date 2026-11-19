import type { Material, Quote, RateCard } from "./types";
import { priceFdm } from "./pricing/pricing";

export type ReferenceQuoteView =
  | {
      readonly status: "ready";
      readonly referencePriceVnd: number;
      readonly lowPriceVnd: number;
      readonly highPriceVnd: number;
      readonly lowDeltaPercent: number;
      readonly highDeltaPercent: number;
      readonly massG: number;
      readonly modelTimeHours: number;
      readonly materialVnd: number;
      readonly electricityVnd: number;
    }
  | { readonly status: "review"; readonly message: string };

/** Advisory view for a request form, separate from the staff-approved customer/order price. */
export function toReferenceQuoteView(
  quote: Quote,
  material: Material,
  rateCard: RateCard,
): ReferenceQuoteView {
  const blockingFlags = quote.flags.filter(
    (flag) => flag !== "MODEL_PROVISIONAL",
  );
  if (blockingFlags.length) {
    const reasons = quote.reviewReasons.filter(
      (_, index) => quote.flags[index] !== "MODEL_PROVISIONAL",
    );
    return {
      status: "review",
      message: `${reasons.join(" ")} Xưởng cần kiểm tra trước khi đưa ra giá tham khảo.`,
    };
  }
  if (quote.rateCardVersion !== rateCard.version) {
    return {
      status: "review",
      message:
        "Bảng giá đã thay đổi. Vui lòng tải lại trang để cập nhật giá tham khảo.",
    };
  }
  const referencePriceVnd = quote.developerPreview.productVnd;
  if (referencePriceVnd <= 0)
    return {
      status: "review",
      message: "Xưởng cần kiểm tra lại tệp trước khi báo giá.",
    };
  const lowPriceVnd = priceFdm(
    quote.estimate.massRangeG[0],
    quote.estimate.timeRangeS[0],
    material,
    rateCard,
  ).productVnd;
  const highPriceVnd = priceFdm(
    quote.estimate.massRangeG[1],
    quote.estimate.timeRangeS[1],
    material,
    rateCard,
  ).productVnd;
  return {
    status: "ready",
    referencePriceVnd,
    lowPriceVnd,
    highPriceVnd,
    lowDeltaPercent: Math.round(
      ((referencePriceVnd - lowPriceVnd) / referencePriceVnd) * 100,
    ),
    highDeltaPercent: Math.round(
      ((highPriceVnd - referencePriceVnd) / referencePriceVnd) * 100,
    ),
    massG: quote.estimate.massG,
    modelTimeHours: quote.estimate.timeS / 3600,
    materialVnd: quote.developerPreview.materialVnd,
    electricityVnd: quote.developerPreview.electricityVnd,
  };
}
