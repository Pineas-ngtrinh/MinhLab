import type { ApiResponse } from '../contracts/api';

/** Reverse proxies can return HTML; never expose their parser errors in a customer form. */
export async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (response.status === 413) throw new Error('Tệp vượt giới hạn tải lên của máy chủ. Hãy giảm dung lượng hoặc liên hệ xưởng để gửi file lớn.');
  if (response.status === 429) throw new Error('Bạn gửi yêu cầu quá nhanh. Vui lòng chờ một lúc rồi thử lại.');
  let value: unknown;
  try { value = await response.json(); }
  catch { throw new Error(response.status >= 500 ? 'Máy chủ đang bận hoặc hết thời gian nhận tệp. Vui lòng thử lại sau.' : 'Máy chủ chưa trả về kết quả hợp lệ. Vui lòng tải lại trang và thử lại.'); }
  if (!value || typeof value !== 'object' || !('success' in value) || typeof value.success !== 'boolean') throw new Error('Phản hồi máy chủ chưa hợp lệ. Vui lòng thử lại sau.');
  return value as ApiResponse<T>;
}
