import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { CatalogManagement } from '../../../../../src/server/catalog';
import { readJson } from '../../../../../src/lib/request-validation';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR']);
    if (access.response) return access.response;
    return NextResponse.json(
      { success: true, data: await CatalogManagement.categories() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tải danh mục.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const category = await CatalogManagement.createCategory(await readJson(request), access.session!.id);
    return NextResponse.json(
      { success: true, data: category },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tạo danh mục.');
  }
}
