import Hero3DSection from './Hero3DSection';
import { Suspense } from 'react';
import { CatalogSection } from '../products/CatalogSection';
import { CatalogNotice } from '../products/CatalogNotice';
import HomeLabTeaser from './HomeLabTeaser';
import HomeServiceSection from './HomeServiceSection';
import { FAQSection } from '../faq/FAQSection';

export default function StudioExperience() {
  return (
    <div className="w-full text-[#F4F1EA] flex flex-col relative">
      <Hero3DSection />

      <Suspense fallback={<CatalogNotice state="loading" />}>
        <CatalogSection view="home" />
      </Suspense>

      <HomeLabTeaser />

      <HomeServiceSection />

      <FAQSection />
    </div>
  );
}
