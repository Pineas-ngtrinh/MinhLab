'use client';

import { useEffect, useState } from 'react';
import type { ApiResponse } from '../contracts/api';
import type { PaymentAvailability } from '../contracts/payments';

export function usePaymentOptions(enabled: boolean, revision: number) {
  const key = `${enabled}:${revision}`;
  const [result, setResult] = useState<{ key: string; data: PaymentAvailability } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/payments/options', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body: ApiResponse<PaymentAvailability> = await response.json();
        if (!response.ok || !body.success) throw new Error('Payment options unavailable');
        if (!controller.signal.aborted) setResult({ key, data: body.data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, data: { vietQr: false } });
      });
    return () => controller.abort();
  }, [enabled, key]);
  return {
    loading: enabled && result?.key !== key,
    vietQr: result?.key === key && result.data.vietQr,
  };
}
