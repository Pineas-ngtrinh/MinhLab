'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { usePaginatedList } from '../../../hooks/usePaginatedList';
import { ListPagination } from '../../common/ListPagination';
import { formatVND } from '../../../lib/format';
import type {
  AdminProduct,
  CatalogCategoryOption,
  PublicationInput,
} from '../../../contracts/catalog-admin';
import type { ApiResponse } from '../../../contracts/api';
import { ProductEditor } from './ProductEditor';
import { PublicationDialog } from './PublicationDialog';
import { ModalDialog } from '../../common/ModalDialog';
import { BUTTON, INPUT, PUBLICATION_LABELS } from './product-form';

export function CatalogManager() {
  const { user, isAuthReady } = useAuth();
  const router = useRouter();
  const enabled = isAuthReady && ['ADMIN', 'WORKSHOP_OPERATOR'].includes(user?.role ?? '');
  const canPublish = user?.role === 'ADMIN';
  const canManageCategories = user?.role === 'ADMIN';
  const list = usePaginatedList<AdminProduct>('/api/admin/products', enabled, user?.id);
  const [categories, setCategories] = useState<CatalogCategoryOption[]>([]);
  const [categoryError, setCategoryError] = useState('');
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryActionError, setCategoryActionError] = useState('');
  const [categoryRevision, setCategoryRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ product: AdminProduct | null } | null>(null);
  const [publication, setPublication] = useState<{
    product: AdminProduct;
    action: PublicationInput['action'];
  } | null>(null);
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const actionLock = useRef(false);
  const categoryLock = useRef(false);
  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) router.replace('/dang-nhap');
    else if (!['ADMIN', 'WORKSHOP_OPERATOR'].includes(user.role))
      router.replace(user.role === 'CUSTOMER' ? '/tai-khoan' : '/admin');
  }, [isAuthReady, user, router]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/admin/catalog/categories', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body: ApiResponse<CatalogCategoryOption[]> = await response.json();
        if (!response.ok || !body.success) throw new Error('Không thể tải danh mục.');
        if (!controller.signal.aborted) {
          setCategories(body.data);
          setCategoryError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategoryError('Chưa thể tải danh mục. Hãy thử tải lại.');
      });
    return () => controller.abort();
  }, [enabled, categoryRevision]);
  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageCategories || categoryLock.current) return;
    categoryLock.current = true;
    setCategorySaving(true);
    setCategoryActionError('');
    try {
      const response = await fetch('/api/admin/catalog/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName, description: categoryDescription }),
      });
      const body: ApiResponse<CatalogCategoryOption> = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.success ? 'Không thể tạo danh mục.' : body.error);
      setCategories((current) => [...current, body.data]);
      setCategoryName('');
      setCategoryDescription('');
      setCategoryFormOpen(false);
      setNotice(`Đã tạo danh mục “${body.data.name}”. Danh mục đã có trong lựa chọn sản phẩm.`);
    } catch (cause) {
      setCategoryActionError(cause instanceof Error ? cause.message : 'Không thể tạo danh mục.');
    } finally {
      categoryLock.current = false;
      setCategorySaving(false);
    }
  }
  async function changePublication(input: PublicationInput) {
    if (!publication || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setActionError('');
    try {
      const response = await fetch(`/api/admin/products/${publication.product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body: ApiResponse<AdminProduct> = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.success ? 'Không thể cập nhật trạng thái.' : body.error);
      setNotice(`${body.data.code}: ${PUBLICATION_LABELS[body.data.publication]}.`);
      setPublication(null);
      list.reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái.');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function deleteProduct(product: AdminProduct) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setActionError('');
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
      const body: ApiResponse<{ id: string; code: string }> = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.success ? 'Không thể xóa sản phẩm.' : body.error);
      setNotice(`${body.data.code}: đã xóa sản phẩm.`);
      setDeleting(null);
      list.reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không thể xóa sản phẩm.');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  if (!enabled)
    return (
      <div role="status" className="mx-auto max-w-6xl px-4 py-16 text-sm text-[#A5ADB8]">
        Đang xác thực quyền quản trị…
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-[#F4F1EA] sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Quản lý sản phẩm</h1>
          <p className="max-w-2xl text-sm leading-6 text-[#A5ADB8]">
            Nhân viên có thể nhập sản phẩm, ảnh, giá, mã biến thể và định mức thành bản nháp. Quản trị viên
            duyệt trước khi sản phẩm được mở bán.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageCategories && (
            <button
              type="button"
              className={BUTTON}
              aria-expanded={categoryFormOpen}
              aria-controls="catalog-category-form"
              onClick={() => {
                setCategoryFormOpen((open) => !open);
                setCategoryActionError('');
              }}
            >
              {categoryFormOpen ? 'Đóng form danh mục' : 'Tạo danh mục'}
            </button>
          )}
          <Link className={BUTTON} href="/admin">
            Về cổng xưởng
          </Link>
        </div>
      </header>
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-[#6F9576]/40 p-3 text-sm text-[#B4D1BA]"
        >
          {notice}
        </p>
      )}
      {categoryError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[#FF8179]">
          {categoryError}
          <button
            className={BUTTON}
            type="button"
            onClick={() => setCategoryRevision((value) => value + 1)}
          >
            Tải lại danh mục
          </button>
        </div>
      )}
      {categoryFormOpen && canManageCategories && (
        <section
          id="catalog-category-form"
          aria-labelledby="catalog-category-heading"
          className="space-y-4 rounded-xl border border-[#27313C] bg-[#111216] p-4 sm:p-5"
        >
          <div>
            <h2 id="catalog-category-heading" className="text-lg font-semibold">
              Tạo danh mục sản phẩm
            </h2>
            <p className="mt-1 text-sm text-[#A5ADB8]">
              Đường dẫn danh mục được tạo tự động từ tên. Sau khi lưu, danh mục sẽ xuất hiện trong
              lựa chọn khi thêm hoặc sửa sản phẩm.
            </p>
          </div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void createCategory(event)}>
            <label className="space-y-1 text-sm">
              Tên danh mục <span className="text-[#FF8179]">*</span>
              <input
                className={INPUT}
                value={categoryName}
                maxLength={120}
                required
                autoComplete="off"
                placeholder="Ví dụ: Art Toy, Mô hình phòng lab"
                onChange={(event) => setCategoryName(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              Mô tả <span className="text-[#A5ADB8]">(không bắt buộc)</span>
              <textarea
                className={`${INPUT} min-h-11 resize-y`}
                value={categoryDescription}
                maxLength={2000}
                rows={2}
                onChange={(event) => setCategoryDescription(event.target.value)}
              />
            </label>
            {categoryActionError && (
              <p role="alert" className="text-sm text-[#FF8179] sm:col-span-2">
                {categoryActionError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                className={BUTTON}
                disabled={categorySaving}
                onClick={() => {
                  setCategoryFormOpen(false);
                  setCategoryActionError('');
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={`${BUTTON} border-admin-accent bg-admin-accent font-semibold text-[#0B0B0E]`}
                disabled={categorySaving || !categoryName.trim()}
              >
                {categorySaving ? 'Đang lưu…' : 'Lưu danh mục'}
              </button>
            </div>
          </form>
        </section>
      )}
      {!categories.length && !categoryError && (
        <p className="text-sm text-[#A5ADB8]">
          {canManageCategories
            ? 'Chưa có danh mục. Tạo danh mục trước khi thêm sản phẩm.'
            : 'Chưa có danh mục để chọn. Hãy nhờ quản trị viên tạo danh mục.'}
        </p>
      )}
      {editor ? (
        <ProductEditor
          product={editor.product}
          categories={categories}
          onCancel={() => setEditor(null)}
          onRequestPublication={canPublish ? (product) => {
            setActionError('');
            setEditor(null);
            setPublication({ product, action: 'PUBLISH' });
          } : undefined}
          onSaved={(product, options) => {
            setNotice(`Đã lưu ${product.code} thành bản nháp. Hoàn tất định mức linh kiện cho từng biến thể; quản trị viên sẽ duyệt trước khi mở bán.`);
            setEditor(options?.keepOpen ? { product } : null);
            list.reload();
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <form
              className="flex flex-1 flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                list.setSearch(search.trim());
              }}
            >
              <label className="min-w-0 flex-1 space-y-1 text-sm">
                Tìm theo tên hoặc mã
                <input
                  className={INPUT}
                  value={search}
                  maxLength={120}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button type="submit" className={BUTTON}>
                Tìm kiếm
              </button>
              <label className="space-y-1 text-sm">
                Trạng thái
                <select
                  className={INPUT}
                  value={list.status}
                  onChange={(event) => list.setFilter(event.target.value)}
                >
                  <option value="ALL">Tất cả</option>
                  {Object.entries(PUBLICATION_LABELS).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </form>
            <button
              type="button"
              className={`${BUTTON} bg-[#EB4037]`}
              disabled={!categories.length || Boolean(categoryError)}
              onClick={() => {
                setNotice('');
                setEditor({ product: null });
              }}
            >
              Thêm sản phẩm
            </button>
          </div>
          {list.error && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[#FF8179]">
              {list.error}
              <button type="button" className={BUTTON} onClick={list.reload}>
                Tải lại
              </button>
            </div>
          )}
          {list.isLoading ? (
            <p role="status" className="py-12 text-sm text-[#A5ADB8]">
              Đang tải sản phẩm…
            </p>
          ) : list.data.length === 0 ? (
            <p role="status" className="py-12 text-sm text-[#A5ADB8]">
              Không có sản phẩm khớp với bộ lọc.
            </p>
          ) : (
            <ul className="divide-y divide-[#27313C] rounded-xl border border-[#27313C] bg-[#111216] px-4 sm:px-6">
              {list.data.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div className="min-w-0 flex-1 basis-64 space-y-2">
                    <p className="break-words text-base font-semibold">{product.name}</p>
                    <p className="break-all font-mono text-xs text-admin-secondary">{product.code}</p>
                    <p className="text-sm text-[#A5ADB8]">
                      {PUBLICATION_LABELS[product.publication]} ·{' '}
                      {product.variants.filter((variant) => variant.status === 'ACTIVE').length}{' '}
                      biến thể đang bán
                    </p>
                    <p className="text-sm text-[#A5ADB8]">
                      {product.variants
                        .filter((variant) => variant.status !== 'INACTIVE')
                        .map((variant) => `${variant.name}: ${formatVND(variant.price)}`)
                        .join(' · ')}
                    </p>
                    {!canPublish && product.publication !== 'PUBLISHED' && (
                      <p className="text-xs text-[#C8A261]">Bản nháp chờ quản trị viên duyệt mở bán.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={BUTTON}
                      disabled={!categories.length}
                      onClick={() => {
                        setNotice('');
                        setEditor({ product });
                      }}
                    >
                      Sửa <span className="sr-only">{product.code}</span>
                    </button>
                    {canPublish && (product.publication === 'PUBLISHED'
                      ? (['HIDE', 'ARCHIVE'] as const)
                      : (['PUBLISH', 'ARCHIVE'] as const)
                    ).map((action) => (
                      <button
                        type="button"
                        className={BUTTON}
                        key={action}
                        disabled={product.publication === 'ARCHIVED' && action === 'ARCHIVE'}
                        onClick={() => {
                          setActionError('');
                          setPublication({ product, action });
                        }}
                      >
                        {{ PUBLISH: 'Duyệt & xuất bản', HIDE: 'Ẩn', ARCHIVE: 'Ngừng bán' }[action]}
                        <span className="sr-only"> {product.code}</span>
                      </button>
                    ))}
                    {canPublish && (
                      <button
                        type="button"
                        className={`${BUTTON} border-[#7C3937] text-[#FF8179] hover:border-[#FF8179]`}
                        onClick={() => {
                          setNotice('');
                          setActionError('');
                          setDeleting(product);
                        }}
                      >
                        Xóa <span className="sr-only">{product.code}</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ListPagination
            pagination={list.pagination}
            isLoading={list.isLoading}
            onPageChange={list.setPage}
          />
        </>
      )}
      {publication && (
        <PublicationDialog
          {...publication}
          busy={busy}
          error={actionError}
          onClose={() => setPublication(null)}
          onSubmit={(input) => void changePublication(input)}
        />
      )}
      {deleting && (
        <ModalDialog
          title="Xóa sản phẩm"
          onDismiss={() => {
            if (!busy) setDeleting(null);
          }}
          className="items-center p-4"
        >
          <section className="w-full max-w-lg space-y-5 rounded-xl border border-[#27313C] bg-[#141A21] p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Xóa sản phẩm?</h2>
            <p className="text-sm leading-6 text-[#A5ADB8]">
              <span className="font-mono text-[#F4F1EA]">{deleting.code}</span> · {deleting.name}
            </p>
            <p className="text-sm leading-6 text-[#A5ADB8]">
              Chỉ xóa được sản phẩm chưa được dùng trong giỏ hàng, đơn hàng, định mức sản xuất hoặc
              lịch sử tồn kho. Nếu đã được sử dụng, hãy chọn “Ngừng bán” để giữ lịch sử. Ảnh sẽ được
              gỡ khỏi sản phẩm; tệp ảnh lưu trữ không bị xóa.
            </p>
            {actionError && (
              <p role="alert" className="text-sm text-[#FF8179]">
                {actionError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className={BUTTON} disabled={busy} onClick={() => setDeleting(null)}>
                Hủy
              </button>
              <button
                type="button"
                className={`${BUTTON} border-[#EB4037] bg-[#EB4037] text-white`}
                disabled={busy}
                onClick={() => void deleteProduct(deleting)}
              >
                {busy ? 'Đang xóa…' : 'Xóa sản phẩm'}
              </button>
            </div>
          </section>
        </ModalDialog>
      )}
    </div>
  );
}
