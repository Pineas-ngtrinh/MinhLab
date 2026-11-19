import test from 'node:test';
import assert from 'node:assert/strict';
import type { QueryResult, QueryResultRow } from 'pg';
import { PostgresTeamManagementRepository } from '../team-management.repository';

test('account projection retains inactive assignments for conflict checks but uses active roles for permissions', async () => {
  const queries: { text: string; values?: unknown[] }[] = [];
  const database = {
    async query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>> {
      queries.push({ text, values });
      const rows = text.includes('count(*)') ? [{ total: '1' }] : [{
        id: 'fixture', email: 'roles@example.test', full_name: 'Synthetic', status: 'ACTIVE', email_verified_at: null,
        role_codes: ['ADMIN', 'CUSTOMER'], active_role_codes: ['CUSTOMER'], password_hash: 'must-not-escape',
      }];
      return { rows: rows as unknown as Row[], rowCount: 1, command: 'SELECT', fields: [], oid: 0 };
    },
  };
  const repository = new PostgresTeamManagementRepository(database);
  const page = await repository.listAccounts({ page: 2, pageSize: 25, search: "' OR 1=1--" });
  assert.deepEqual(page.data[0].roles, ['ADMIN', 'CUSTOMER']);
  assert.equal(page.data[0].effectiveRole, 'CUSTOMER');
  assert.equal('password_hash' in page.data[0], false);
  assert(queries.every(query => !query.text.includes("' OR 1=1--")));
  assert.deepEqual(queries[1].values, ["' OR 1=1--", 25, 25]);
});
