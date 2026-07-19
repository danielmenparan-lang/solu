import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  getLatestScan,
  getRecommendations,
} from "../services/scan-orchestrator.server";
import { buildActionPlan } from "../services/action-plan/action-plan.server";
import {
  getProductIdsFromScan,
  runAutomation,
  type AutomationAction,
} from "../services/automation/product-automation.server";
import {
  applyProductDescription,
  fetchProductDescription,
  generateImprovedDescription,
} from "../services/automation/description-improvement.server";
import { assertProFeature, getShopPlanInfo } from "../services/billing/shop-plan.server";

const AUTOMATION_LABELS: Record<AutomationAction, string> = {
  tag_dead_stock: "Tag dead stock",
  tag_losing_products: "Tag low-profit products",
  tag_winning_products: "Tag top profit products",
  draft_losing_products: "Draft losing products",
  create_winners_collection: "Create Top Performers collection",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [latestScan, recommendations, plan] = await Promise.all([
    getLatestScan(session.shop),
    getRecommendations(session.shop),
    getShopPlanInfo(admin, session.shop),
  ]);

  const report = buildActionPlan(
    latestScan?.scan ?? null,
    recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      impact: r.impact,
      priority: r.priority,
      category: r.category,
    })),
  );

  return { report, plan, hasScan: Boolean(latestScan) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const latestScan = await getLatestScan(session.shop);
  if (!latestScan) {
    return { error: "Run a Profit Brain Scan before using the action plan." };
  }

  const proCheck = await assertProFeature(admin, session.shop, "automations");
  if (!proCheck.allowed) {
    return { error: proCheck.reason };
  }

  if (intent === "automation") {
    const automation = formData.get("automation") as AutomationAction;
    const productIds = getProductIdsFromScan(latestScan.scan);
    const result = await runAutomation(admin, automation, productIds);

    await prisma.automationRun.create({
      data: {
        shop: session.shop,
        action: automation,
        details: JSON.stringify(result),
        status: result.success ? "success" : "failed",
      },
    });

    return { intent, result };
  }

  if (intent === "preview_description") {
    const productId = formData.get("productId") as string;
    const current = await fetchProductDescription(admin, productId);
    if (!current) {
      return { error: "Could not load product description." };
    }

    const improved = await generateImprovedDescription(
      current.title,
      current.descriptionHtml,
      latestScan.scan,
    );

    return {
      intent,
      preview: {
        productId,
        productTitle: current.title,
        currentHtml: current.descriptionHtml,
        proposedHtml: improved.descriptionHtml,
        summary: improved.summary,
      },
    };
  }

  if (intent === "apply_description") {
    const productId = formData.get("productId") as string;
    const descriptionHtml = formData.get("descriptionHtml") as string;

    const result = await applyProductDescription(
      admin,
      productId,
      descriptionHtml,
    );

    await prisma.automationRun.create({
      data: {
        shop: session.shop,
        action: "description_update",
        details: JSON.stringify({ productId, ...result }),
        status: result.success ? "success" : "failed",
      },
    });

    return { intent, result };
  }

  return { error: "Unknown action." };
};

