import { AppError } from '../lib/errors';
import type { AdminBootstrapAccount } from '../services/auth/auth.ports';

export function requiresEmailVerification(): boolean {
  return process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION === 'true'
    || (process.env.NODE_ENV === 'production' && process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION !== 'false');
}

export function assertMailConfigured(): void {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.NEXT_PUBLIC_SITE_URL) {
    throw new AppError('Chức năng email chưa được cấu hình. Vui lòng liên hệ MinhLab để được hỗ trợ.', 503);
  }
}

export function adminBootstrapAccount(): AdminBootstrapAccount | null {
  const email = process.env.MINHLAB_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.MINHLAB_ADMIN_PASSWORD;
  if (!email || !password) return null;
  if (!email.includes('@') || password.length < 12) {
    throw new Error('MINHLAB_ADMIN_EMAIL phải hợp lệ và MINHLAB_ADMIN_PASSWORD cần ít nhất 12 ký tự.');
  }
  return { email, password, fullName: process.env.MINHLAB_ADMIN_NAME?.trim() || 'Quản trị viên MinhLab' };
}
