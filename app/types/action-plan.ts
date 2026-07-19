import type { DataConfidence } from "./store-analysis";
import type { AutomationAction } from "../services/automation/product-automation.server";

export type ActionPlanCategory =
  | "losing_money"
  | "missed_opportunity"
  | "catalog"
  | "marketing"
  | "seo"
  | "pricing";

export type ActionPlanPriority = "critical" | "high" | "medium" | "low";

export interface ActionPlanItem {
  id: string;
  rank: number;
  priority: ActionPlanPriority;
  category: ActionPlanCategory;
  title: string;
  problem: string;
  diyAction: string;
  estimatedImpact: string;
  confidence: DataConfidence;
  executable?: {
    kind: "automation" | "description";
    automation?: AutomationAction;
    productId?: string;
    productTitle?: string;
  };
}

export interface ActionPlanReport {
  generatedAt: string | null;
  currency: string;
  summary: string;
  disclaimer: string;
  moneyAtRisk: {
    losingProductsEstimate: number;
    abandonedCartValue: number;
    deadStockCount: number;
  };
  items: ActionPlanItem[];
  weakDescriptionProducts: {
    productId: string;
    title: string;
    descriptionLength: number;
  }[];
}
