import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { readJson, isRecord } from '../../../../../src/lib/request-validation';
import { AppError } from '../../../../../src/lib/errors';
import { CatalogManagement } from '../../../../../src/server/catalog';

interface RouteContext {
  params: Promise<{ id: string }>;
}
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR']);
    if (access.response) return access.response;
    return NextResponse.json(
      { success: true, data: await CatalogManagement.get((await context.params).id) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tải sản phẩm.');
  }
}
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR']);
    if (access.response) return access.response;
    const body = await readJson(request);
    if (!isRecord(body)) throw new AppError('Thông tin sản phẩm không hợp lệ.');
    return NextResponse.json(
      {
        success: true,
        data: await CatalogManagement.update(
          (await context.params).id,
          body,
          body.revision,
          access.session!.id,
          access.session!.role === 'ADMIN',
        ),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể lưu sản phẩm.');
  }
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    return NextResponse.json(
      {
        success: true,
        data: await CatalogManagement.publish(
          (await context.params).id,
          await readJson(request),
          access.session!.id,
        ),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể thay đổi trạng thái sản phẩm.');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    return NextResponse.json(
      {
        success: true,
        data: await CatalogManagement.delete((await context.params).id, access.session!.id),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể xóa sản phẩm.');
  }
}
