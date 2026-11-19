import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../../../../src/lib/api-response';
import { uuidField } from '../../../../../../../src/lib/catalog-validation';
import { downloadPaymentProof } from '../../../../../../../src/server/payment-proofs';

export async function GET(request: NextRequest, context: { params: Promise<{ paymentId: string; assetId: string }> }) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const params = await context.params;
    const proof = await downloadPaymentProof(
      uuidField(params.paymentId),
      uuidField(params.assetId),
    );
    return new NextResponse(proof.body, {
      headers: {
        'Content-Type': proof.mimeType,
        'Content-Length': String(proof.bytes),
        'Content-Disposition': `inline; filename="payment-proof.${proof.extension}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'default-src \'none\'; sandbox',
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'Không thể mở biên lai riêng tư.');
  }
}
