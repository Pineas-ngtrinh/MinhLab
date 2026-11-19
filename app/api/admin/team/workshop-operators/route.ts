import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { authorizeRoles } from '../../../../../src/lib/auth-session';
import { isRecord, readJson, textField } from '../../../../../src/lib/request-validation';
import { TeamManagement } from '../../../../../src/server/team-management';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    return NextResponse.json({ success: true, data: await TeamManagement.list({ id: access.session!.id, role: access.session!.role }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tải danh sách nhân sự vận hành.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const body: unknown = await readJson(request);
    if (!isRecord(body)) return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
    const email = textField(body.email, 'Địa chỉ thư điện tử', 255);
    if (typeof email !== 'string') return NextResponse.json({ success: false, error: 'Địa chỉ thư điện tử không hợp lệ.' }, { status: 400 });
    const data = await TeamManagement.grant({ id: access.session!.id, role: access.session!.role }, email);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Không thể cấp quyền nhân sự vận hành.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const body: unknown = await readJson(request);
    if (!isRecord(body)) return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
    const email = textField(body.email, 'Địa chỉ thư điện tử', 255);
    if (typeof email !== 'string') return NextResponse.json({ success: false, error: 'Địa chỉ thư điện tử không hợp lệ.' }, { status: 400 });
    const data = await TeamManagement.revoke({ id: access.session!.id, role: access.session!.role }, email);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Không thể thu hồi quyền nhân sự vận hành.');
  }
}
