import type {
  AdminProduct,
  ProductInput,
  PublicationInput,
  CatalogListOptions,
  AdminCatalogPage,
  CatalogCategoryOption,
} from '../../contracts/catalog-admin';

export interface CatalogWriter {
  get(id: string): Promise<AdminProduct | null>;
  categoryExists(id: string): Promise<boolean>;
  nextCode(): Promise<string>;
  save(
    input: ProductInput,
    actorId: string,
    current: AdminProduct | null,
    code: string,
    slug: string,
  ): Promise<string>;
  publish(current: AdminProduct, input: PublicationInput, actorId: string): Promise<void>;
  deleteProduct(id: string): Promise<CatalogDeleteBlocker[]>;
  audit(
    action: string,
    id: string,
    actorId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>;
}

export type CatalogDeleteBlocker = 'CART' | 'ORDER' | 'BOM' | 'STOCK';
export interface CatalogDependencies {
  get(id: string): Promise<AdminProduct | null>;
  list(options: CatalogListOptions): Promise<AdminCatalogPage>;
  categories(): Promise<CatalogCategoryOption[]>;
  transaction<T>(operation: (writer: CatalogWriter) => Promise<T>): Promise<T>;
}
