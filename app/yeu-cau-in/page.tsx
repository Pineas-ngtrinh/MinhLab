import type { Metadata } from 'next';
import { PrintRequestsWorkspace } from '../../src/components/print-requests/PrintRequestsWorkspace';
export const metadata: Metadata = { title: 'Yêu cầu in & báo giá | MinhLab', robots: { index: false, follow: false } };
export default function PrintRequestsPage() { return <PrintRequestsWorkspace />; }
