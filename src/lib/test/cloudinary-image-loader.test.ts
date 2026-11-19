import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudinaryImageLoader } from '../cloudinary-image-loader';

test('Cloudinary loader adds responsive width to existing auto transformations', () => {
  assert.equal(
    cloudinaryImageLoader({
      src: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v123/product.jpg',
      width: 640,
    }),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640,c_limit/v123/product.jpg',
  );
});

test('Cloudinary loader adds auto format, quality and width to untransformed assets', () => {
  assert.equal(
    cloudinaryImageLoader({
      src: 'https://res.cloudinary.com/demo/image/upload/product.jpg',
      width: 384,
    }),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_384,c_limit/product.jpg',
  );
});

test('Cloudinary loader leaves non-upload URLs unchanged', () => {
  const src = '/images/product-placeholder.svg';
  assert.equal(cloudinaryImageLoader({ src, width: 384 }), src);
});
