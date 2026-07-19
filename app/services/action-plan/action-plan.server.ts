import type { ScanResult } from "../../types/store-analysis";
import type {
  ActionPlanItem,
  ActionPlanReport,
} from "../../types/action-plan";

const DISCLAIMER =
  "All figures are estimates based on Shopify data. Results are not guaranteed. You approve every store change.";

interface StoredRecommendation {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: string;
  category: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function priorityFromRank(rank: number): ActionPlanItem["priority"] {
  if (rank === 1) return "critical";
  if (rank <= 3) return "high";
  if (rank <= 6) return "medium";
  return "low";
}

export function getWeakDescriptionProducts(scan: ScanResult) {
  return scan.snapshot.products
    .filter(
      (p) =>
        p.status === "ACTIVE" &&
        (!p.hasSeoDescription || p.descriptionLength < 120),
    )
    .slice(0, 10)
    .map((p) => ({
      productId: p.id,
      title: p.title,
      descriptionLength: p.descriptionLength,
    }));
}

export function buildActionPlan(
  scan: ScanResult | null,
  recommendations: StoredRecommendation[] = [],
): ActionPlanReport {
  if (!scan) {
    return {
      generatedAt: null,
      currency: "USD",
      summary: "Run a Profit Brain Scan to generate your action plan.",
      disclaimer: DISCLAIMER,
      moneyAtRisk: {
        losingProductsEstimate: 0,
        abandonedCartValue: 0,
        deadStockCount: 0,
      },
      items: [],
      weakDescriptionProducts: [],
    };
  }

  const { snapshot, kpis } = scan;
  const items: ActionPlanItem[] = [];
  let rank = 1;

  const losingTotal = kpis.losingProducts.reduce(
    (sum, p) => sum + Math.abs(Math.min(0, p.estimatedProfit)),
    0,
  );

  if (kpis.losingProducts.length > 0) {
    items.push({
      id: `money-losing-${rank}`,
      rank: rank++,
      priority: "critical",
      category: "losing_money",
      title: "Stop bleeding on losing products",
      problem: `${kpis.losingProducts.length} products show negative estimated profit (~${losingTotal.toFixed(0)} ${snapshot.currency} total).`,
      diyAction:
        "Review pricing and costs for these SKUs. Pause ads, bundle, or draft products you cannot fix.",
      estimatedImpact: "Reduce ad waste and focus budget on winners (estimated).",
      confidence: kpis.losingProducts[0]?.confidence ?? "estimated",
      executable: {
        kind: "automation",
        automation: "draft_losing_products",
      },
    });
  }

  if (kpis.deadStockCount > 0) {
    items.push({
      id: `dead-stock-${rank}`,
      rank: rank++,
      priority: "high",
      category: "catalog",
      title: "Clear dead stock",
      problem: `${kpis.deadStockCount} active products have zero sales — cash and attention tied up.`,
      diyAction:
        "Archive, discount, or remove listings. Stop promoting them in ads and email.",
      estimatedImpact: "Free merchandising focus for products that sell (estimated).",
      confidence: "measured",
      executable: {
        kind: "automation",
        automation: "tag_dead_stock",
      },
    });
  }

  if (snapshot.orders.abandonedCheckoutValue > 0) {
    items.push({
      id: `abandoned-${rank}`,
      rank: rank++,
      priority: "high",
      category: "missed_opportunity",
      title: "Recover abandoned checkout revenue",
      problem: `${snapshot.orders.abandonedCheckoutCount} abandoned carts worth ~${snapshot.orders.abandonedCheckoutValue.toFixed(0)} ${snapshot.currency}.`,
      diyAction:
        "Send recovery emails (with consent), simplify checkout, or offer limited-time cart reminders.",
      estimatedImpact: "Even a small recovery rate can add meaningful revenue (estimated, not guaranteed).",
      confidence: "measured",
    });
  }

  if (snapshot.orders.repeatCustomerRate < 25) {
    items.push({
      id: `repeat-${rank}`,
      rank: rank++,
      priority: "medium",
      category: "missed_opportunity",
      title: "Increase repeat purchases",
      problem: `Repeat customer rate is ${snapshot.orders.repeatCustomerRate.toFixed(1)}% (benchmark ~25%+).`,
      diyAction:
        "Launch post-purchase email, loyalty offer, or win-back flow for one-time buyers.",
      estimatedImpact: "Higher LTV over time (estimated — depends on your execution).",
      confidence: "measured",
    });
  }

  const weakDescriptions = getWeakDescriptionProducts(scan);
  if (weakDescriptions.length > 0) {
    const first = weakDescriptions[0];
    items.push({
      id: `descriptions-${rank}`,
      rank: rank++,
      priority: "medium",
      category: "seo",
      title: "Fix weak product descriptions",
      problem: `${weakDescriptions.length} products have thin or missing descriptions — hurts SEO and conversion.`,
      diyAction:
        "Rewrite titles/descriptions with benefits, specs, and keywords. Or use Approve below to apply an AI draft (you review first).",
      estimatedImpact: "Better product pages may improve conversion (estimated, not guaranteed).",
      confidence: "measured",
      executable: {
        kind: "description",
        productId: first.productId,
        productTitle: first.title,
      },
    });
  }

  if (kpis.winningProducts.length > 0) {
    items.push({
      id: `winners-${rank}`,
      rank: rank++,
      priority: "medium",
      category: "catalog",
      title: "Promote winning products",
      problem: `${kpis.winningProducts.length} products drive most estimated profit.`,
      diyAction: "Feature them on homepage, ads, and email. Tag for easy filtering.",
      estimatedImpact: "More revenue from proven SKUs (estimated).",
      confidence: kpis.winningProducts[0]?.confidence ?? "estimated",
      executable: {
        kind: "automation",
        automation: "tag_winning_products",
      },
    });
  }

  for (const rec of recommendations) {
    items.push({
      id: `rec-${rec.id}`,
      rank: rank++,
      priority: (rec.priority as ActionPlanItem["priority"]) || "medium",
      category:
        rec.category === "marketing"
          ? "marketing"
          : rec.category === "seo"
            ? "seo"
            : "catalog",
      title: rec.title,
      problem: rec.description,
      diyAction: rec.description,
      estimatedImpact: `${rec.impact} (estimated, not guaranteed)`,
      confidence: "estimated",
    });
  }

  items.sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
      a.rank - b.rank,
  );

  items.forEach((item, index) => {
    item.rank = index + 1;
    item.priority = priorityFromRank(item.rank);
  });

  return {
    generatedAt: snapshot.scannedAt,
    currency: snapshot.currency,
    summary: kpis.wasteAreas[0]
      ? `Top issue: ${kpis.wasteAreas[0]}. Work through priorities 1–${Math.min(items.length, 5)} below.`
      : "Your store scan is complete. Follow the prioritized actions below.",
    disclaimer: DISCLAIMER,
    moneyAtRisk: {
      losingProductsEstimate: losingTotal,
      abandonedCartValue: snapshot.orders.abandonedCheckoutValue,
      deadStockCount: kpis.deadStockCount,
    },
    items,
    weakDescriptionProducts: weakDescriptions,
  };
}
