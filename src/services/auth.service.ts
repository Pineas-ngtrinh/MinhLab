/**
 * =====================================================================
 * MINHLAB 3D - AUTHENTICATION & ACCESS CONTROL SERVICE
 * =====================================================================
 * Tuân thủ schema MinhLab_database_v2.dbml (Bảng users, roles, user_roles):
 * - 5 vai trò (roles): CUSTOMER, STAFF, FILE_REVIEWER, PRINT_OPERATOR, ADMIN.
 * - Hỗ trợ đăng ký khách hàng mới, đăng nhập bằng email/mật khẩu.
 * - Cung cấp sẵn các tài khoản demo xưởng để kiểm thử nhanh (One-Click Demo).
 * - Lưu trữ trong bộ nhớ toàn cục (globalThis) để giữ trạng thái liên tục.
 * =====================================================================
 */

export type RoleCode = 'CUSTOMER' | 'STAFF' | 'FILE_REVIEWER' | 'PRINT_OPERATOR' | 'ADMIN';

export interface UserRecord {
  id: string;
  email: string;
  email_normalized: string;
  phone?: string;
  password_hash: string;
  full_name: string;
  status: 'ACTIVE' | 'PENDING' | 'LOCKED' | 'DISABLED';
  role: RoleCode;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

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
    description: 'Toàn quyền cấu hình, phân quyền nhân sự và giám sát toàn bộ hoạt động xưởng.',
    badgeColor: '#EB4037', // Đỏ MinhLab
  },
  STAFF: {
    code: 'STAFF',
    name: 'Kế Toán & Vận Hành Đơn Hàng',
    description: 'Đối soát và xác nhận thanh toán VietQR (PENDING -> VERIFIED), quản lý đơn COD và đóng gói.',
    badgeColor: '#D97706', // Hổ phách
  },
  FILE_REVIEWER: {
    code: 'FILE_REVIEWER',
    name: 'Kỹ Sư Thẩm Định 3D',
    description: 'Soi lỗi hở mesh (.STL, .OBJ), tối ưu góc in slicer, tính toán nhựa và phát hành báo giá.',
    badgeColor: '#3B82F6', // Xanh kỹ thuật
  },
  PRINT_OPERATOR: {
    code: 'PRINT_OPERATOR',
    name: 'Kỹ Thuật Viên Máy In FDM',
    description: 'Giám sát cụm máy in, thay cuộn filament, theo dõi nhiệt độ đùn và cập nhật tiến độ chế tác.',
    badgeColor: '#8B5CF6', // Tím thợ in
  },
  CUSTOMER: {
    code: 'CUSTOMER',
    name: 'Khách Hàng Thành Viên',
    description: 'Mua sắm Art Toy độc bản, gửi tệp in 3D cá nhân, theo dõi lịch sử đơn và tiến độ xưởng.',
    badgeColor: '#6F9576', // Xanh lá hoàn tất
  },
};

// Lưu trữ người dùng trên globalThis để tránh bị wipe khi Next.js dev recompile
const globalForAuth = globalThis as unknown as {
  usersStore?: Map<string, UserRecord>;
};

function initializePreSeededUsers(): Map<string, UserRecord> {
  const map = new Map<string, UserRecord>();
  const now = new Date().toISOString();

  const seedUsers: UserRecord[] = [
    {
      id: 'usr-admin-01',
      email: 'admin@minhlab.com',
      email_normalized: 'admin@minhlab.com',
      phone: '0908888999',
      password_hash: 'admin123',
      full_name: 'Minh Vũ (Xưởng Trưởng)',
      status: 'ACTIVE',
      role: 'ADMIN',
      avatar_url: '/images/minhlab-mascot-free-v2.png',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'usr-staff-01',
      email: 'staff@minhlab.com',
      email_normalized: 'staff@minhlab.com',
      phone: '0912345678',
      password_hash: 'staff123',
      full_name: 'Thu Hằng (Kế Toán & CSKH)',
      status: 'ACTIVE',
      role: 'STAFF',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'usr-reviewer-01',
      email: 'engineer@minhlab.com',
      email_normalized: 'engineer@minhlab.com',
      phone: '0933221100',
      password_hash: 'engineer123',
      full_name: 'Hoàng Nam (Kỹ Sư Mesh & Slicer)',
      status: 'ACTIVE',
      role: 'FILE_REVIEWER',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'usr-operator-01',
      email: 'operator@minhlab.com',
      email_normalized: 'operator@minhlab.com',
      phone: '0944556677',
      password_hash: 'operator123',
      full_name: 'Tuấn Kiệt (Kỹ Thuật Máy In FDM)',
      status: 'ACTIVE',
      role: 'PRINT_OPERATOR',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'usr-customer-01',
      email: 'customer@minhlab.com',
      email_normalized: 'customer@minhlab.com',
      phone: '0977889900',
      password_hash: 'customer123',
      full_name: 'Nguyễn Văn An (Nhà Sưu Tầm Art Toy)',
      status: 'ACTIVE',
      role: 'CUSTOMER',
      created_at: now,
      updated_at: now,
    },
  ];

  for (const user of seedUsers) {
    map.set(user.email_normalized, user);
  }
  return map;
}

const usersStore = globalForAuth.usersStore ?? initializePreSeededUsers();
globalForAuth.usersStore = usersStore;

export const AuthService = {
  /**
   * Đăng ký tài khoản khách hàng mới
   */
  async register(input: {
    email: string;
    fullName: string;
    phone?: string;
    password: string;
  }): Promise<UserRecord> {
    const emailNormalized = input.email.toLowerCase().trim();

    if (!emailNormalized || !input.fullName?.trim() || !input.password) {
      throw new Error('Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu.');
    }

    if (usersStore.has(emailNormalized)) {
      throw new Error('Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác.');
    }

    const now = new Date().toISOString();
    const newUser: UserRecord = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: input.email.trim(),
      email_normalized: emailNormalized,
      phone: input.phone?.trim(),
      password_hash: input.password, // Mật khẩu mẫu hoặc hash
      full_name: input.fullName.trim(),
      status: 'ACTIVE',
      role: 'CUSTOMER',
      created_at: now,
      updated_at: now,
    };

    usersStore.set(emailNormalized, newUser);
    return newUser;
  },

  /**
   * Đăng nhập xác thực tài khoản
   */
  async login(email: string, password: string): Promise<UserRecord> {
    const emailNormalized = email.toLowerCase().trim();
    const user = usersStore.get(emailNormalized);

    if (!user) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }

    if (user.password_hash !== password) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Tài khoản hiện đang bị khóa hoặc chưa kích hoạt.');
    }

    return user;
  },

  /**
   * Tìm người dùng theo email
   */
  getUserByEmail(email: string): UserRecord | undefined {
    return usersStore.get(email.toLowerCase().trim());
  },

  /**
   * Lấy danh sách tài khoản demo xưởng để hỗ trợ đăng nhập 1-click
   */
  getDemoAccounts(): UserRecord[] {
    return Array.from(usersStore.values()).slice(0, 5);
  },

  /**
   * Lấy toàn bộ người dùng (dành cho Admin)
   */
  getAllUsers(): UserRecord[] {
    return Array.from(usersStore.values());
  },
};
