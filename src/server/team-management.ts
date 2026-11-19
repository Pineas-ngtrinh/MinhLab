import { withTransaction } from '../lib/db';
import { PostgresTeamManagementRepository } from '../repositories/auth/team-management.repository';
import { createTeamManagementService } from '../services/auth/team-management.service';
import { requiresEmailVerification } from './auth-config';

const service = createTeamManagementService({
  requireVerifiedEmail: requiresEmailVerification,
  transaction: operation => withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('minhlab-team-role-management-v1'))");
    return operation(new PostgresTeamManagementRepository(client));
  }),
});

export const TeamManagement = service;
