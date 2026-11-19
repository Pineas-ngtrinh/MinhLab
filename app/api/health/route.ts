import { NextResponse } from 'next/server';
import { query } from '../../../src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await query('SELECT 1');
    return NextResponse.json({ status: 'ok', database: 'up' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable', database: 'down' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
