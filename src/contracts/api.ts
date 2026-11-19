export type ApiResponse<T> = {
  success: true;
  data: T;
  message?: string;
  error?: never;
} | {
  success: false;
  error: string;
  data?: never;
  message?: string;
};
