export type RoleCode = 'CUSTOMER' | 'WORKSHOP_OPERATOR' | 'FILE_REVIEWER' | 'PRINT_OPERATOR' | 'ADMIN';

export const ROLE_PRIORITY = ['ADMIN', 'WORKSHOP_OPERATOR', 'FILE_REVIEWER', 'PRINT_OPERATOR', 'CUSTOMER'] as const;

export interface RoleInfo {
  code: RoleCode;
  name: string;
  description: string;
  badgeColor: string;
}

export const ROLES: Record<RoleCode, RoleInfo> = {
  ADMIN: {
    code: 'ADMIN',
    name: 'Quản Trị Viên Toàn Hệ Thống',
    description: 'Quản lý đơn hàng, đối soát thanh toán, bàn giao vận chuyển, cấu hình và phân quyền nhân sự.',
    badgeColor: '#EB4037',
  },
  WORKSHOP_OPERATOR: {
    code: 'WORKSHOP_OPERATOR',
    name: 'Nhân viên vận hành xưởng',
    description: 'Nhập sản phẩm và định mức nháp, duyệt kế hoạch, xác nhận mẻ in và QC; không quản lý thanh toán hay công bố sản phẩm.',
    badgeColor: '#C8A261',
  },
  FILE_REVIEWER: {
    code: 'FILE_REVIEWER',
    name: 'Kỹ Sư Thẩm Định 3D',
    description: 'Soi lỗi hở mesh STL, tối ưu góc in slicer, tính toán nhựa và phát hành báo giá.',
    badgeColor: '#3B82F6',
  },
  PRINT_OPERATOR: {
    code: 'PRINT_OPERATOR',
    name: 'Kỹ Thuật Viên Máy In FDM',
    description: 'Giám sát cụm máy in, thay cuộn filament, theo dõi nhiệt độ đùn và cập nhật tiến độ chế tác.',
    badgeColor: '#8B5CF6',
  },
  CUSTOMER: {
    code: 'CUSTOMER',
    name: 'Khách Hàng Thành Viên',
    description: 'Mua sắm Art Toy độc bản, gửi tệp in 3D cá nhân, theo dõi lịch sử đơn và tiến độ xưởng.',
    badgeColor: '#6F9576',
  },
};

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLES, value);
}
