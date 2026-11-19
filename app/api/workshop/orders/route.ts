import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { parsePageOptions } from '../../../../src/lib/pagination';
import { OrderService } from '../../../../src/server/orders';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR', 'PRINT_OPERATOR']);
    if (access.response) return access.response;
    const options = parsePageOptions(request.nextUrl.searchParams, [
      'IN_PRODUCTION',
      'READY_TO_SHIP',
    ]);
    return NextResponse.json(
      { success: true, ...(await OrderService.getProductionQueue(options)) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tải hàng đợi chế tác.');
  }
}
