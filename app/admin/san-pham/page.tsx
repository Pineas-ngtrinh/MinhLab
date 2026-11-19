import type { Metadata } from 'next';
import { CatalogManager } from '../../../src/components/admin/catalog/CatalogManager';

export const metadata: Metadata = {title:'Sản phẩm | MinhLab',robots:{index:false,follow:false}};
export default function CatalogAdminPage() { return <CatalogManager />; }
