import { AppError } from '../../lib/errors';
import { catalogSlug, publicationProblems } from '../../domain/catalog/catalog-policy';
import type { ProductInput, PublicationInput } from '../../contracts/catalog-admin';
import type { CatalogDependencies } from './catalog.ports';

function assertVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw new AppError('Sản phẩm đã được thay đổi ở nơi khác. Hãy tải lại trước khi lưu.', 409);
}
export function createCatalogManagement(dependencies: CatalogDependencies) {
  return {
    list: dependencies.list,
    categories: dependencies.categories,
    async get(id: string) {
      const product = await dependencies.get(id);
      if (!product) throw new AppError('Không tìm thấy sản phẩm.', 404);
      return product;
    },
    async save(input: ProductInput, actorId: string, existing?: { id: string; revision: number }, allowNonDraftEdit = true) {
      return dependencies.transaction(async (writer) => {
        const current = existing ? await writer.get(existing.id) : null;
        if (existing && !current) throw new AppError('Không tìm thấy sản phẩm.', 404);
        if (current && !allowNonDraftEdit && current.publication !== 'DRAFT')
          throw new AppError('Chỉ quản trị viên được sửa sản phẩm đã duyệt, ẩn hoặc ngừng bán.', 403);
        if (current && existing) assertVersion(current.revision, existing.revision);
        if (!current && input.variants.some((variant) => variant.id))
          throw new AppError('Sản phẩm mới không được dùng mã biến thể đã có.');
        if (
          current &&
          input.variants.some(
            (variant) => variant.id && !current.variants.some((old) => old.id === variant.id),
          )
        ) {
          throw new AppError('Biến thể không thuộc sản phẩm này.');
        }
        if (!(await writer.categoryExists(input.categoryId)))
          throw new AppError('Danh mục không tồn tại.');
        const code = current?.code ?? (await writer.nextCode());
        const id = await writer.save(
          input,
          actorId,
          current,
          code,
          current?.slug ?? catalogSlug(input.name, code),
        );
        const after = await writer.get(id);
        await writer.audit(
          current ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
          id,
          actorId,
          current,
          after,
        );
        return after!;
      });
    },
    async publish(id: string, input: PublicationInput, actorId: string) {
      return dependencies.transaction(async (writer) => {
        const current = await writer.get(id);
        if (!current) throw new AppError('Không tìm thấy sản phẩm.', 404);
        assertVersion(current.revision, input.revision);
        if (input.action === 'PUBLISH') {
          if (!input.rightsConfirmed)
            throw new AppError('Cần xác nhận đã kiểm tra nguồn gốc và quyền sử dụng mẫu.');
          const problems = publicationProblems(current);
          if (problems.length) throw new AppError(problems.join(' '));
        }
        await writer.publish(current, input, actorId);
        const after = await writer.get(id);
        await writer.audit(`PRODUCT_${input.action}`, id, actorId, current, {
          ...after,
          reviewNote: input.note,
        });
        return after!;
      });
    },
    async delete(id: string, actorId: string) {
      return dependencies.transaction(async (writer) => {
        const current = await writer.get(id);
        if (!current) throw new AppError('Không tìm thấy sản phẩm.', 404);

        const blockers = await writer.deleteProduct(id);
        if (blockers.length) {
          const labels = {
            CART: 'giỏ hàng',
            ORDER: 'đơn hàng',
            BOM: 'định mức sản xuất (BOM)',
            STOCK: 'lịch sử tồn kho',
          };
          const references = blockers.map((blocker) => labels[blocker]).join(', ');
          throw new AppError(
            `Không thể xóa sản phẩm vì đang được tham chiếu trong ${references}. Hãy chọn “Ngừng bán” để giữ lịch sử.`,
            409,
          );
        }

        await writer.audit('PRODUCT_DELETED', current.id, actorId, current, { deleted: true });
        return { id: current.id, code: current.code };
      });
    },
  };
}
