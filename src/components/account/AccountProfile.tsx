import { LogOut } from 'lucide-react';
import type { AuthUser } from '../../contracts/auth';

interface AccountProfileProps {
  user: AuthUser;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
  error: string;
}

export function AccountProfile({ user, onLogout, isLoggingOut, error }: AccountProfileProps) {
  return (
    <section aria-label="Thông tin tài khoản" className="space-y-3">
      <div className="p-6 sm:p-8 rounded-2xl bg-[#141A21] border border-[#27313C] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex min-w-0 items-center gap-4">
          <div aria-hidden="true" className="w-14 h-14 shrink-0 rounded-2xl bg-[#EB4037]/15 border border-[#EB4037]/30 flex items-center justify-center text-[#EB4037] font-bold text-xl font-mono">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-xl sm:text-2xl font-bold text-[#F4F1EA]">{user.fullName}</h1>
            <p className="break-words text-xs text-[#A5ADB8] font-mono">
              Email: {user.email} {user.phone && `· SĐT: ${user.phone}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={isLoggingOut}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[#27313C] bg-[#0F141A] px-4 text-xs font-mono text-[#A5ADB8] transition-colors hover:bg-[#1A222C] hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
          <span>{isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-[#FF8179]">{error}</p>}
    </section>
  );
}
