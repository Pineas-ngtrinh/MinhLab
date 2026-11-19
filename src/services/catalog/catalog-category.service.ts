import { AppError } from '../../lib/errors';
import { catalogCategorySlug } from '../../domain/catalog/catalog-policy';
import type { CatalogCategoryInput, CatalogCategoryOption } from '../../contracts/catalog-admin';

interface CatalogCategoryRepository {
  createCategory(input: {
    name: string;
    slug: string;
    description: string | null;
  }): Promise<CatalogCategoryOption | null>;
  auditCategory(category: CatalogCategoryOption, actorId: string, description: string | null): Promise<void>;
}

export function createCatalogCategoryService(dependencies: {
  transaction: <T>(operation: (repository: CatalogCategoryRepository) => Promise<T>) => Promise<T>;
}) {
  return async function createCategory(input: CatalogCategoryInput, actorId: string): Promise<CatalogCategoryOption> {
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    if (!name || name.length > 120) throw new AppError('Tên danh mục không hợp lệ.');
    if (description && description.length > 2000) throw new AppError('Mô tả danh mục vượt quá 2000 ký tự.');
    if (!actorId) throw new AppError('Không xác định được người tạo danh mục.', 403);

    return dependencies.transaction(async (repository) => {
      const category = await repository.createCategory({
        name,
        slug: catalogCategorySlug(name),
        description,
      });
      if (!category) throw new AppError('Danh mục cùng tên hoặc đường dẫn đã tồn tại.', 409);
      await repository.auditCategory(category, actorId, description);
      return category;
    });
  };
}
