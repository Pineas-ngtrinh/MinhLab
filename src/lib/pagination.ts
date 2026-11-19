import { AppError } from './errors';

import type { PageOptions, PageInfo } from '../contracts/pagination';
export type { PageOptions, PageInfo } from '../contracts/pagination';

export function parsePageOptions(params: URLSearchParams, statuses: readonly string[]): PageOptions {
  const integer = (name: string, fallback: number, maximum: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(value) || value > maximum) {
      throw new AppError('Thông tin phân trang không hợp lệ.');
    }
    return value;
  };
  const status = params.get('status') ?? undefined;
  if (status && !statuses.includes(status)) throw new AppError('Bộ lọc trạng thái không hợp lệ.');
  const search = params.get('q')?.trim() ?? '';
  if (search.length > 100) throw new AppError('Search text must be 100 characters or fewer.');
  return { page: integer('page', 1, 1_000_000), pageSize: integer('pageSize', 25, 100), status, ...(search ? { search } : {}) };
}

export function pageInfo(options: PageOptions, total: number): PageInfo {
  return { page: options.page, pageSize: options.pageSize, total, totalPages: Math.max(1, Math.ceil(total / options.pageSize)) };
}
