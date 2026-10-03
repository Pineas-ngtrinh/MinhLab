'use client';

import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, useGLTF, OrbitControls, Center } from '@react-three/drei';
import { X, ShoppingBag, Check, Layers, Box } from 'lucide-react';
import type { ProductItem } from '../../config/site.config';
import { useCart } from '../../context/CartContext';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';

interface Product3DModalProps {
  product: ProductItem | null;
  onClose: () => void;
}

function ProductModel({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath);
  const cloned = React.useMemo(() => scene.clone(true), [scene]);

  return (
    <Center top>
      <primitive object={cloned} scale={1.2} />
    </Center>
  );
}

export const Product3DModal: React.FC<Product3DModalProps> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const [added, setAdded] = React.useState(false);

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  // Select appropriate 3D model based on product ID
  const modelPath = product.id === 'prod-lab-diorama'
    ? '/models/minhlab-lab-v1.glb'
    : '/models/minhlab-mascot-v1.glb';

  const handleAddToCart = () => {
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-3d-title"
    >
      <div className="relative w-full max-w-4xl bg-[#0E131A] border border-[#27313C] rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 min-w-[40px] min-h-[40px] p-2 rounded-lg bg-[#141A21]/80 hover:bg-[#1A222C] text-[#A5ADB8] hover:text-white border border-[#27313C] flex items-center justify-center transition-colors"
          aria-label="Đóng bảng xem 3D"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cột Trái: 3D Canvas xoay tự do */}
        <div className="w-full md:w-3/5 h-[340px] md:h-[480px] relative bg-[#080B0F] cursor-grab active:cursor-grabbing">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-[#141A21]/80 border border-[#27313C] text-[11px] font-mono text-[#A5ADB8]">
            <Box className="w-3.5 h-3.5 text-[#EB4037]" />
            <span>Xoay 360° &amp; Cuộn chuột phóng to</span>
          </div>

          <CanvasErrorBoundary
            fallback={
              <div className="relative w-full h-full flex items-center justify-center p-6 bg-[#080B0F]">
                <img
                  src={product.image}
                  alt={product.title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            }
          >
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{ position: [0, 1.2, 3.5], fov: 40 }}
              gl={{ alpha: true, antialias: true }}
            >
              <ambientLight intensity={1.8} />
              <directionalLight position={[4, 6, 4]} intensity={2.8} castShadow />
              <directionalLight position={[-4, 2, -2]} intensity={1.5} color="#C8A261" />

              <Suspense fallback={null}>
                <ProductModel modelPath={modelPath} />
                <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={4} blur={2.5} far={3} />
              </Suspense>

              <OrbitControls
                enablePan={false}
                autoRotate
                autoRotateSpeed={1.2}
                minDistance={1.8}
                maxDistance={5.5}
              />
            </Canvas>
          </CanvasErrorBoundary>
        </div>

        {/* Cột Phải: Thông tin sản phẩm & Đặt mua */}
        <div className="w-full md:w-2/5 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#27313C] bg-[#0E131A]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#141A21] border border-[#27313C] text-[10px] font-mono text-[#EB4037] uppercase">
              <span>{product.category}</span>
            </div>

            <h3 id="modal-3d-title" className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">
              {product.title}
            </h3>

            <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
              {product.description}
            </p>

            {/* Spec Sheet Table */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-[#27313C]/60">
              <div className="p-2 rounded bg-[#141A21] border border-[#27313C]/60">
                <span className="block text-[10px] text-[#737D89]">VẬT LIỆU</span>
                <span className="text-[#F4F1EA] font-medium">{product.material}</span>
              </div>
              <div className="p-2 rounded bg-[#141A21] border border-[#27313C]/60">
                <span className="block text-[10px] text-[#737D89]">ĐỘ MỊN LAYER</span>
                <span className="text-[#EB4037] font-medium">{product.layerHeight || '0.12mm'}</span>
              </div>
              <div className="p-2 rounded bg-[#141A21] border border-[#27313C]/60">
                <span className="block text-[10px] text-[#737D89]">THỜI GIAN IN</span>
                <span className="text-[#F4F1EA] font-medium">{product.printTime || '16 giờ'}</span>
              </div>
              <div className="p-2 rounded bg-[#141A21] border border-[#27313C]/60">
                <span className="block text-[10px] text-[#737D89]">KÍCH THƯỚC</span>
                <span className="text-[#F4F1EA] font-medium">{product.dimensions}</span>
              </div>
            </div>
          </div>

          {/* Pricing & Add to Cart */}
          <div className="pt-6 border-t border-[#27313C] space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-[#737D89] block">Giá hoàn thiện</span>
                <span className="text-2xl font-mono font-bold text-[#F4F1EA]">
                  {formatVND(product.price)}
                </span>
              </div>
              {product.originalPrice && (
                <span className="text-sm font-mono text-[#6B7280] line-through">
                  {formatVND(product.originalPrice)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              className={`w-full min-h-[48px] py-3 px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                added
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#EB4037] hover:bg-[#FF5147] text-white shadow-lg shadow-[#EB4037]/25'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã thêm vào giỏ hàng!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Thêm vào giỏ hàng</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Product3DModal;
