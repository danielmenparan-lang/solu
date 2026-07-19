import type {

  ActionFunctionArgs,

  HeadersFunction,

  LoaderFunctionArgs,

} from "react-router";

import { useFetcher, useLoaderData } from "react-router";

import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

import {

  getLatestScan,

  getRecommendations,

  runFullStoreScan,

} from "../services/scan-orchestrator.server";

import { getShopPlanInfo, assertCanScan } from "../services/billing/shop-plan.server";

import { isBillingTestMode } from "../services/billing/billing.server";

import { getAppSetupStatus } from "../services/setup-status.server";

import type {

  CountryProfitRow,

  ProductProfitRow,

} from "../types/store-analysis";



const GRADE_LABELS: Record<string, string> = {

  critical: "Critical",

  poor: "Poor",

  fair: "Fair",

  good: "Good",

  excellent: "Excellent",

};



export const loader = async ({ request }: LoaderFunctionArgs) => {

  const { admin, session } = await authenticate.admin(request);

  const shop = session.shop;



  const [latestScan, recommendations, plan, setup] = await Promise.all([

    getLatestScan(shop),

    getRecommendations(shop),

    getShopPlanInfo(admin, shop),

    getAppSetupStatus(),

  ]);



  return {

    latestScan,

    recommendations,

    shop,

    plan,

    setup,

    billingTestMode: isBillingTestMode(),

  };

};



export const action = async ({ request }: ActionFunctionArgs) => {

  const { admin, session } = await authenticate.admin(request);



  if (request.method !== "POST") {

    return { error: "Method not allowed" };

  }



  const scanCheck = await assertCanScan(admin, session.shop);

  if (!scanCheck.allowed) {

    return { error: scanCheck.reason, plan: scanCheck.plan };

  }



  const result = await runFullStoreScan(admin, session.shop);

  return { success: true, ...result };

};



