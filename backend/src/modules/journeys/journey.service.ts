import { AppError } from "../../lib/http-errors.js";
import type { JourneyRepository } from "../../repositories/backend-repositories.js";

export class JourneyService {
  public constructor(private readonly repository: JourneyRepository) {}

  public list() {
    return this.repository.list();
  }

  public async getById(id: string) {
    const journey = await this.repository.getById(id);

    if (!journey) {
      throw new AppError(404, "journey_not_found", `Journey ${id} was not found.`);
    }

    return journey;
  }
}
