import type { PricingInput, PricingMode, PricingResult } from "./pricing";

export interface CategoryRecord {
  id: string;
  name: string;
  isActive: boolean;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VolumeTier {
  qty: string;
  quantity: number;
  discount: number;
}

export const createDefaultVolumeTiers = (): VolumeTier[] => [
  { qty: "1-10", quantity: 10, discount: 0 },
  { qty: "11-50", quantity: 50, discount: 5 },
  { qty: "51-200", quantity: 200, discount: 10 },
  { qty: "201-500", quantity: 500, discount: 15 },
  { qty: "501+", quantity: 501, discount: 20 },
];

export interface ProjectInput extends PricingInput {
  categoryId: string | null;
  projectDate: string;
  productName: string;
  productImageUrl: string;
  detail: string;
  currencyCode: string;
  volumeTiers: VolumeTier[];
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
