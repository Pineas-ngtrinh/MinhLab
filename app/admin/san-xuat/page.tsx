import type { Metadata } from 'next';
import { ProductionManager } from '../../../src/components/admin/production/ProductionManager';
export const metadata: Metadata = { title: 'Sản xuất | MinhLab', robots: { index: false, follow: false } };
export default function ProductionPage() { return <ProductionManager />; }
