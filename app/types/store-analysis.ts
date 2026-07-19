export type ProfitabilityGrade = "critical" | "poor" | "fair" | "good" | "excellent";
export type DataConfidence = "measured" | "estimated";

export interface ProductSummary {
  id: string;
  title: string;
  status: string;
  vendor: string;
  totalInventory: number;
  price: string;
  compareAtPrice: string | null;
  unitCost: string | null;
  totalSold: number;
  revenue: number;
  refundUnits: number;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
  descriptionLength: number;
  imageCount: number;
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  refundRate: number;
  repeatCustomerRate: number;
  abandonedCheckoutCount: number;
  abandonedCheckoutValue: number;
}

export interface CountrySalesRow {
  country: string;
  revenue: number;
  orderCount: number;
  shippingCost: number;
}

export interface StoreScores {
  profit: number;
  marketing: number;
  product: number;
  pricing: number;
  seo: number;
  storeHealth: number;
  growth: number;
}

export interface ProductProfitRow {
  productId: string;
  title: string;
  revenue: number;
  estimatedProfit: number;
  marginPercent: number;
  confidence: DataConfidence;
  unitsSold: number;
  refundRate: number;
}

export interface CountryProfitRow {
  country: string;
  revenue: number;
  estimatedProfit: number;
  orderCount: number;
}

export interface VendorProfitRow {
  vendor: string;
  revenue: number;
  estimatedProfit: number;
  productCount: number;
}

export interface StoreKpis {
  profitabilityScore: number;
  profitabilityGrade: ProfitabilityGrade;
  scores: StoreScores;
  grossMarginEstimate: number | null;
  marginConfidence: DataConfidence;
  conversionRateEstimate: number | null;
  deadStockCount: number;
  stockoutRiskCount: number;
  losingProducts: ProductProfitRow[];
  winningProducts: ProductProfitRow[];
  profitByCountry: CountryProfitRow[];
  profitByVendor: VendorProfitRow[];
  topPerformers: string[];
  underperformers: string[];
  wasteAreas: string[];
  dataLimitations: string[];
  measuredCostPercent: number;
}

export interface StoreSnapshot {
  shopName: string;
  shopDomain: string;
  currency: string;
  productCount: number;
  activeProductCount: number;
  products: ProductSummary[];
  orders: OrderSummary;
  countrySales: CountrySalesRow[];
  scannedAt: string;
}

export interface ScanResult {
  snapshot: StoreSnapshot;
  kpis: StoreKpis;
}

export type RecommendationCategory =
  | "products"
  | "marketing"
  | "costs"
  | "tools"
  | "inventory"
  | "pricing"
  | "seo"
  | "ux"
  | "finance";

export type RecommendationPriority = "low" | "medium" | "high" | "critical";

export interface RecommendationInput {
  category: RecommendationCategory;
  title: string;
  description: string;
  impact: string;
  priority: RecommendationPriority;
  confidence?: DataConfidence;
  toolSlug?: string;
}

export interface ToolCatalogEntry {
  slug: string;
  name: string;
  category: string;
  description: string;
  useCase: string;
  affiliateUrl?: string;
}

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
}
