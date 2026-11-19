import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { AppError } from '../../../../src/lib/errors';
import { productionIds, productionDate, productionRecord } from '../../../../src/lib/production-validation';
import { textField } from '../../../../src/lib/request-validation';
import { executeCustomProduction } from '../../../../src/server/custom-production';
import { runProductionAgent } from '../../../../src/server/production-agent';
import { readJson } from '../../../../src/lib/request-validation';
import { productionWorkspace, executeProduction } from '../../../../src/server/production';
export async function GET(request: NextRequest) {
    try {
        const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR', 'PRINT_OPERATOR', 'FILE_REVIEWER']);
        if (access.response)
            return access.response;
        const workspace = await productionWorkspace({ id: access.session!.id, role: access.session!.role });
        if (access.session!.role === 'WORKSHOP_OPERATOR') workspace.custom = { items: [], batches: [] };
        return NextResponse.json({ success: true, data: workspace }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return apiErrorResponse(error, 'Không thể tải dữ liệu sản xuất.');
    }
}
export async function POST(request: NextRequest) {
    try {
        const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR', 'PRINT_OPERATOR', 'FILE_REVIEWER']);
        if (access.response)
            return access.response;
        const input = productionRecord(await readJson(request));
        if (typeof input.action === 'string' && input.action.startsWith('CUSTOM_')) {
            if (access.session!.role === 'WORKSHOP_OPERATOR')
                throw new AppError('Vai trò vận hành catalogue không có quyền xử lý file in custom.', 403);
            return NextResponse.json({ success: true, data: await executeCustomProduction(input, { id: access.session!.id, role: access.session!.role }, request.headers.get('Idempotency-Key')) }, { headers: { 'Cache-Control': 'no-store' } });
        }
        if (input.action === 'RUN_AGENT') {
            if (!['ADMIN', 'WORKSHOP_OPERATOR'].includes(access.session!.role))
                throw new AppError('Chỉ quản trị hoặc điều phối được yêu cầu agent chuẩn bị phương án.', 403);
            const key = textField(request.headers.get('Idempotency-Key'), 'Idempotency-Key', 100);
            if (!/^[A-Za-z0-9_-]{16,100}$/.test(key))
                throw new AppError('Khóa thao tác không hợp lệ.');
            return NextResponse.json({ success: true, data: await runProductionAgent({ itemIds: productionIds(input.itemIds), startAt: productionDate(input.startAt), key, requestedBy: access.session!.id }) }, { headers: { 'Cache-Control': 'no-store' } });
        }
        const result = await executeProduction(input, { id: access.session!.id, role: access.session!.role as 'ADMIN' | 'WORKSHOP_OPERATOR' | 'PRINT_OPERATOR' | 'FILE_REVIEWER' }, request.headers.get('Idempotency-Key'));
        return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return apiErrorResponse(error, 'Không thể thực hiện thao tác sản xuất.');
    }
}
