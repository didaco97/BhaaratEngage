import { logger } from "../../lib/logger.js";
import type { AuditRepository, RecordAuditEventInput } from "../../repositories/backend-repositories.js";

export class AuditService {
  public constructor(private readonly repository: AuditRepository) {}

  public record(input: RecordAuditEventInput) {
    return this.repository.record(input);
  }

  public async recordIfPossible(input: RecordAuditEventInput) {
    try {
      await this.record(input);
    } catch (error: unknown) {
      logger.warn(
        {
          err: error,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
        },
        "Audit log write failed.",
      );
    }
  }
}

export function createAuditService(repository: AuditRepository) {
  return new AuditService(repository);
}
