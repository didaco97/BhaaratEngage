import type { DashboardRepository } from "../../repositories/backend-repositories.js";

export class DashboardService {
  public constructor(private readonly repository: DashboardRepository) {}

  public getSnapshot() {
    return this.repository.getSnapshot();
  }
}
