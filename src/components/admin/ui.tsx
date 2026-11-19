'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'border-admin-accent bg-admin-accent text-white hover:bg-admin-accent-hover',
    secondary: 'border-admin-border bg-admin-surface text-admin-text hover:bg-admin-subtle',
    quiet: 'border-transparent bg-transparent text-admin-secondary hover:bg-admin-subtle',
    danger: 'border-admin-danger-border bg-admin-danger-soft text-admin-danger hover:border-admin-danger',
  };
  return <button {...props} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent focus-visible:ring-offset-2 focus-visible:ring-offset-admin-surface disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} />;
}

export function Input({ label, error, hint, id, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; id: string }) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-admin-secondary">{label}</label>
      <input {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={descriptionId} className={`min-h-10 w-full rounded-md border border-admin-border bg-admin-surface px-3 text-base sm:text-sm text-admin-text placeholder:text-admin-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent disabled:bg-admin-subtle ${className}`} />
      {error && <p id={descriptionId} role="alert" className="text-xs text-admin-danger">{error}</p>}
      {!error && hint && <p id={descriptionId} className="text-xs text-admin-muted">{hint}</p>}
    </div>
  );
}

export function Select({ label, id, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-admin-secondary">{label}</label>
      <select {...props} id={id} className={`min-h-10 w-full min-w-0 rounded-md border border-admin-border bg-admin-surface px-3 text-base sm:text-sm text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent ${className}`}>{children}</select>
    </div>
  );
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'info' }) {
  const tones = {
    success: 'border-admin-success-border bg-admin-success-soft text-admin-success',
    warning: 'border-admin-warning-border bg-admin-warning-soft text-admin-warning',
    danger: 'border-admin-danger-border bg-admin-danger-soft text-admin-danger',
    neutral: 'border-admin-border bg-admin-subtle text-admin-secondary',
    accent: 'border-admin-accent-soft bg-admin-accent-soft text-admin-accent',
    info: 'border-admin-info-border bg-admin-info-soft text-admin-info',
  };
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export interface DataColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = '',
  emptyTitle = 'Không tìm thấy dữ liệu',
  emptyDescription = 'Hãy đổi bộ lọc hoặc từ khóa tìm kiếm.',
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortValue) return rows;
    return [...rows].sort((left, right) => {
      const a = column.sortValue?.(left) ?? '';
      const b = column.sortValue?.(right) ?? '';
      const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [columns, rows, sort]);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-admin-border bg-admin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent" tabIndex={0} aria-label="Bảng dữ liệu, có thể cuộn ngang">
      <table aria-busy={loading} className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="border-b border-admin-border bg-admin-subtle text-xs font-medium text-admin-secondary">
          <tr>{columns.map((column) => (
            <th key={column.key} scope="col" aria-sort={sort?.key === column.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : undefined} className={`h-11 whitespace-nowrap px-4 ${column.className ?? ''}`}>
              {column.sortValue ? (
                <button type="button" onClick={() => setSort((current) => ({ key: column.key, direction: current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent">
                  {column.label}
                  {sort?.key === column.key ? sort.direction === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-admin-muted" />}
                </button>
              ) : column.label}
            </th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-admin-border">
          {error ? <tr><td colSpan={columns.length} className="p-0"><Toast tone="danger" message={error} /></td></tr>
              : loading ? <tr><td colSpan={columns.length} className="h-16 px-3 text-center text-admin-muted">Đang tải dữ liệu…</td></tr>
              : sortedRows.length === 0 ? <tr><td colSpan={columns.length} className="p-0"><EmptyState title={emptyTitle} description={emptyDescription} /></td></tr>
                : sortedRows.map((row) => <tr key={rowKey(row)} className="h-12 even:bg-admin-canvas hover:bg-admin-subtle focus-within:bg-admin-subtle">{columns.map((column) => <td key={column.key} className={`px-4 py-2 align-middle text-admin-text ${column.className ?? ''}`}>{column.render(row)}</td>)}</tr>)}
        </tbody>
      </table>
      <p className="border-t border-admin-border px-3 py-2 text-xs text-admin-muted sm:hidden">Vuốt ngang để xem thêm cột trong bảng.</p>
    </div>
  );
}

export function Dialog({ open, title, onClose, children, className = '' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
    return () => { if (node.open) node.close(); };
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onCloseRef.current(); }} className={`max-h-[calc(100dvh-2rem)] w-[min(640px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-admin-border bg-admin-surface p-0 text-admin-text shadow-xl backdrop:bg-black/30 ${className}`}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-admin-border bg-admin-surface px-4 py-3">
        <h2 id={titleId} className="min-w-0 text-sm font-semibold">{title}</h2>
        <Button variant="quiet" onClick={onClose} aria-label="Đóng hộp thoại" className="h-11 w-11 shrink-0 px-2"><X aria-hidden="true" className="h-4 w-4" /></Button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}

export function Toast({ tone = 'neutral', message }: { tone?: 'success' | 'warning' | 'danger' | 'neutral'; message: string }) {
  const role = tone === 'danger' ? 'alert' : 'status';
  const styles = {
    success: 'border-admin-success-border bg-admin-success-soft text-admin-success',
    warning: 'border-admin-warning-border bg-admin-warning-soft text-admin-warning',
    danger: 'border-admin-danger-border bg-admin-danger-soft text-admin-danger',
    neutral: 'border-admin-border bg-admin-subtle text-admin-secondary',
  };
  return <p role={role} className={`rounded-md border px-3 py-2 text-sm ${styles[tone]}`}>{message}</p>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex min-h-28 flex-col items-center justify-center px-4 py-7 text-center">
    <p className="text-sm font-medium text-admin-text">{title}</p>
    {description && <p className="mt-1 max-w-sm text-xs text-admin-muted">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>;
}
