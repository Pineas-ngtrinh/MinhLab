import { connection } from 'next/server';
import { CatalogService } from '../../server/catalog';
import HomeFeaturedProducts from '../home/HomeFeaturedProducts';
import { ProductGallery } from './ProductGallery';
import { CatalogNotice } from './CatalogNotice';

interface CatalogSectionProps {
  view: 'home' | 'collection';
}

export async function CatalogSection({view}: CatalogSectionProps) {
  await connection();
  let catalog;
  try {
    catalog = await CatalogService.getStorefront();
  } catch {
    process.stderr.write('Catalogue: không thể đọc dữ liệu.\n');
  }
  if (!catalog) return <CatalogNotice state="error" />;
  return view === 'home' ? <HomeFeaturedProducts {...catalog} /> : <ProductGallery {...catalog} />;
}
