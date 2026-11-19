export interface PageOptions {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}
export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface PageResult<T> {
  data: T[];
  pagination: PageInfo;
}