export default function ActionPlanPage() {
  const { report, plan, hasScan } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const isBusy = fetcher.state !== "idle";
  const [selectedProductId, setSelectedProductId] = useState(
    report.weakDescriptionProducts[0]?.productId ?? "",
  );

  useEffect(() => {
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    } else if (fetcher.data?.result?.success) {
      shopify.toast.show(fetcher.data.result.message);
    } else if (fetcher.data?.result && !fetcher.data.result.success) {
      shopify.toast.show(fetcher.data.result.message, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const runAutomationAction = (automation: AutomationAction) => {
    const formData = new FormData();
    formData.set("intent", "automation");
    formData.set("automation", automation);
    fetcher.submit(formData, { method: "POST" });
  };

  const previewDescription = () => {
    if (!selectedProductId) return;
    const formData = new FormData();
    formData.set("intent", "preview_description");
    formData.set("productId", selectedProductId);
    fetcher.submit(formData, { method: "POST" });
  };

  const applyDescription = (productId: string, descriptionHtml: string) => {
    const formData = new FormData();
    formData.set("intent", "apply_description");
    formData.set("productId", productId);
    formData.set("descriptionHtml", descriptionHtml);
    fetcher.submit(formData, { method: "POST" });
  };

  const preview =
    fetcher.data?.intent === "preview_description"
      ? fetcher.data.preview
      : null;

  return (
    <s-page heading="Action Plan">
      <s-section heading="Prioritized profit fixes">
        <s-paragraph>{report.summary}</s-paragraph>
        <s-banner tone="info">{report.disclaimer}</s-banner>
      </s-section>

      {!hasScan && (
        <s-banner tone="warning">
          Run a Profit Brain Scan first.{" "}
          <s-link href="/app">Go to Dashboard</s-link>
        </s-banner>
      )}

      {hasScan && !plan?.isPro && (
        <s-banner tone="warning">
          Store actions require Pro ($19/mo).{" "}
          <s-link href="/app/billing">Upgrade</s-link>
        </s-banner>
      )}

      {hasScan && report.moneyAtRisk && (
        <s-section heading="Money at risk (estimates)">
          <s-stack direction="block" gap="base">
            <s-text>
              Losing products: ~{report.moneyAtRisk.losingProductsEstimate.toFixed(0)}{" "}
              {report.currency}
            </s-text>
            <s-text>
              Abandoned carts: ~{report.moneyAtRisk.abandonedCartValue.toFixed(0)}{" "}
              {report.currency}
            </s-text>
            <s-text>Dead stock SKUs: {report.moneyAtRisk.deadStockCount}</s-text>
          </s-stack>
        </s-section>
      )}

      {report.items.length > 0 && (
        <s-stack direction="block" gap="base">
          {report.items.map((item) => (
            <s-box
              key={item.id}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="inline" gap="base">
                <s-badge tone={item.priority === "critical" ? "critical" : "info"}>
                  #{item.rank} · {item.priority}
                </s-badge>
                <s-text type="generic">{item.confidence}</s-text>
              </s-stack>

              <s-heading>{item.title}</s-heading>
              <s-paragraph>{item.problem}</s-paragraph>

              <s-section heading="What you can do">
                <s-paragraph>{item.diyAction}</s-paragraph>
              </s-section>

              <s-text type="generic">
                Estimated impact: {item.estimatedImpact}
              </s-text>

              {item.executable?.kind === "automation" && item.executable.automation && (
                <s-button
                  onClick={() => runAutomationAction(item.executable!.automation!)}
                  {...(isBusy ? { loading: true } : {})}
                  {...(item.executable.automation === "draft_losing_products"
                    ? { tone: "critical" }
                    : {})}
                >
                  Approve & run: {AUTOMATION_LABELS[item.executable.automation]}
                </s-button>
              )}

              {item.executable?.kind === "description" &&
                report.weakDescriptionProducts.length > 0 && (
                  <s-stack direction="block" gap="base">
                    <label>
                      <s-text type="strong">Product to improve</s-text>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        style={{ display: "block", marginTop: 8, minWidth: 280 }}
                      >
                        {report.weakDescriptionProducts.map((p) => (
                          <option key={p.productId} value={p.productId}>
                            {p.title} ({p.descriptionLength} chars)
                          </option>
                        ))}
                      </select>
                    </label>

                    <s-button
                      onClick={previewDescription}
                      {...(isBusy ? { loading: true } : {})}
                    >
                      Preview AI draft (no store change)
                    </s-button>

                    {preview && preview.productId === selectedProductId && (
                      <s-box
                        padding="base"
                        borderWidth="base"
                        borderRadius="base"
                        background="subdued"
                      >
                        <s-text type="strong">{preview.summary}</s-text>
                        <s-section heading="Proposed description">
                          <div
                            dangerouslySetInnerHTML={{
                              __html: preview.proposedHtml,
                            }}
                          />
                        </s-section>
                        <s-button
                          tone="critical"
                          onClick={() =>
                            applyDescription(
                              preview.productId,
                              preview.proposedHtml,
                            )
                          }
                          {...(isBusy ? { loading: true } : {})}
                        >
                          Approve & apply to store
                        </s-button>
                      </s-box>
                    )}
                  </s-stack>
                )}
            </s-box>
          ))}
        </s-stack>
      )}

      {hasScan && report.items.length === 0 && (
        <s-banner tone="success">
          No major issues detected. Keep monitoring with regular scans.
        </s-banner>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
