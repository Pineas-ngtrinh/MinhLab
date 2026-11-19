import { NextResponse } from 'next/server';
import { manualVietQrDestination } from '../../../../src/server/payment-config';
import type { ApiResponse } from '../../../../src/contracts/api';
import type { PaymentAvailability } from '../../../../src/contracts/payments';

export function GET() {
  return NextResponse.json<ApiResponse<PaymentAvailability>>(
    { success: true, data: { vietQr: Boolean(manualVietQrDestination()) } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
