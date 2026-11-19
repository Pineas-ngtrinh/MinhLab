import Link from 'next/link';

interface CatalogNoticeProps {
  state: 'loading' | 'empty' | 'error';
}

export function CatalogNotice({state}: CatalogNoticeProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role={state === 'error' ? 'alert' : 'status'}>
      <p className="text-base text-[#F4F1EA]">
        {state === 'loading' ? 'Đang tải bộ sưu tập…' : state === 'error'
          ? 'Chưa thể tải bộ sưu tập.' : 'Xưởng đang cập nhật bộ sưu tập.'}
      </p>
      <p className="mt-2 text-sm text-[#A5ADB8]">
        {state === 'error' ? 'Bạn có thể tải lại trang hoặc quay lại sau.' : state === 'empty'
          ? 'Các mẫu sẵn sàng mở bán sẽ xuất hiện tại đây.' : 'Vui lòng chờ trong giây lát.'}
      </p>
      {state === 'error' && <Link href="/bo-suu-tap" prefetch={false}
        className="mt-5 inline-flex min-h-11 items-center text-sm text-[#C8A261] underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-[#C8A261]">
        Xem lại bộ sưu tập
      </Link>}
    </div>
  );
}
