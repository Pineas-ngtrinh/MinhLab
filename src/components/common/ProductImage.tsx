'use client';

import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { cloudinaryImageLoader } from '../../lib/cloudinary-image-loader';

type ProductImageProps = Omit<ImageProps, 'src' | 'onError'> & { src: string };
export default function ProductImage({ src, alt, ...props }: ProductImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const imageSrc = failed === src ? '/images/product-placeholder.svg' : src;
  return (
    <Image
      {...props}
      alt={alt}
      src={imageSrc}
      loader={imageSrc.startsWith('https://res.cloudinary.com/') ? cloudinaryImageLoader : undefined}
      onError={() => setFailed(src)}
    />
  );
}
