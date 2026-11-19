import { AppError } from '../lib/errors';
import type { CloudinaryImageConfig } from '../integrations/media/cloudinary-images';

export function cloudinaryImageConfig(environment: NodeJS.ProcessEnv = process.env): CloudinaryImageConfig {
  const cloudName = environment.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = environment.CLOUDINARY_API_KEY?.trim();
  const apiSecret = environment.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError('Dịch vụ lưu ảnh Cloudinary chưa được cấu hình.', 503);
  }
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(cloudName) || !/^[A-Za-z0-9_-]{1,100}$/.test(apiKey) || apiSecret.length < 16) {
    throw new AppError('Cấu hình lưu ảnh Cloudinary không hợp lệ.', 503);
  }
  return { cloudName, apiKey, apiSecret };
}
