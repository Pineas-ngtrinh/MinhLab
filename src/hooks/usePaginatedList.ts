'use client';

import { useEffect, useState } from 'react';
import type { PageInfo } from '../contracts/pagination';

export interface PaginatedList<T, Summary = unknown> {
  data: T[];
  pagination: PageInfo;
  status: string;
  search: string;
  isLoading: boolean;
  error: string;
  summary?: Summary;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  setFilter: (status: string) => void;
  reload: () => void;
}

export function usePaginatedList<T, Summary = unknown>(
  endpoint: string,
  enabled: boolean,
  scope = '',
): PaginatedList<T, Summary> {
  const [query, setQuery] = useState({ page: 1, status: 'ALL', search: '', revision: 0 });
  const [result, setResult] = useState<{
    key: string;
    data: T[];
    pagination: PageInfo;
    error: string;
    summary?: Summary;
  } | null>(null);
  const key = `${endpoint}:${query.page}:${query.status}:${query.revision}:${query.search}:${enabled}:${scope}`;
  const empty: PageInfo = { page: query.page, pageSize: 25, total: 0, totalPages: 1 };

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.status !== 'ALL') params.set('status', query.status);
    if (query.search) params.set('q', query.search);
    const pagination: PageInfo = { page: query.page, pageSize: 25, total: 0, totalPages: 1 };
    fetch(`${endpoint}?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body: {
          success?: boolean;
          data?: T[];
          pagination?: PageInfo;
          error?: string;
          summary?: Summary;
        } = await response.json();
        if (!response.ok || !body.success || !Array.isArray(body.data) || !body.pagination) {
          throw new Error(body.error || 'Không thể tải dữ liệu. Vui lòng thử lại.');
        }
        if (!controller.signal.aborted) {
          if (query.page > body.pagination.totalPages) {
            setQuery((previous) => ({ ...previous, page: body.pagination!.totalPages }));
            return;
          }
          setResult({
            key,
            data: body.data,
            pagination: body.pagination,
            error: '',
            summary: body.summary,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            data: [],
            pagination,
            error:
              error instanceof TypeError ? 'Không thể kết nối máy chủ. Hãy kiểm tra mạng rồi thử lại.' : error instanceof Error ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.',
          });
      });
    return () => controller.abort();
  }, [endpoint, enabled, key, query.page, query.status, query.search]);

  const current = enabled && result?.key === key ? result : null;
  return {
    data: current?.data ?? [],
    pagination: current?.pagination ?? empty,
    summary: current?.summary,
    search: query.search,
    setSearch: (search) => setQuery((previous) => ({ ...previous, search, page: 1 })),
    status: query.status,
    isLoading: enabled && current === null,
    error: current?.error ?? '',
    setPage: (page) => setQuery((previous) => ({ ...previous, page })),
    setFilter: (status) => setQuery((previous) => ({ ...previous, status, page: 1 })),
    reload: () => setQuery((previous) => ({ ...previous, revision: previous.revision + 1 })),
  };
}
