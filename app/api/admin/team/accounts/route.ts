import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { isRecord, readJson, textField } from '../../../../../src/lib/request-validation';
import { parsePageOptions } from '../../../../../src/lib/pagination';
import { uuidField } from '../../../../../src/lib/catalog-validation';
import { isRoleCode } from '../../../../../src/lib/auth-roles';
import { AppError } from '../../../../../src/lib/errors';
import { TeamManagement } from '../../../../../src/server/team-management';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    return NextResponse.json({ success: true, data: await TeamManagement.accounts(access.session!, parsePageOptions(request.nextUrl.searchParams, [])) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiErrorResponse(error, 'Không thể tải danh sách tài khoản.'); }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const body: unknown = await readJson(request);
    if (isRecord(body) && body.action === 'LINK_TELEGRAM') {
      if ((body.telegramUserId !== null && typeof body.telegramUserId !== 'string') ||
          (body.expectedTelegramUserId !== null && typeof body.expectedTelegramUserId !== 'string')) throw new AppError('Telegram ID không hợp lệ.');
      const input = {action: 'LINK_TELEGRAM' as const, userId: uuidField(body.userId), telegramUserId: body.telegramUserId,
        expectedTelegramUserId: body.expectedTelegramUserId, reason: textField(body.reason, 'Lý do liên kết Telegram', 2000)};
      return NextResponse.json({success: true, data: await TeamManagement.linkTelegram(access.session!, input)}, {headers: {'Cache-Control': 'private, no-store'}});
    }
    if (!isRecord(body) || !isRoleCode(body.role) || !Array.isArray(body.expectedRoles) ||
      body.expectedRoles.length > 6 || !body.expectedRoles.every(isRoleCode)) throw new AppError('Dữ liệu phân quyền không hợp lệ.');
    const input = { userId: uuidField(body.userId), role: body.role, expectedRoles: body.expectedRoles, reason: textField(body.reason, 'Lý do thay đổi quyền', 2000) };
    return NextResponse.json({ success: true, data: await TeamManagement.assign(access.session!, input) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiErrorResponse(error, 'Không thể thay đổi quyền tài khoản.'); }
}
