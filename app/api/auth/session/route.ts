import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '../../../../src/lib/auth-roles';
import { readAuthSession } from '../../../../src/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const session = await readAuthSession(request);
    const response = NextResponse.json({
      success: true,
      data: session
        ? {
            id: session.id,
            email: session.email,
            fullName: session.fullName,
            phone: session.phone,
            role: session.role,
            roleInfo: ROLES[session.role],
          }
        : null,
    }, { headers: { 'Cache-Control': 'no-store' } });

    return response;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.');
  }
}
