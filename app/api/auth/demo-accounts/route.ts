import { NextResponse } from 'next/server';
import { AuthService, ROLES } from '../../../../src/services/auth.service';

export async function GET() {
  const accounts = AuthService.getDemoAccounts().map((acc) => ({
    email: acc.email,
    fullName: acc.full_name,
    role: acc.role,
    roleInfo: ROLES[acc.role],
    defaultPassword: `${acc.role.toLowerCase()}123`,
  }));

  return NextResponse.json({
    success: true,
    data: accounts,
  });
}
