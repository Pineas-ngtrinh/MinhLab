'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  AdminProduct,
  ProductInput,
  CatalogCategoryOption,
  CatalogImageUploadResult,
  CatalogImagePlacement,
} from '../../../contracts/catalog-admin';
import type { ApiResponse } from '../../../contracts/api';
import type { ProductionWorkspace, Revision } from '../../../contracts/production';
import { VariantEditor } from './VariantEditor';
import { INPUT, BUTTON, newProduct, editableVariants } from './product-form';
import { RevisionForm } from '../production/ProductionForms';
import { ModalDialog } from '../../common/ModalDialog';
import ProductImage from '../../common/ProductImage';

interface ProductEditorProps {
  product: AdminProduct | null;
  categories: CatalogCategoryOption[];
  onSaved: (product: AdminProduct, options?: { keepOpen: boolean }) => void;
  onCancel: () => void;
  onRequestPublication?: (product: AdminProduct) => void;
}
export function ProductEditor({ product, categories, onSaved, onCancel, onRequestPublication }: ProductEditorProps) {
  const [draft, setDraft] = useState<ProductInput>(() =>
    product
      ? { ...product, variants: editableVariants(product.variants) }
      : newProduct(categories[0]?.id ?? ''),
  );
  const [imageText, setImageText] = useState(draft.images.join('\n'));
  const [imageListNotice, setImageListNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const uploadLock = useRef(false);
  const [imageNotice, setImageNotice] = useState('');
  const [imageError, setImageError] = useState('');
  const [savedProduct, setSavedProduct] = useState(product);
  const activeProduct = savedProduct ?? product;
  const [production, setProduction] = useState<ProductionWorkspace | null>(null);
  const [productionLoading, setProductionLoading] = useState(true);
  const [productionError, setProductionError] = useState('');
  const [productionBusy, setProductionBusy] = useState(false);
  const [revisionEditor, setRevisionEditor] = useState<{
    kind: Revision['kind'];
    variantId?: string;
  } | null>(null);
  const saving = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const patch = (value: Partial<ProductInput>) => setDraft((current) => ({ ...current, ...value }));
  const imageUrls = imageText.split('\n').map((value) => value.trim()).filter(Boolean);

  function moveGalleryImage(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (index < 1 || nextIndex < 1 || nextIndex >= imageUrls.length) return;
    const next = [...imageUrls];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setImageText(next.join('\n'));
    setImageListNotice('Đã đổi thứ tự ảnh góc. Lưu bản nháp để áp dụng.');
  }

  function makeMainImage(index: number) {
    if (index < 1 || index >= imageUrls.length) return;
    const next = [...imageUrls];
    const [selected] = next.splice(index, 1);
    next.unshift(selected);
    setImageText(next.join('\n'));
    setImageListNotice('Đã chọn ảnh chính mới; ảnh chính cũ được giữ trong thư viện góc. Lưu bản nháp để áp dụng.');
  }

  function removeImage(index: number) {
    setImageText(imageUrls.filter((_, imageIndex) => imageIndex !== index).join('\n'));
    setImageListNotice(index === 0
      ? 'Đã gỡ ảnh chính. Ảnh góc đầu tiên sẽ thành ảnh chính; lưu bản nháp để áp dụng.'
      : 'Đã gỡ ảnh góc. Lưu bản nháp để áp dụng.');
  }

  async function loadProduction(signal?: AbortSignal) {
    try {
      const response = await fetch('/api/workshop/production', {
        cache: 'no-store',
        signal,
      });
      const body: ApiResponse<ProductionWorkspace> = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.success ? 'Không thể tải dữ liệu sản xuất.' : body.error);
      if (!signal?.aborted) {
        setProduction(body.data);
        setProductionError('');
      }
    } catch (cause) {
      if (!signal?.aborted)
        setProductionError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu sản xuất.');
    } finally {
      if (!signal?.aborted) setProductionLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void loadProduction(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(initialLoad);
    };
  }, []);

  async function saveProductionRevision(input: unknown): Promise<boolean> {
    if (productionBusy) return false;
    setProductionBusy(true);
    setProductionError('');
    try {
      const response = await fetch('/api/workshop/production', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(input),
      });
      const body: ApiResponse<{ id?: string }> = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.success ? 'Không thể lưu cấu hình sản xuất.' : body.error);
      await loadProduction();
      return true;
    } catch (cause) {
      setProductionError(cause instanceof Error ? cause.message : 'Không thể lưu cấu hình sản xuất.');
      return false;
    } finally {
      setProductionBusy(false);
    }
  }

  async function persistProduct(): Promise<AdminProduct> {
    const currentProduct = activeProduct;
    const response = await fetch(
      currentProduct ? `/api/admin/products/${currentProduct.id}` : '/api/admin/products',
      {
        method: currentProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          revision: currentProduct?.revision,
          images: imageUrls,
        }),
      },
    );
    const body: ApiResponse<AdminProduct> = await response.json();
    if (!response.ok || !body.success)
      throw new Error(body.success ? 'Không thể lưu sản phẩm.' : body.error);
    setSavedProduct(body.data);
    setDraft({ ...body.data, variants: editableVariants(body.data.variants) });
    setImageText(body.data.images.join('\n'));
    await loadProduction();
    onSaved(body.data, { keepOpen: true });
    return body.data;
  }

  async function ensureProductSavedForUpload(): Promise<AdminProduct | null> {
    if (!formRef.current?.reportValidity())
      throw new Error('Hãy điền đầy đủ các trường bắt buộc của sản phẩm và biến thể trước khi tải ảnh.');
    if (saving.current)
      throw new Error('Sản phẩm đang được lưu. Hãy chờ lưu xong rồi tải ảnh.');
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      return await persistProduct();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function uploadImages(files: File[], placement: CatalogImagePlacement) {
    if (files.length === 0) return;
    if (busy || uploadingImage || uploadLock.current) { setImageError('Đang lưu sản phẩm hoặc ảnh. Chờ hoàn tất rồi thử lại.'); return; }
    setError('');
    setImageError('');
    setImageNotice('');
    if (placement === 'GALLERY' && imageUrls.length === 0) {
      setImageError('Hãy tải ảnh chính lên trước, sau đó thêm các góc sản phẩm.');
      return;
    }
    if (placement === 'MAIN' && files.length !== 1) {
      setImageError('Ảnh chính chỉ nhận một ảnh mỗi lần.');
      return;
    }
    if (imageUrls.length + files.length > 20) {
      setImageError('Mỗi sản phẩm tối đa 20 ảnh. Hãy chọn ít ảnh hơn hoặc gỡ ảnh cũ trước.');
      return;
    }
    if (files.some((file) => file.size <= 0 || file.size > 5 * 1024 * 1024)) {
      setImageError('Có ảnh rỗng hoặc vượt quá 5 MB; chưa tải ảnh nào lên.');
      return;
    }

    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setImageError('Chỉ nhận ảnh JPEG, PNG hoặc WebP. Hãy chuyển ảnh HEIC sang JPEG hoặc PNG trước khi tải.');
      return;
    }

    let targetProduct: AdminProduct | null = null;
    uploadLock.current = true;
    setUploadingImage(true);
    try {
      targetProduct = await ensureProductSavedForUpload();
      if (!targetProduct) return;
      setUploadingImage(true);
      for (const [index, file] of files.entries()) {
        const form = new FormData();
        form.append('image', file);
        form.append('placement', placement);
        const response: Response = await fetch(`/api/admin/products/${targetProduct.id}/images`, {
          method: 'POST',
          body: form,
        });
        let body: ApiResponse<CatalogImageUploadResult>;
        try {
          body = await response.json();
        } catch {
          throw new Error(response.status === 413
            ? 'Máy chủ từ chối vì ảnh vượt giới hạn tải lên. Hãy chọn ảnh nhỏ hơn 5 MB.'
            : `Máy chủ chưa trả về kết quả tải ảnh hợp lệ (HTTP ${response.status}). Hãy thử lại hoặc kiểm tra log máy chủ.`);
        }
        if (!response.ok || !body.success) {
          throw new Error(body.success ? `Không tải được ảnh ${file.name}.` : body.error);
        }
        const remaining: string[] = targetProduct.images.filter((url) => url !== body.data.url);
        targetProduct = {
          ...targetProduct,
          images: placement === 'MAIN' ? [body.data.url, ...remaining] : [...remaining, body.data.url],
        };
        setSavedProduct(targetProduct);
        setImageText(targetProduct.images.join('\n'));
        onSaved(targetProduct, { keepOpen: true });
        setImageNotice(placement === 'MAIN'
          ? 'Đã tải ảnh chính lên Cloudinary.'
          : `Đã tải ${index + 1}/${files.length} ảnh góc lên Cloudinary.`);
      }
      setImageNotice(placement === 'MAIN'
        ? 'Ảnh chính đã được cập nhật; ảnh bìa cũ vẫn nằm trong thư viện góc.'
        : `Đã tải xong ${files.length} ảnh góc lên Cloudinary.`);
    } catch (cause) {
      setImageError(cause instanceof Error ? cause.message : 'Không thể tải ảnh sản phẩm.');
    } finally {
      uploadLock.current = false;
      setUploadingImage(false);
    }
  }

  async function saveDraft(requestPublication = false) {
    if (saving.current || uploadingImage || !formRef.current?.reportValidity()) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await persistProduct();
      if (requestPublication) onRequestPublication?.(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu sản phẩm.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await saveDraft();
  }
  return (
    <>
    <form
      ref={formRef}
      onSubmit={submit}
      className="space-y-6 rounded-xl border border-[#27313C] bg-[#111216] p-4 sm:p-6"
    >
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {activeProduct ? `Sửa sản phẩm ${activeProduct.code}` : 'Thêm sản phẩm'}
        </h2>
        <p className="text-sm leading-6 text-[#A5ADB8]">
          Lưu thành bản nháp. Kiểm tra nguồn gốc, ảnh và giá; quản trị viên sẽ duyệt trước khi sản phẩm xuất hiện ở cửa hàng.
        </p>
      </div>
      <p role="status" className="rounded-lg border border-[#27313C] p-3 text-sm leading-6 text-[#A5ADB8]">
        {activeProduct?.publication === 'PUBLISHED' && activeProduct.compliance === 'APPROVED'
          ? 'Sản phẩm đã được duyệt và xuất bản. Lưu thay đổi hoặc tải ảnh mới sẽ đưa sản phẩm về bản nháp; cần duyệt xuất bản lại để tiếp tục hiển thị ở cửa hàng.'
          : onRequestPublication
            ? 'Sản phẩm chưa được mở bán. Lưu bản nháp chưa đưa sản phẩm lên cửa hàng; chọn “Lưu & duyệt xuất bản” để kiểm tra và xác nhận mở bán.'
            : 'Lưu bản nháp chưa đưa sản phẩm lên cửa hàng. Quản trị viên cần kiểm tra và duyệt xuất bản.'}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[#EB4037]/40 p-3 text-sm text-[#FF8179]"
        >
          {error}
        </p>
      )}
      <fieldset disabled={busy || uploadingImage} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Tên sản phẩm *
          <input
            className={INPUT}
            value={draft.name}
            required
            maxLength={200}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          Danh mục *
          <select
            className={INPUT}
            required
            value={draft.categoryId}
            onChange={(event) => patch({ categoryId: event.target.value })}
          >
            <option value="" disabled>
              Chọn danh mục
            </option>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          Mô tả ngắn
          <textarea
            className={INPUT}
            rows={2}
            maxLength={300}
            value={draft.shortDescription}
            onChange={(event) => patch({ shortDescription: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          Mô tả chi tiết
          <textarea
            className={INPUT}
            rows={6}
            maxLength={12000}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          Vật liệu
          <input
            className={INPUT}
            maxLength={160}
            value={draft.material}
            onChange={(event) => patch({ material: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          Thời gian hoàn thiện
          <input
            className={INPUT}
            maxLength={160}
            value={draft.leadTime}
            onChange={(event) => patch({ leadTime: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          Độ phân giải / lớp in
          <input
            className={INPUT}
            maxLength={160}
            value={draft.layerHeight}
            onChange={(event) => patch({ layerHeight: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          Cách sản xuất
          <select
            className={INPUT}
            value={draft.productionMode}
            onChange={(event) =>
              patch({ productionMode: event.target.value as ProductInput['productionMode'] })
            }
          >
            <option value="MADE_TO_ORDER">Chế tác sau khi đặt</option>
            <option value="IN_STOCK">Có hàng tại xưởng</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Nguồn gốc mẫu
          <select
            className={INPUT}
            value={draft.source}
            onChange={(event) => patch({ source: event.target.value as ProductInput['source'] })}
          >
            <option value="ORIGINAL">MinhLab tự thiết kế</option>
            <option value="LICENSED">Có giấy phép sử dụng</option>
            <option value="PUBLIC_DOMAIN">Thuộc phạm vi công cộng</option>
            <option value="FUNCTIONAL_REPLACEMENT">Mẫu phục dựng / linh kiện tương thích</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Nhãn sản phẩm
          <select
            className={INPUT}
            value={draft.badge ?? ''}
            onChange={(event) =>
              patch({ badge: (event.target.value || null) as ProductInput['badge'] })
            }
          >
            <option value="">Không gắn nhãn</option>
            {['MỚI', 'TIÊU BIỂU', 'BÁN CHẠY', 'ĐỘC BẢN'].map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Thứ tự hiển thị
          <input
            type="number"
            className={INPUT}
            min={0}
            max={2147483647}
            step={1}
            value={draft.sortOrder}
            onChange={(event) => patch({ sortOrder: Number(event.target.value) })}
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#EB4037]"
            checked={draft.featured}
            onChange={(event) => patch({ featured: event.target.checked })}
          />{' '}
          Sản phẩm nổi bật
        </label>
        <section className="space-y-4 sm:col-span-2" aria-labelledby="product-images-title">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#27313C] pb-3">
            <div>
              <h3 id="product-images-title" className="font-semibold">Ảnh sản phẩm</h3>
              <p className="mt-1 text-xs leading-5 text-[#A5ADB8]">
                Tệp ảnh nằm trên Cloudinary; database chỉ lưu liên kết ảnh và thông tin quản lý.
              </p>
            </div>
            <p className="font-mono text-xs text-[#A5ADB8]">{imageUrls.length}/20 ảnh</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-lg border border-[#27313C] bg-[#0B0F14] p-4" aria-labelledby="main-image-title" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={event => { event.preventDefault(); event.stopPropagation(); void uploadImages(Array.from(event.dataTransfer.files), 'MAIN'); }}>
              <div className="space-y-1">
                <h4 id="main-image-title" className="text-sm font-semibold">1. Ảnh chính</h4>
                <p className="text-xs leading-5 text-[#A5ADB8]">Kéo thả một ảnh vào khung này hoặc chọn ảnh từ thiết bị. Ảnh chính làm bìa trong cửa hàng.</p>
              </div>
              {imageUrls[0] ? (
                <div className="overflow-hidden rounded-lg border border-[#27313C]">
                  <ProductImage src={imageUrls[0]} alt={`${draft.name || 'Sản phẩm'} · ảnh chính`} width={640} height={420} className="aspect-[3/2] w-full object-cover" />
                  <div className="flex items-center justify-between gap-3 p-3">
                    <span className="text-xs text-admin-secondary">Ảnh chính hiện tại</span>
                    <button type="button" className={`${BUTTON} min-h-9 px-3 text-xs border-[#EB4037]/50 text-[#FFB0A7]`} disabled={busy || uploadingImage} onClick={() => removeImage(0)}>Gỡ ảnh chính</button>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[3/2] items-center justify-center rounded-lg border border-dashed border-[#27313C] px-4 text-center text-sm text-[#A5ADB8]">
                  Chưa có ảnh chính. Tải một ảnh lên để bắt đầu.
                </div>
              )}
              <label className="block space-y-2 text-sm">
                <span>{imageUrls[0] ? 'Chọn ảnh khác làm ảnh chính' : 'Chọn ảnh chính'}</span>
                <input
                  className={`${INPUT} file:mr-3 file:border-0 file:bg-transparent file:text-admin-accent`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy || uploadingImage || imageUrls.length >= 20}
                  onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; void uploadImages(files, 'MAIN'); }}
                  aria-describedby={imageError ? "main-image-help product-image-error" : "main-image-help"}
                />
              </label>
              <p id="main-image-help" className="text-xs leading-5 text-[#A5ADB8]">
                JPEG, PNG hoặc WebP · tối đa 5 MB. Khi tạo sản phẩm mới, chọn ảnh chính sẽ tự lưu sản phẩm thành bản nháp trước.
              </p>
            </section>

            <section className="space-y-3 rounded-lg border border-[#27313C] bg-[#0B0F14] p-4" aria-labelledby="gallery-images-title" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={event => { event.preventDefault(); event.stopPropagation(); void uploadImages(Array.from(event.dataTransfer.files), 'GALLERY'); }}>
              <div className="space-y-1">
                <h4 id="gallery-images-title" className="text-sm font-semibold">2. Ảnh các góc sản phẩm</h4>
                <p className="text-xs leading-5 text-[#A5ADB8]">Kéo thả hoặc chọn nhiều ảnh cùng lúc; ảnh sẽ được thêm sau ảnh chính.</p>
              </div>
              <label className="block space-y-2 text-sm">
                <span>Tải ảnh góc lên</span>
                <input
                  className={`${INPUT} file:mr-3 file:border-0 file:bg-transparent file:text-admin-accent`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={busy || uploadingImage || imageUrls.length === 0 || imageUrls.length >= 20}
                  onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; void uploadImages(files, 'GALLERY'); }}
                  aria-describedby={imageError ? "gallery-image-help product-image-error" : "gallery-image-help"}
                />
              </label>
              <p id="gallery-image-help" className="text-xs leading-5 text-[#A5ADB8]">
                JPEG, PNG hoặc WebP · tối đa 5 MB mỗi ảnh · tổng cộng tối đa 20 ảnh.
                {!imageUrls.length && ' Tải ảnh chính lên trước để mở phần này.'}
              </p>
              {imageUrls.length > 1 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {imageUrls.slice(1).map((url, galleryIndex) => {
                    const index = galleryIndex + 1;
                    return (
                      <li key={`${url}:${index}`} className="overflow-hidden rounded-lg border border-[#27313C] bg-[#111216]">
                        <ProductImage src={url} alt={`${draft.name || 'Sản phẩm'} · góc ${index}`} width={480} height={320} className="aspect-[3/2] w-full object-cover" />
                        <div className="space-y-2 p-3">
                          <p className="text-sm font-medium text-admin-secondary">Góc {index}</p>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className={BUTTON} disabled={busy || uploadingImage} onClick={() => makeMainImage(index)}>Đặt làm ảnh chính</button>
                            <button type="button" className={BUTTON} disabled={busy || uploadingImage || index === 1} onClick={() => moveGalleryImage(index, -1)} aria-label={`Đưa góc ${index} lên trước`}>Lên trước</button>
                            <button type="button" className={BUTTON} disabled={busy || uploadingImage || index === imageUrls.length - 1} onClick={() => moveGalleryImage(index, 1)} aria-label={`Đưa góc ${index} xuống sau`}>Xuống sau</button>
                            <button type="button" className={`${BUTTON} border-[#EB4037]/50 text-[#FFB0A7]`} disabled={busy || uploadingImage} onClick={() => removeImage(index)}>Gỡ ảnh</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-[#27313C] p-4 text-sm text-[#A5ADB8]">
                  Chưa có ảnh góc. Sau khi tải ảnh chính, chọn một hoặc nhiều ảnh chi tiết tại đây.
                </p>
              )}
            </section>
          </div>

          {imageError && <p id="product-image-error" role="alert" className="rounded-lg border border-[#EB4037]/40 p-3 text-sm text-[#FF8179]">{imageError}</p>}
          {imageNotice && <p role="status" className="text-sm text-admin-success">{imageNotice}</p>}
          {imageListNotice && <p role="status" className="text-xs text-admin-secondary">{imageListNotice}</p>}
          {(busy || uploadingImage) && <p role="status" className="text-xs text-[#A5ADB8]">{uploadingImage ? 'Đang tải ảnh lên Cloudinary…' : 'Đang lưu sản phẩm…'}</p>}
        </section>
      </fieldset>
      <VariantEditor
        variants={draft.variants}
        disabled={busy || uploadingImage}
        onChange={(variants) => patch({ variants })}
      />
      {activeProduct && (
        <section className="space-y-4 border-t border-[#27313C] pt-5" aria-labelledby="production-setup-title">
          <div className="space-y-1">
            <h3 id="production-setup-title" className="font-semibold">Chuẩn bị sản xuất cho từng biến thể</h3>
            <p className="text-sm leading-6 text-[#A5ADB8]">
              Gắn định mức linh kiện cho từng biến thể ngay khi tạo sản phẩm. Đơn mới sẽ tự dùng định mức đã công bố;
              kỹ thuật xác nhận phiên bản trước khi quản trị viên công bố.
            </p>
          </div>
          {productionError && <p role="alert" className="text-sm text-[#FF8179]">{productionError}</p>}
          {productionLoading ? <p role="status" className="text-sm text-[#A5ADB8]">Đang kiểm tra cấu hình xưởng…</p> : (
            <div className="divide-y divide-[#27313C]">
              {activeProduct.variants.filter((variant) => variant.status !== 'INACTIVE').map((variant) => {
                const boms = production?.revisions.filter((revision) => revision.kind === 'BOM' && revision.variantId === variant.id) ?? [];
                const publishedBom = boms.filter((revision) => revision.status === 'PUBLISHED').sort((a, b) => b.revision - a.revision)[0];
                const draftBom = boms.filter((revision) => revision.status === 'DRAFT').sort((a, b) => b.revision - a.revision)[0];
                return <div key={variant.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{variant.sku} · {variant.name}</p>
                    <p className="mt-1 text-xs text-[#A5ADB8]">{publishedBom ? `Đã nối định mức r${publishedBom.revision}; đơn mới tự nhận cấu hình này.` : draftBom ? 'Định mức đang chờ nhân viên kỹ thuật xác nhận và quản trị viên công bố.' : 'Chưa có định mức linh kiện; đơn vẫn được nhận nhưng chưa thể xếp mẻ in.'}</p>
                  </div>
                  <button type="button" className={BUTTON} onClick={() => setRevisionEditor({ kind: 'BOM', variantId: variant.id })}>
                    {publishedBom ? 'Tạo phiên bản định mức mới' : 'Thiết lập định mức linh kiện'}
                  </button>
                </div>;
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#27313C] py-3">
                <p className="text-sm text-[#A5ADB8]">Có thể dùng lại linh kiện đã công bố hoặc bổ sung linh kiện mới.</p>
                <button type="button" className={BUTTON} onClick={() => setRevisionEditor({ kind: 'COMPONENT' })}>Thêm linh kiện</button>
              </div>
            </div>
          )}
        </section>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-[#27313C] pt-5">
        <button
          type="submit"
          disabled={busy || uploadingImage}
          className={`${BUTTON} bg-[#EB4037] hover:bg-[#FF5147]`}
        >
          {uploadingImage ? 'Đang tải ảnh…' : busy ? 'Đang lưu…' : 'Lưu bản nháp'}
        </button>
        {onRequestPublication && <button type="button" className={`${BUTTON} border-admin-accent text-admin-accent`} disabled={busy || uploadingImage} onClick={() => void saveDraft(true)}>Lưu &amp; duyệt xuất bản</button>}
        <button type="button" className={BUTTON} disabled={busy || uploadingImage} onClick={onCancel}>
          Quay lại danh sách
        </button>
        {!activeProduct && (
          <p className="text-xs text-[#A5ADB8]">Mã sản phẩm và mã biến thể được cấp tự động khi lưu.</p>
        )}
      </div>
    </form>
    {revisionEditor && production && (
      <ModalDialog title="Dữ liệu sản xuất của sản phẩm" onDismiss={() => { if (!productionBusy) setRevisionEditor(null); }} className="items-start p-4 sm:p-8">
        <section className="my-auto w-full max-w-2xl min-w-0 rounded-xl border border-[#27313C] bg-[#08090C] p-5 sm:p-8">
          <button type="button" className={`${BUTTON} mb-5`} disabled={productionBusy} onClick={() => setRevisionEditor(null)}>Đóng</button>
          <RevisionForm
            key={`${revisionEditor.kind}-${revisionEditor.variantId ?? 'shared'}`}
            data={production}
            send={saveProductionRevision}
            busy={productionBusy}
            initialKind={revisionEditor.kind}
            initialVariantId={revisionEditor.variantId}
          />
          <p className="mt-4 text-xs leading-5 text-[#A5ADB8]">Phiên bản mới được lưu dạng nháp. Người vận hành xác nhận kỹ thuật; quản trị công bố để các đơn mới tự sử dụng.</p>
        </section>
      </ModalDialog>
    )}
    </>
  );
}
