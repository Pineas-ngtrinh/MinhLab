import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../src/lib/api-response';
import { uploadPrivateFile } from '../../../src/server/private-files';
export async function POST(request: NextRequest) {
    try {
        const a = await authorizeRoles(request, ['CUSTOMER']);
        if (a.response)
            return a.response;
        return NextResponse.json({ success: true, data: await uploadPrivateFile(request, a.session!.id) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return apiErrorResponse(error, 'Không thể lưu file riêng tư.');
    }
}
