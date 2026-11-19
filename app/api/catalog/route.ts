import { NextResponse } from 'next/server';
import { CatalogService } from '../../../src/server/catalog';
import { apiErrorResponse } from '../../../src/lib/api-response';
import type { ApiResponse } from '../../../src/contracts/api';
import type { CatalogData } from '../../../src/contracts/catalog';

export async function GET() {
  try {
    return NextResponse.json<ApiResponse<CatalogData>>({success: true, data: await CatalogService.getStorefront()},
      {headers: {'Cache-Control': 'no-store'}});
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Chưa thể tải danh mục sản phẩm. Vui lòng thử lại.');
  }
}
