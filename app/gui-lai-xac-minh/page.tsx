import type { Metadata } from 'next';
import AccountActionForm from '../../src/components/auth/AccountActionForm';

export const metadata: Metadata = { title: 'Gửi lại xác minh | MinhLab', robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  return <AccountActionForm mode="resend" token={token} />;
}
