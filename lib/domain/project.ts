import type { PricingInput, PricingMode, PricingResult } from "./pricing";

export interface CategoryRecord {
  id: string;
  name: string;
  isActive: boolean;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput extends PricingInput {
  categoryId: string | null;
  projectDate: string;
  productName: string;
  detail: string;
  currencyCode: string;
}

export interface ProjectRecord extends ProjectInput, PricingResult {
  id: string;
  category: { id: string; name: string } | null;
  mode: PricingMode;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFilters {
  query?: string;
  categoryId?: string;
  mode?: PricingMode;
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  ownerEmail: string;
  categories: Array<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  projects: ProjectRecord[];
}
