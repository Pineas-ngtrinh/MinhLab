import { NextRequest, NextResponse } from 'next/server';
import { CATALOG_IMAGE_REQUEST_MAX_BYTES } from './src/contracts/catalog-admin';
import { PAYMENT_PROOF_MAX_BYTES } from './src/contracts/payment-proof';

// Resource authorization remains in the database/server layer.
export function proxy(request: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return NextResponse.next();
  const origin = request.headers.get('origin');
  const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : request.nextUrl.origin;
  if (origin && origin !== allowedOrigin) {
    return NextResponse.json({ success: false, error: 'Nguồn gửi yêu cầu không hợp lệ.' }, { status: 403 });
  }
  const configuredUploadLimit = Number(process.env.MINHLAB_PRIVATE_UPLOAD_MAX_BYTES);
  const catalogImageUpload = /^\/api\/admin\/products\/[^/]+\/images$/.test(request.nextUrl.pathname);
  const paymentProofUpload = /^\/api\/orders\/[^/]+\/payment-proof$/.test(request.nextUrl.pathname);
  const privateFileUpload = request.nextUrl.pathname === '/api/print-files' && process.env.MINHLAB_PRIVATE_FILES_ENABLED === 'true' && Number.isSafeInteger(configuredUploadLimit) && configuredUploadLimit > 0;
  const bodyLimit = catalogImageUpload
    ? CATALOG_IMAGE_REQUEST_MAX_BYTES
    : paymentProofUpload ? PAYMENT_PROOF_MAX_BYTES
    : privateFileUpload ? Math.min(configuredUploadLimit, 100 * 1024 * 1024) : 64 * 1024;
  if (Number(request.headers.get('content-length') ?? 0) > bodyLimit) {
    return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu quá lớn.' }, { status: 413 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
