import type { Metadata } from 'next';
import { TeamAccountsManager } from '../../../src/components/admin/team/TeamAccountsManager';

export const metadata: Metadata = { title: 'Tài khoản & phân quyền | MinhLab', robots: { index: false, follow: false } };

export default function TeamManagementPage() {
  return <TeamAccountsManager />;
}
