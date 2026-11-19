import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { readJson, textField } from '../../../../src/lib/request-validation';
import { parsePageOptions } from '../../../../src/lib/pagination';
import { PRODUCT_PUBLICATIONS } from '../../../../src/contracts/catalog-admin';
import { CatalogManagement } from '../../../../src/server/catalog';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR']);
    if (access.response) return access.response;
    const options = parsePageOptions(request.nextUrl.searchParams, PRODUCT_PUBLICATIONS);
    const search = textField(request.nextUrl.searchParams.get('q') ?? '', 'Từ khóa', 120, false);
    return NextResponse.json(
      { success: true, ...(await CatalogManagement.list({ ...options, search })) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tải danh sách sản phẩm.');
  }
}
export async function POST(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR']);
    if (access.response) return access.response;
    return NextResponse.json(
      {
        success: true,
        data: await CatalogManagement.create(await readJson(request), access.session!.id),
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tạo sản phẩm.');
  }
}
