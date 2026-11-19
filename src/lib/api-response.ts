import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors';

export function apiErrorResponse(error: unknown, fallback: string): NextResponse {
  const requestId = randomUUID();
  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? 'APPLICATION_ERROR'
    : typeof error === 'object' && error !== null && 'code' in error
      && typeof error.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(error.code)
      ? error.code : 'UNEXPECTED_ERROR';
  if (status >= 500)
    process.stderr.write(`${JSON.stringify({ event: 'api_error', requestId, code, status })}\n`);
  return NextResponse.json({
    success: false,
    error: error instanceof AppError ? error.message : fallback,
    requestId,
  }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
  });
}
