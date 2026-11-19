'use client';

import Image from '../common/ProductImage';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { ProductItem } from '../../contracts/catalog';
import { useCart } from '../../context/CartContext';
import { productBadge } from '../../lib/catalog';
import { formatVND } from '../../lib/format';

interface CompactProductCardProps {
  product: ProductItem;
  onView?: () => void;
  priority?: boolean;
}

export function CompactProductCard({ product, onView, priority = false }: CompactProductCardProps) {
  const { addToCart } = useCart();
  const href = `/bo-suu-tap?product=${encodeURIComponent(product.id)}`;
  const imageClass = 'relative block aspect-square w-full overflow-hidden bg-[#090D12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A261]';
  const image = (
    <>
      <Image src={product.image} alt={product.title} fill priority={priority}
        sizes="(max-width: 1023px) 50vw, 33vw" className="object-contain p-2 transition-transform duration-200 motion-safe:group-hover:scale-105" />
      <span className="absolute left-2 top-2 rounded bg-[#0B0F14]/90 px-2 py-1 text-[10px] text-[#F4F1EA]">
        {productBadge(product)}
      </span>
    </>
  );

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#27313C] bg-[#141A21] text-left">
      {onView ? (
        <button type="button" onClick={onView} aria-label={`Xem chi tiết ${product.title}`} className={imageClass}>{image}</button>
      ) : (
        <Link href={href} aria-label={`Xem chi tiết ${product.title}`} className={imageClass}>{image}</Link>
      )}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <h3 className="min-h-10 text-xs font-semibold leading-5 text-[#F4F1EA] sm:text-sm">
          {onView ? (
            <button type="button" onClick={onView} className="line-clamp-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">{product.title}</button>
          ) : (
            <Link href={href} className="line-clamp-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">{product.title}</Link>
          )}
        </h3>
        <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-[#F4F1EA]">{formatVND(product.price)}</p>
        <button type="button" disabled={!product.inStock} onClick={() => addToCart(product, 1, product.colors[0]?.name)}
          aria-label={`Thêm ${product.title} vào giỏ hàng`}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[#35414E] px-2 text-xs font-medium text-[#F4F1EA] transition-colors hover:bg-[#1A222C] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
          <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
          Thêm giỏ
        </button>
      </div>
    </article>
  );
}
