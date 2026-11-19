import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { authorizeRoles } from '../../../../../src/lib/auth-session';
import { createAdminOrdersCsv, parseAdminOverviewPeriod } from '../../../../../src/server/admin-overview';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const period = parseAdminOverviewPeriod(request.nextUrl.searchParams.get('period'));
    const report = await createAdminOrdersCsv(period);
    return new NextResponse(report, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="minhlab-bao-cao-${period}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể xuất báo cáo Excel.');
  }
}
