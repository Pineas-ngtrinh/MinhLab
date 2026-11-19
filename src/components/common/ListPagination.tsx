import type { PageInfo } from '../../contracts/pagination';

interface ListPaginationProps {
  pagination: PageInfo;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  variant?: 'default' | 'admin';
}

export function ListPagination({ pagination, isLoading, onPageChange, variant = 'default' }: ListPaginationProps) {
  const button = 'min-h-11 rounded-lg border border-[#27313C] px-4 text-sm text-[#F4F1EA] hover:border-[#C8A261] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261] disabled:cursor-not-allowed disabled:opacity-40';
  const adminButton = 'min-h-9 rounded-md border border-admin-border bg-admin-surface px-3 text-sm text-admin-text hover:bg-admin-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <nav aria-label={variant === 'admin' ? 'Phân trang bảng' : 'Phân trang danh sách'} className="flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className={`text-sm ${variant === 'admin' ? 'text-admin-muted' : 'text-[#A5ADB8]'}`}>
        {variant === 'admin'
          ? isLoading ? 'Đang tải kết quả…' : `Trang ${pagination.page} / ${pagination.totalPages} · ${pagination.total.toLocaleString('vi-VN')} kết quả`
          : isLoading ? 'Đang tải dữ liệu…' : `Trang ${pagination.page} / ${pagination.totalPages} · ${pagination.total} kết quả`}
      </p>
      <div className="flex gap-2">
        <button type="button" className={variant === 'admin' ? adminButton : button} disabled={isLoading || pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Trang trước</button>
        <button type="button" className={variant === 'admin' ? adminButton : button} disabled={isLoading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Trang sau</button>
      </div>
    </nav>
  );
}
