/** Formal custom quotes have full quantities and explicit shipping; browser estimates have no authority. */
export function customQuoteProblems(input: {
    quantity: number;
    unitPrice: number;
    shipping: number;
    validUntil: string;
    promisedFinishAt: string;
    checksConfirmed: boolean;
}, now: string): string[] {
    const errors: string[] = [];
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100)
        errors.push('Số lượng phải từ 1 đến 100.');
    if (!Number.isInteger(input.unitPrice) || input.unitPrice < 1 || input.unitPrice > 999999999)
        errors.push('Đơn giá phải là số nguyên VND hợp lệ.');
    if (!Number.isInteger(input.shipping) || input.shipping < 0 || input.shipping > 999999999)
        errors.push('Phí giao hàng cần được xác nhận bằng số nguyên VND.');
    if (input.unitPrice * input.quantity + input.shipping > 999999999999)
        errors.push('Tổng báo giá vượt giới hạn.');
    if (Date.parse(input.validUntil) <= Date.parse(now) || !Number.isFinite(Date.parse(input.validUntil)))
        errors.push('Hạn báo giá phải ở tương lai.');
    if (Date.parse(input.promisedFinishAt) <= Date.parse(now) || !Number.isFinite(Date.parse(input.promisedFinishAt)))
        errors.push('Cần ngày hoàn thành dự kiến hợp lệ.');
    if (!input.checksConfirmed)
        errors.push('Cần xác nhận file, quy cách, vật tư, máy/profile và lịch xưởng.');
    return errors;
}
