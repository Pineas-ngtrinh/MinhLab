'use client';

import { useEffect, useState } from 'react';
import type { ApiResponse } from '../contracts/api';
import type { TrackedOrderData } from '../contracts/orders';

export function useTrackedOrder(orderNumber: string, token: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    order?: TrackedOrderData;
    error?: string;
  } | null>(null);
  const key = `${orderNumber}:${token}:${revision}`;
  useEffect(() => {
    if (!orderNumber) return;
    const controller = new AbortController();
    const search = token ? `?token=${encodeURIComponent(token)}` : '';
    fetch(`/api/orders/${encodeURIComponent(orderNumber)}${search}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: ApiResponse<TrackedOrderData> = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.success ? 'Không thể tải đơn hàng.' : body.error);
        if (!controller.signal.aborted) setResult({ key, order: body.data });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: cause instanceof Error ? cause.message : 'Không thể tải đơn hàng.',
          });
      });
    return () => controller.abort();
  }, [key, orderNumber, token]);
  const current = result?.key === key ? result : null;
  return {
    order: current?.order ?? null,
    error: !orderNumber ? 'Liên kết chưa có mã đơn hàng.' : (current?.error ?? ''),
    isLoading: Boolean(orderNumber) && !current,
    reload: () => setRevision((value) => value + 1),
  };
}
