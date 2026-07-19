import type {
  DataConfidence,
  ProductProfitRow,
  ProfitabilityGrade,
  ScanResult,
  StoreKpis,
  StoreScores,
  StoreSnapshot,
} from "../../types/store-analysis";
import { BENCHMARKS } from "../knowledge/knowledge-base.server";

const ESTIMATED_COST_RATIO = 0.62;
const SHOPIFY_FEE_RATE = 0.029;
const SHOPIFY_FEE_FLAT = 0.3;

function gradeFromScore(score: number): ProfitabilityGrade {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "fair";
  if (score >= 25) return "poor";
  return "critical";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getUnitCost(
  product: StoreSnapshot["products"][number],
): { cost: number; confidence: DataConfidence } {
  if (product.unitCost) {
    return { cost: parseFloat(product.unitCost), confidence: "measured" };
  }

  return {
    cost: parseFloat(product.price) * ESTIMATED_COST_RATIO,
    confidence: "estimated",
  };
}

function buildProductProfitRows(
  snapshot: StoreSnapshot,
): ProductProfitRow[] {
  return snapshot.products.map((product) => {
    const { cost, confidence } = getUnitCost(product);
    const price = parseFloat(product.price);
    const unitsSold = product.totalSold;
    const revenue = product.revenue;
    const cogs = cost * unitsSold;
    const fees = revenue * SHOPIFY_FEE_RATE;
    const estimatedProfit = revenue - cogs - fees;
    const marginPercent =
      revenue > 0 ? (estimatedProfit / revenue) * 100 : price > cost ? ((price - cost) / price) * 100 : 0;
    const refundRate =
      unitsSold > 0 ? (product.refundUnits / unitsSold) * 100 : 0;

    return {
      productId: product.id,
      title: product.title,
      revenue,
      estimatedProfit,
      marginPercent,
      confidence,
      unitsSold,
      refundRate,
    };
  });
}

function computeScores(
  snapshot: StoreSnapshot,
  productProfits: ProductProfitRow[],
): StoreScores {
  const { products, orders } = snapshot;
  const activeProducts = products.filter((p) => p.status === "ACTIVE");
  const deadStock = activeProducts.filter((p) => p.totalSold === 0);
  const soldProducts = productProfits.filter((p) => p.unitsSold > 0);
  const losing = soldProducts.filter((p) => p.estimatedProfit < 0);
  const avgMargin =
    soldProducts.length > 0
      ? soldProducts.reduce((sum, p) => sum + p.marginPercent, 0) /
        soldProducts.length
      : 0;

  const profitScore = clampScore(
    50 +
      avgMargin * 0.8 -
      (losing.length / Math.max(soldProducts.length, 1)) * 40 -
      deadStock.length * 0.5,
  );

  const marketingScore = clampScore(
    40 +
      orders.repeatCustomerRate * 1.2 +
      Math.min(orders.averageOrderValue / 2, 25) -
      (orders.abandonedCheckoutCount > 5 ? 10 : 0),
  );

  const productScore = clampScore(
    70 -
      (deadStock.length / Math.max(activeProducts.length, 1)) * 50 -
      (orders.refundRate > BENCHMARKS.healthyRefundRate ? 15 : 0),
  );

  const discounted = products.filter(
    (p) => p.compareAtPrice && parseFloat(p.compareAtPrice) > parseFloat(p.price),
  );
  const pricingScore = clampScore(
    75 -
      (discounted.length / Math.max(products.length, 1)) * 30 -
      (avgMargin < 20 ? 20 : 0),
  );

  const weakSeo = products.filter(
    (p) => !p.hasSeoTitle || !p.hasSeoDescription || p.descriptionLength < 120,
  );
  const seoScore = clampScore(
    85 - (weakSeo.length / Math.max(products.length, 1)) * 60,
  );

  const stockoutRisk = activeProducts.filter(
    (p) => p.totalSold > 5 && p.totalInventory > 0 && p.totalInventory <= 5,
  );
  const growthScore = clampScore(
    35 +
      soldProducts.length * 0.8 -
      deadStock.length * 0.4 +
      orders.repeatCustomerRate * 0.5 -
      stockoutRisk.length * 3,
  );

  const storeHealth = clampScore(
    (profitScore +
      marketingScore +
      productScore +
      pricingScore +
      seoScore +
      growthScore) /
      6,
  );

  return {
    profit: profitScore,
    marketing: marketingScore,
    product: productScore,
    pricing: pricingScore,
    seo: seoScore,
    storeHealth,
    growth: growthScore,
  };
}

export function analyzeProfitability(snapshot: StoreSnapshot): StoreKpis {
  const { products, orders } = snapshot;
  const wasteAreas: string[] = [];
  const dataLimitations: string[] = [
    "Profit calculated from Shopify data only — not Meta Ads, Google Ads, or supplier tools.",
    "Product costs estimated at 62% of price when no cost per item is set in Shopify.",
    "UX, PageSpeed, and conversion — estimated from product catalog signals.",
  ];

  const productProfits = buildProductProfitRows(snapshot);
  const soldProducts = productProfits.filter((p) => p.unitsSold > 0);
  const losingProducts = soldProducts
    .filter((p) => p.estimatedProfit < 0)
    .sort((a, b) => a.estimatedProfit - b.estimatedProfit)
    .slice(0, 5);
  const winningProducts = soldProducts
    .filter((p) => p.estimatedProfit > 0)
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
    .slice(0, 5);

  const measuredCostCount = products.filter((p) => p.unitCost).length;
  const measuredCostPercent =
    products.length > 0
      ? Math.round((measuredCostCount / products.length) * 100)
      : 0;
  const marginConfidence: DataConfidence =
    measuredCostCount > products.length * 0.5 ? "measured" : "estimated";

  if (marginConfidence === "estimated") {
    dataLimitations.push(
      `Only ${measuredCostPercent}% of products have cost per item in Shopify. Add costs under Products → variant → Cost per item for accurate margins.`,
    );
  }

  const profitByCountry = snapshot.countrySales
    .map((row) => {
      const estimatedProfit =
        row.revenue * (1 - ESTIMATED_COST_RATIO - SHOPIFY_FEE_RATE) -
        row.shippingCost * 0.5;
      return {
        country: row.country,
        revenue: row.revenue,
        estimatedProfit,
        orderCount: row.orderCount,
      };
    })
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit);

  const vendorMap = new Map<
    string,
    { revenue: number; profit: number; count: number }
  >();
  for (const product of products) {
    const profitRow = productProfits.find((p) => p.productId === product.id);
    if (!profitRow) continue;
    const existing = vendorMap.get(product.vendor) ?? {
      revenue: 0,
      profit: 0,
      count: 0,
    };
    vendorMap.set(product.vendor, {
      revenue: existing.revenue + profitRow.revenue,
      profit: existing.profit + profitRow.estimatedProfit,
      count: existing.count + 1,
    });
  }

  const profitByVendor = [...vendorMap.entries()]
    .map(([vendor, stats]) => ({
      vendor,
      revenue: stats.revenue,
      estimatedProfit: stats.profit,
      productCount: stats.count,
    }))
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit);

  const deadStock = products.filter(
    (p) => p.status === "ACTIVE" && p.totalSold === 0,
  );
  const stockoutRisk = products.filter(
    (p) =>
      p.status === "ACTIVE" &&
      p.totalSold > 5 &&
      p.totalInventory > 0 &&
      p.totalInventory <= 5,
  );

  const scores = computeScores(snapshot, productProfits);
  let score = scores.storeHealth;

  if (deadStock.length > 0) {
    wasteAreas.push(`${deadStock.length} active products with zero sales`);
  }
  if (losingProducts.length > 0) {
    wasteAreas.push(`${losingProducts.length} products losing money (estimated)`);
  }
  if (orders.abandonedCheckoutCount > 0) {
    wasteAreas.push(
      `${orders.abandonedCheckoutCount} abandoned carts (${orders.abandonedCheckoutValue.toFixed(0)} ${snapshot.currency})`,
    );
  }
  if (stockoutRisk.length > 0) {
    wasteAreas.push(`${stockoutRisk.length} products at stockout risk`);
  }
  if (orders.repeatCustomerRate < BENCHMARKS.healthyRepeatRate) {
    wasteAreas.push("Low repeat customer rate");
  }
  if (orders.refundRate > BENCHMARKS.healthyRefundRate) {
    wasteAreas.push(`High refund rate (${orders.refundRate.toFixed(1)}%)`);
  }

  const avgMargin =
    soldProducts.length > 0
      ? soldProducts.reduce((sum, p) => sum + p.marginPercent, 0) /
        soldProducts.length
      : null;

  return {
    profitabilityScore: score,
    profitabilityGrade: gradeFromScore(score),
    scores,
    grossMarginEstimate: avgMargin,
    marginConfidence,
    conversionRateEstimate: null,
    deadStockCount: deadStock.length,
    stockoutRiskCount: stockoutRisk.length,
    losingProducts,
    winningProducts,
    profitByCountry,
    profitByVendor,
    topPerformers: winningProducts.map((p) => p.title),
    underperformers: [
      ...losingProducts.map((p) => p.title),
      ...deadStock.slice(0, 3).map((p) => p.title),
    ],
    wasteAreas,
    dataLimitations,
    measuredCostPercent,
  };
}

export function buildScanResult(snapshot: StoreSnapshot): ScanResult {
  return {
    snapshot,
    kpis: analyzeProfitability(snapshot),
  };
}
