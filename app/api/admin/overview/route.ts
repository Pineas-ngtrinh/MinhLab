import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { authorizeRoles } from '../../../../src/lib/auth-session';
import { getAdminOverview, parseAdminOverviewPeriod } from '../../../../src/server/admin-overview';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const period = parseAdminOverviewPeriod(request.nextUrl.searchParams.get('period'));
    return NextResponse.json(
      { success: true, data: await getAdminOverview(period) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể tải báo cáo vận hành.');
  }
}
