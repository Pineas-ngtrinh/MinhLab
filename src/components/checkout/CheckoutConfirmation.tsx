'use client';

import { formatVND } from '../../lib/format';

import { CheckCircle2 } from 'lucide-react';
import type { useCheckout } from './useCheckout';

interface CheckoutConfirmationProps {
  checkout: ReturnType<typeof useCheckout>;
}

export function CheckoutConfirmation({ checkout }: CheckoutConfirmationProps) {
  const {
    handleClose,
    currentStep,
    orderId,
    finalTotal,
  } = checkout;
  return (<>
{currentStep === 'PAYMENT_VERIFIED' && (
            <div className="py-5 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#6F9576]/15 border border-[#6F9576]/30 flex items-center justify-center text-[#6F9576]">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#6F9576]/15 border border-[#6F9576]/30 text-[#6F9576] text-xs font-mono font-bold uppercase">
                  <span>Trạng thái: Đã xác nhận thanh toán (VERIFIED)</span>
                </div>
                <h4 className="text-xl font-bold text-[#F4F1EA]">
                  Thanh toán hoàn tất!
                </h4>
                <p className="text-xs sm:text-sm text-[#A5ADB8] max-w-md">
                  MinhLab 3D đã xác nhận nhận đủ số tiền {formatVND(finalTotal)}. Đơn hàng [{orderId}] đang được kỹ sư xưởng đưa vào hàng đợi đùn in FDM.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="py-2.5 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          )}
  </>);
}
