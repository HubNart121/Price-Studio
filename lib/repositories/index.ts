import { getDataBackend } from "../config/data-backend";
import { firestoreCategoryRepository } from "./firestore/category-repository";
import { firestoreProjectRepository } from "./firestore/project-repository";
import { postgresCategoryRepository } from "./postgres/category-repository";
import { postgresProjectRepository } from "./postgres/project-repository";

const backend = getDataBackend();

export const categoryRepository =
  backend === "firestore"
    ? firestoreCategoryRepository
    : postgresCategoryRepository;

export const projectRepository =
  backend === "firestore" ? firestoreProjectRepository : postgresProjectRepository;