export default function Dashboard() {

  const { latestScan, recommendations, shop, plan, setup, billingTestMode } =

    useLoaderData<typeof loader>();

  const fetcher = useFetcher<typeof action>();

  const isScanning =

    fetcher.state === "submitting" || fetcher.state === "loading";



  const actionData =

    fetcher.data && "success" in fetcher.data ? fetcher.data : null;

  const scan = actionData?.scanResult ?? latestScan?.scan;

  const aiAnalysis = actionData?.aiAnalysis;

  const executedActions = actionData?.executedActions;

  const kpis = scan?.kpis;

  const snapshot = scan?.snapshot;



  return (

    <s-page heading="Profit Brain AI — Profit Analytics">

      <s-button

        slot="primary-action"

        onClick={() => fetcher.submit({}, { method: "POST" })}

        {...(isScanning ? { loading: true } : {})}

      >

        Run Profit Brain Scan

      </s-button>



      {!plan.isPro && (

        <s-banner tone="info">

          Free plan — {plan.scansRemaining} scan(s) left.{" "}

          <s-link href="/app/billing">Upgrade to Pro — $19/mo</s-link> for

          unlimited scans & automations.

        </s-banner>

      )}



      {billingTestMode && (

        <s-banner tone="success">

          Dev mode — Pro features unlocked for testing. No charge on dev stores.

        </s-banner>

      )}



      <s-section heading="System status">

        <s-stack direction="block" gap="base">

          <s-text>{setup.shopify ? "✓" : "✗"} Shopify connected</s-text>

          <s-text>

            {setup.anthropic ? "✓" : "✗"} AI (Anthropic){" "}

            {setup.anthropic

              ? "— ready"

              : "— not working; fix server API key and rescan"}

          </s-text>
        </s-stack>

        {!setup.readyForWow && setup.blockers.length > 0 && (

          <s-banner tone="warning">{setup.blockers.join(" · ")}</s-banner>

        )}

        {setup.anthropic && !scan && (

          <s-banner tone="success">

            AI is ready. Click &quot;Run Profit Brain Scan&quot; above to see

            where money is leaking and what to fix first.

          </s-banner>

        )}

      </s-section>



      {fetcher.data && "error" in fetcher.data && fetcher.data.error && (

        <s-banner tone="warning">

          {fetcher.data.error}{" "}

          <s-link href="/app/billing">Upgrade to Pro</s-link>

        </s-banner>

      )}



      {executedActions && executedActions.length > 0 && (

        <s-banner tone="success">

          Agent ran:{" "}

          {executedActions.map((a) => `${a.action} (${a.message})`).join(" | ")}

        </s-banner>

      )}



      <s-section heading="Your AI profit advisor">

        <s-paragraph>

          Profit Brain AI scores your store on 7 dimensions, surfaces winning

          and losing products, and tells you what to remove, promote, or

          automate. Store: <s-text type="strong">{shop}</s-text>

        </s-paragraph>

      </s-section>



      {kpis && (

        <s-section heading="Store scores (7 dimensions)">

          <s-stack direction="inline" gap="base">

            {[

              ["Profit", kpis.scores?.profit],

              ["Marketing", kpis.scores?.marketing],

              ["Product", kpis.scores?.product],

              ["Pricing", kpis.scores?.pricing],

              ["SEO", kpis.scores?.seo],

              ["Health", kpis.scores?.storeHealth],

              ["Growth", kpis.scores?.growth],

            ].map(([label, value]) => (

              <s-box

                key={label as string}

                padding="base"

                borderWidth="base"

                borderRadius="base"

              >

                <s-heading>{value ?? kpis.profitabilityScore}/100</s-heading>

                <s-text>{label}</s-text>

              </s-box>

            ))}

          </s-stack>

          <s-text type="generic">

            Overall: {kpis.profitabilityScore}/100 (

            {GRADE_LABELS[kpis.profitabilityGrade] ?? kpis.profitabilityGrade})

            {kpis.grossMarginEstimate != null &&

              ` | Est. gross margin: ${kpis.grossMarginEstimate.toFixed(1)}% (${kpis.marginConfidence === "measured" ? "from product costs" : "estimated"})`}

            {kpis.measuredCostPercent != null &&

              ` | Product costs in Shopify: ${kpis.measuredCostPercent}%`}

          </s-text>

          {kpis.measuredCostPercent < 50 && (

            <s-banner tone="info">

              Add <s-text type="strong">Cost per item</s-text> on each product

              variant in Shopify Admin for more accurate profit numbers.

            </s-banner>

          )}

        </s-section>

      )}



      {kpis?.winningProducts && kpis.winningProducts.length > 0 && (

        <s-section heading="Top profit products">

          <s-unordered-list>

            {kpis.winningProducts.map((p: ProductProfitRow) => (

              <s-list-item key={p.productId}>

                {p.title}: ~{p.estimatedProfit.toFixed(0)} {snapshot?.currency}{" "}

                ({p.marginPercent.toFixed(0)}% margin, {p.confidence})

              </s-list-item>

            ))}

          </s-unordered-list>

        </s-section>

      )}



      {kpis?.losingProducts && kpis.losingProducts.length > 0 && (

        <s-section heading="Products losing money">

          <s-unordered-list>

            {kpis.losingProducts.map((p: ProductProfitRow) => (

              <s-list-item key={p.productId}>

                {p.title}: ~{p.estimatedProfit.toFixed(0)} {snapshot?.currency}{" "}

                ({p.confidence})

              </s-list-item>

            ))}

          </s-unordered-list>

        </s-section>

      )}



      {kpis && (
        <s-section heading="Your action plan">
          <s-paragraph>
            Prioritized fixes with DIY steps and one-click approvals (you confirm
            every store change). Results are estimates, not guarantees.
          </s-paragraph>
          <s-link href="/app/action-plan">
            <s-button>Open Action Plan</s-button>
          </s-link>
        </s-section>
      )}



      {kpis && aiAnalysis?.successProbability && (

        <s-section heading="Estimated improvement potential">

          <s-box padding="large" borderWidth="base" borderRadius="base">

            <s-heading>

              Estimated score: {aiAnalysis.successProbability.current}% →{" "}

              {aiAnalysis.successProbability.potential}% (not guaranteed)

            </s-heading>

            <s-text>{aiAnalysis.successProbability.reasoning}</s-text>

          </s-box>

        </s-section>

      )}



      {snapshot && (

        <s-section heading="Store snapshot">

          <s-stack direction="block" gap="base">

            <s-text>

              Products: {snapshot.productCount} ({snapshot.activeProductCount}{" "}

              active)

            </s-text>

            <s-text>

              Orders: {snapshot.orders.totalOrders} | Revenue:{" "}

              {snapshot.orders.totalRevenue.toFixed(0)} {snapshot.currency}

            </s-text>

            <s-text>

              AOV: {snapshot.orders.averageOrderValue.toFixed(0)} | Repeat

              customers: {snapshot.orders.repeatCustomerRate.toFixed(1)}%

            </s-text>

            <s-text>

              Abandoned carts: {snapshot.orders.abandonedCheckoutCount} (

              {snapshot.orders.abandonedCheckoutValue.toFixed(0)}{" "}

              {snapshot.currency})

            </s-text>

            <s-text>Dead stock: {kpis?.deadStockCount ?? 0} products</s-text>

            <s-text>Stockout risk: {kpis?.stockoutRiskCount ?? 0} products</s-text>

          </s-stack>

        </s-section>

      )}



      {kpis?.dataLimitations && (

        <s-section heading="Data notes">

          <s-unordered-list>

            {kpis.dataLimitations.map((note: string) => (

              <s-list-item key={note}>{note}</s-list-item>

            ))}

          </s-unordered-list>

        </s-section>

      )}



      {plan.isPro && kpis?.profitByCountry && kpis.profitByCountry.length > 0 && (

        <s-section heading="Profit by country (estimated)">

          <s-unordered-list>

            {kpis.profitByCountry.slice(0, 5).map((row: CountryProfitRow) => (

              <s-list-item key={row.country}>

                {row.country}: ~{row.estimatedProfit.toFixed(0)}{" "}

                {snapshot?.currency} ({row.orderCount} orders)

              </s-list-item>

            ))}

          </s-unordered-list>

        </s-section>

      )}



      {aiAnalysis?.summary && (

        <s-section heading="AI summary">

          <s-paragraph>{aiAnalysis.summary}</s-paragraph>

        </s-section>

      )}



      {aiAnalysis?.criticalIssues && aiAnalysis.criticalIssues.length > 0 && (

        <s-section heading="Critical issues">

          <s-unordered-list>

            {aiAnalysis.criticalIssues.map((issue: string) => (

              <s-list-item key={issue}>{issue}</s-list-item>

            ))}

          </s-unordered-list>

        </s-section>

      )}



      {recommendations.length > 0 && (

        <s-section heading="Latest recommendations">

          <s-stack direction="block" gap="base">

            {(actionData?.aiAnalysis?.recommendations ?? recommendations)

              .slice(0, 5)

              .map(

                (

                  rec: {

                    id?: string;

                    title: string;

                    description: string;

                    priority: string;

                    impact: string;

                  },

                  index: number,

                ) => (

                  <s-box

                    key={rec.id ?? `rec-${index}`}

                    padding="base"

                    borderWidth="base"

                    borderRadius="base"

                  >

                    <s-heading>

                      [{rec.priority}] {rec.title}

                    </s-heading>

                    <s-paragraph>{rec.description}</s-paragraph>

                    <s-text type="generic">Impact: {rec.impact}</s-text>

                  </s-box>

                ),

              )}

          </s-stack>

          <s-link href="/app/recommendations">View all recommendations →</s-link>

        </s-section>

      )}



      {!scan && !isScanning && (

        <s-section heading="Get started">

          <s-paragraph>

            Click &quot;Run Profit Brain Scan&quot; to analyze your store and get

            prioritized actions in under a minute.

          </s-paragraph>

        </s-section>

      )}



      <s-section slot="aside" heading="Quick links">

        <s-stack direction="block" gap="base">

          <s-link href="/app/billing">Plans & pricing</s-link>

          <s-link href="/app/agent">AI Advisor</s-link>

          <s-link href="/app/automations">Automations</s-link>

        </s-stack>

      </s-section>

    </s-page>

  );

}



export const headers: HeadersFunction = (headersArgs) => {

  return boundary.headers(headersArgs);

};


