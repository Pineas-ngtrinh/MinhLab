# Báo cáo cấu trúc từ code

Sinh bằng `npm run --silent architecture:report`. Chạy lại sau khi đổi code; đây là snapshot, không phải tài liệu quyết định.

Phạm vi: 186 file JS/TS trong app/, src/ và proxy.ts; 0 vi phạm guard.

Không quét test, declaration, CSS, asset, scripts hay docs. Quan hệ là import nội bộ tĩnh (kể cả dynamic import có đường dẫn literal), không phải call graph, HTTP hay luồng dữ liệu. Import type-only được giữ trong JSON và loại khỏi thống kê phụ thuộc runtime. File không có caller chưa chắc là mã thừa: Next.js, worker và entry point có thể tải chúng.

## Nhóm mã nguồn

| Nhóm | Số file |
| --- | ---: |
| app/api | 23 |
| app/pages | 17 |
| proxy.ts | 1 |
| src/components | 63 |
| src/config | 2 |
| src/context | 2 |
| src/contracts | 9 |
| src/domain | 5 |
| src/hooks | 4 |
| src/integrations | 7 |
| src/lib | 29 |
| src/repositories | 7 |
| src/server | 6 |
| src/services | 10 |
| src/workers | 1 |

## Quan hệ giữa các nhóm

| Nhóm import → nhóm được import | Số cặp file runtime |
| --- | ---: |
| app/api → src/contracts | 1 |
| app/api → src/domain | 2 |
| app/api → src/lib | 68 |
| app/api → src/server | 23 |
| app/pages → src/components | 17 |
| app/pages → src/context | 2 |
| app/pages → src/hooks | 1 |
| app/pages → src/lib | 2 |
| src/components → src/config | 12 |
| src/components → src/context | 15 |
| src/components → src/domain | 2 |
| src/components → src/hooks | 6 |
| src/components → src/lib | 28 |
| src/components → src/server | 1 |
| src/context → src/lib | 3 |
| src/integrations → src/config | 1 |
| src/integrations → src/lib | 1 |
| src/lib → src/config | 1 |
| src/lib → src/contracts | 1 |
| src/lib → src/domain | 2 |
| src/lib → src/server | 1 |
| src/repositories → src/domain | 2 |
| src/repositories → src/lib | 7 |
| src/server → src/integrations | 4 |
| src/server → src/lib | 6 |
| src/server → src/repositories | 5 |
| src/server → src/services | 5 |
| src/services → src/domain | 5 |
| src/services → src/lib | 6 |
| src/workers → src/lib | 1 |

## 10 file dài nhất cần đọc trước khi tách

| File | Số dòng |
| --- | ---: |
| src/components/lab-scrollytelling/LabScrollytelling.tsx | 788 |
| src/components/lab-journey/LabCanvas.tsx | 600 |
| src/lib/quote/stl/analyze.ts | 511 |
| src/components/products/ProductDetailModal.tsx | 420 |
| src/components/print-request/PrintConfigurationPanel.tsx | 395 |
| src/components/products/ProductGallery.tsx | 389 |
| src/components/print-request/usePrintRequest.ts | 375 |
| src/components/home/HomeFeaturedProducts.tsx | 374 |
| src/config/site.config.ts | 373 |
| src/components/checkout/useCheckout.ts | 330 |

Độ dài chỉ gợi ý nơi cần đọc, không chứng minh thiết kế sai. Camera spline và cơ chế tải 3D vẫn được bảo vệ theo AGENTS.md.

## 10 file có nhiều caller runtime nhất

| File | Số file import trực tiếp |
| --- | ---: |
| src/lib/api-response.ts | 21 |
| src/lib/errors.ts | 18 |
| src/lib/auth-session.ts | 16 |
| src/lib/format.ts | 16 |
| src/lib/request-validation.ts | 14 |
| src/config/site.config.ts | 12 |
| src/context/CartContext.tsx | 9 |
| src/lib/db.ts | 9 |
| src/server/orders.ts | 9 |
| src/context/AuthContext.tsx | 8 |

## Vi phạm guard

Không phát hiện vi phạm trong phạm vi guard.
