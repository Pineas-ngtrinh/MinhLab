import { NextRequest, NextResponse } from 'next/server';
import { authorizeRoles } from '../../../../src/lib/auth-session';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { downloadPrivateFile } from '../../../../src/server/private-files';
import { uuidField } from '../../../../src/lib/catalog-validation';
export async function GET(request: NextRequest, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const a = await authorizeRoles(request, ['CUSTOMER', 'FILE_REVIEWER', 'PRINT_OPERATOR']);
        if (a.response)
            return a.response;
        const file = await downloadPrivateFile(uuidField((await context.params).id), a.session!.id, a.session!.role);
        return new NextResponse(file.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': file.bytes, 'Content-Disposition': `attachment; filename="${file.filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox" } });
    }
    catch (error) {
        return apiErrorResponse(error, 'Không thể đọc file riêng tư.');
    }
}
