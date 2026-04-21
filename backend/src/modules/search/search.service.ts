import type { SearchRepository } from "../../repositories/backend-repositories.js";

export class SearchService {
  public constructor(private readonly repository: SearchRepository) {}

  public global(query: string) {
    return this.repository.global(query);
  }
}
