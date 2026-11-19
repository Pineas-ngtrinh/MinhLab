import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../src/lib/api-response';
import { parsePageOptions } from '../../../src/lib/pagination';
import { readJson } from '../../../src/lib/request-validation';
import { printWorkspace, executePrintRequest } from '../../../src/server/print-requests';
import type { RequestActor } from '../../../src/services/print-requests/print-request.ports';
export async function GET(request: NextRequest) {
    try {
        const a = await authorizeRoles(request, ['CUSTOMER', 'FILE_REVIEWER', 'ADMIN']);
        if (a.response)
            return a.response;
        return NextResponse.json({ success: true, data: await printWorkspace({ id: a.session!.id, role: a.session!.role as RequestActor['role'] }, parsePageOptions(request.nextUrl.searchParams, ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'READY_FOR_QUOTE', 'CLOSED', 'REJECTED']), request.nextUrl.searchParams.get('mine') === '1') }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return apiErrorResponse(error, 'Không thể tải yêu cầu in.');
    }
}
export async function POST(request: NextRequest) {
    try {
        const a = await authorizeRoles(request, ['CUSTOMER', 'FILE_REVIEWER', 'ADMIN']);
        if (a.response)
            return a.response;
        return NextResponse.json({ success: true, data: await executePrintRequest(await readJson(request), { id: a.session!.id, role: a.session!.role as RequestActor['role'] }, request.headers.get('Idempotency-Key')) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return apiErrorResponse(error, 'Không thể lưu yêu cầu in.');
    }
}
