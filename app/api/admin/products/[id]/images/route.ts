import { NextRequest, NextResponse } from 'next/server';
import { CATALOG_IMAGE_MAX_BYTES, CATALOG_IMAGE_REQUEST_MAX_BYTES, type CatalogImagePlacement } from '../../../../../../src/contracts/catalog-admin';
import { apiErrorResponse } from '../../../../../../src/lib/api-response';
import { authorizeRoles } from '../../../../../../src/lib/auth-session';
import { AppError } from '../../../../../../src/lib/errors';
import { uuidField } from '../../../../../../src/lib/catalog-validation';
import { CatalogImages } from '../../../../../../src/server/catalog-images';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const runtime = 'nodejs';

async function readBoundedFormData(request: NextRequest): Promise<FormData> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    if (!/^(0|[1-9][0-9]*)$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength))) {
      throw new AppError('Kích thước yêu cầu không hợp lệ.', 400);
    }
    if (Number(contentLength) > CATALOG_IMAGE_REQUEST_MAX_BYTES) {
      throw new AppError('Dữ liệu yêu cầu quá lớn.', 413);
    }
  }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
    throw new AppError('Yêu cầu tải ảnh không đúng định dạng.', 400);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Yêu cầu tải ảnh không có dữ liệu.', 400);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > CATALOG_IMAGE_REQUEST_MAX_BYTES) {
        await reader.cancel();
        throw new AppError('Dữ liệu yêu cầu quá lớn.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const contentType = request.headers.get('content-type');
  try {
    const body = new ArrayBuffer(totalBytes);
    const bytes = new Uint8Array(body);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const boundedRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': contentType! },
      body: new Blob([body]),
    });
    return await boundedRequest.formData();
  } catch {
    throw new AppError('Dữ liệu ảnh tải lên không hợp lệ.', 400);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR']);
    if (access.response) return access.response;

    const productId = uuidField((await context.params).id);
    const form = await readBoundedFormData(request);
    const entries = [...form.entries()];
    const imageEntries = form.getAll('image');
    const placementEntries = form.getAll('placement');
    const rawPlacement = placementEntries[0];
    if (
      entries.some(([key]) => key !== 'image' && key !== 'placement') ||
      imageEntries.length !== 1 ||
      placementEntries.length > 1 ||
      (rawPlacement !== undefined && rawPlacement !== 'MAIN' && rawPlacement !== 'GALLERY')
    ) {
      throw new AppError('Yêu cầu cần chứa đúng một ảnh.', 400);
    }
    const image = imageEntries[0];
    if (typeof File === 'undefined' || !(image instanceof File)) {
      throw new AppError('Tệp ảnh không hợp lệ.', 400);
    }
    if (image.size <= 0 || image.size > CATALOG_IMAGE_MAX_BYTES) {
      throw new AppError('Ảnh rỗng hoặc vượt quá 5 MB.', 413);
    }

    const result = await CatalogImages.uploadProductImage({
      productId,
      actorId: access.session!.id,
      actorRole: access.session!.role as 'ADMIN' | 'WORKSHOP_OPERATOR',
      bytes: new Uint8Array(await image.arrayBuffer()),
      declaredMimeType: image.type,
      filename: image.name,
      placement: (rawPlacement ?? 'GALLERY') as CatalogImagePlacement,
    });
    return NextResponse.json(
      { success: true, data: result },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Không thể tải ảnh sản phẩm.');
  }
}
