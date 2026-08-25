import type {
  CategoryRecord,
  ProjectFilters,
  ProjectInput,
  ProjectRecord,
} from "../domain/project";

export interface CategoryRepository {
  list(ownerId: string): Promise<CategoryRecord[]>;
  create(ownerId: string, name: string): Promise<CategoryRecord>;
  update(
    ownerId: string,
    id: string,
    patch: { name?: string; isActive?: boolean },
  ): Promise<CategoryRecord | null>;
  delete(ownerId: string, id: string): Promise<"deleted" | "in-use" | "missing">;
}

export interface ProjectRepository {
  list(ownerId: string, filters?: ProjectFilters): Promise<ProjectRecord[]>;
  get(ownerId: string, id: string): Promise<ProjectRecord | null>;
  create(ownerId: string, input: ProjectInput): Promise<ProjectRecord>;
  update(
    ownerId: string,
    id: string,
    input: ProjectInput,
  ): Promise<ProjectRecord | null>;
  duplicate(ownerId: string, id: string): Promise<ProjectRecord | null>;
  delete(ownerId: string, id: string): Promise<boolean>;
}
