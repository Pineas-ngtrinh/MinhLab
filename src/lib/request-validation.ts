import { AppError } from './errors';
import type { CreateOrderInput } from '../contracts/orders';

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) {
    throw new AppError('Yêu cầu cần chứa dữ liệu JSON.');
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 64 * 1024) {
        await reader.cancel();
        throw new AppError('Dữ liệu yêu cầu quá lớn.');
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    try {
      return JSON.parse(body + decoder.decode()) as unknown;
    } catch {
      throw new AppError('Dữ liệu JSON không hợp lệ.');
    }
  } finally { reader.releaseLock(); }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function textField(value: unknown, label: string, max: number, required = true): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) {
    throw new AppError(`${label} không hợp lệ hoặc vượt quá ${max} ký tự.`);
  }
  return value.trim();
}

export function parseOrderInput(value: unknown): CreateOrderInput {
  if (!isRecord(value)) throw new AppError('Thông tin đặt hàng không hợp lệ.');
  const customerEmail = textField(value.customerEmail, 'Email', 255);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new AppError('Email không hợp lệ.');
  const customerPhone = textField(value.customerPhone, 'Số điện thoại', 20);
  if (!/^\+?[0-9 ()-]{8,20}$/.test(customerPhone)) throw new AppError('Số điện thoại không hợp lệ.');
  if (value.paymentMethod !== 'VIETQR') throw new AppError('Hiện chỉ hỗ trợ thanh toán bằng QR cá nhân VietQR.');
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) throw new AppError('Đơn hàng cần có từ 1 đến 50 mục sản phẩm.');
  return {
    customerName: textField(value.customerName, 'Họ tên', 120), customerEmail, customerPhone,
    shippingAddress: textField(value.shippingAddress, 'Địa chỉ', 255),
    customerNote: textField(value.customerNote, 'Ghi chú', 2000, false),
    paymentMethod: value.paymentMethod,
    items: value.items.map((item: unknown) => {
      if (!isRecord(item) || (item.itemType !== 'READY_PRODUCT' && item.itemType !== 'CUSTOM_PRINT')) throw new AppError('Mục sản phẩm không hợp lệ.');
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) throw new AppError('Số lượng phải từ 1 đến 100.');
      const printSpecificationId = textField(item.printSpecificationId, 'Mã thông số', 36, false) || undefined;
      const productVariantId = textField(item.productVariantId, 'Mã biến thể', 36, false) || undefined;
      if (productVariantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productVariantId)) {
        throw new AppError('Mã biến thể sản phẩm không hợp lệ.');
      }
      if (printSpecificationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(printSpecificationId)) {
        throw new AppError('Mã thông số kỹ thuật không hợp lệ.');
      }
      return {
        itemType: item.itemType, quantity: item.quantity,
        itemName: textField(item.itemName, 'Tên sản phẩm', 200),
        productId: textField(item.productId, 'Mã sản phẩm', 220, false) || undefined,
        printSpecificationId,
        productVariantId,
        color: textField(item.color, 'Màu sắc', 60, false) || undefined,
        material: textField(item.material, 'Vật liệu', 160, false) || undefined,
        // The service reads the authoritative price from PostgreSQL.
        unitPrice: 0,
      };
    }),
  };
}
