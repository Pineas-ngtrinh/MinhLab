import { catalogRepository } from '../repositories/catalog/catalog-read.repository';
import {
  catalogAdminRepository,
  PostgresCatalogWriter,
} from '../repositories/catalog/catalog-write.repository';
import { withTransaction } from '../lib/db';
import { createCatalogManagement } from '../services/catalog/catalog-management.service';
import { createCatalogCategoryService } from '../services/catalog/catalog-category.service';
import {
  parseProductInput,
  parsePublicationInput,
  parseCatalogCategoryInput,
  revisionField,
  uuidField,
} from '../lib/catalog-validation';

const management = createCatalogManagement({
  ...catalogAdminRepository,
  transaction: (operation) =>
    withTransaction((client) => operation(new PostgresCatalogWriter(client))),
});
const createCategory = createCatalogCategoryService({
  transaction: (operation) =>
    withTransaction((client) => operation(new PostgresCatalogWriter(client))),
});

export const CatalogManagement = {
  list: management.list,
  categories: management.categories,
  createCategory: (input: unknown, actorId: string) =>
    createCategory(parseCatalogCategoryInput(input), actorId),
  get: (id: string) => management.get(uuidField(id)),
  create: (input: unknown, actorId: string) => management.save(parseProductInput(input), actorId),
  update: (id: string, input: unknown, revision: unknown, actorId: string, allowNonDraftEdit: boolean) =>
    management.save(parseProductInput(input), actorId, {
      id: uuidField(id),
      revision: revisionField(revision),
    }, allowNonDraftEdit),
  publish: (id: string, input: unknown, actorId: string) =>
    management.publish(uuidField(id), parsePublicationInput(input), actorId),
  delete: (id: string, actorId: string) => management.delete(uuidField(id), actorId),
};

export const CatalogService = {
  getStorefront: () => catalogRepository.read(process.env.NODE_ENV === 'production'),
};
