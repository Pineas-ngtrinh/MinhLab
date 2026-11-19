import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { clearAuthSessionCookie, revokeAuthSession } from '../../../../src/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    await revokeAuthSession(request);
    return clearAuthSessionCookie(NextResponse.json({ success: true }));
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.');
  }
}
