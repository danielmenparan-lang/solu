import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  createProSubscription,
  getActivePlanTier,
  isBillingTestMode,
} from "../services/billing/billing.server";
import { getShopPlanInfo } from "../services/billing/shop-plan.server";
import {
  FREE_SCANS_TOTAL,
  PRO_PRICE_USD,
  PLAN_FEATURES,
} from "../services/billing/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const plan = await getShopPlanInfo(admin, session.shop);
  const tier = await getActivePlanTier(admin);
  const billingTestMode = isBillingTestMode();

  return { plan, tier, billingTestMode, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);

  const appUrl = process.env.SHOPIFY_APP_URL || new URL(request.url).origin;
  const returnUrl = `${appUrl}/app/billing?billing=success`;

  const { confirmationUrl, error } = await createProSubscription(
    admin,
    session.shop,
    returnUrl,
  );

  if (error) {
    return { error };
  }

  if (confirmationUrl) {
    return redirect(confirmationUrl, { target: "_parent" });
  }

  return { error: "Could not create subscription" };
};

export default function BillingPage() {
  const { plan, tier, billingTestMode } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isLoading = fetcher.state !== "idle";

  return (
    <s-page heading="Plans & pricing">
      {billingTestMode && (
        <s-banner tone="info">
          Development mode: Pro features are unlocked for testing. No charge
          applies on dev stores.
        </s-banner>
      )}

      {plan.isPro && !billingTestMode ? (
        <s-banner tone="success">
          You are on <s-text type="strong">Profit Brain AI Pro</s-text> —
          unlimited scans and features. Billing appears on your Shopify invoice.
        </s-banner>
      ) : !plan.isPro ? (
        <s-banner tone="info">
          <s-text type="strong">Free:</s-text> {FREE_SCANS_TOTAL} store scan
          (one-time). <s-text type="strong">Pro:</s-text> ${PRO_PRICE_USD}
          /month for unlimited scans, AI chat, and automations. Shopify shows
          the exact charge before you approve.
        </s-banner>
      ) : null}

      <s-section heading="Simple pricing">
        <s-unordered-list>
          <s-list-item>
            <s-text type="strong">Free — $0/month</s-text>:{" "}
            {FREE_SCANS_TOTAL} full store profit scan (one-time per store),{" "}
            {PLAN_FEATURES.free.aiMessagesPerDay} AI advisor messages per day, 7
            Profit Brain scores, winning/losing product insights. No automations.
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Pro — ${PRO_PRICE_USD}/month</s-text>:
            unlimited scans & AI chat, one-click profit automations (product
            tags, collections), profit by country. Billed on your Shopify bill.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-stack direction="inline" gap="large">
        <s-box padding="large" borderWidth="base" borderRadius="base">
          <s-heading>Free</s-heading>
          <s-text>$0 / month</s-text>
          <s-unordered-list>
            <s-list-item>
              {FREE_SCANS_TOTAL} store scan (one-time)
            </s-list-item>
            <s-list-item>
              {PLAN_FEATURES.free.aiMessagesPerDay} AI messages / day
            </s-list-item>
            <s-list-item>7 Profit Brain Scores</s-list-item>
            <s-list-item>Money leak & product insights</s-list-item>
            <s-list-item>No store automations</s-list-item>
          </s-unordered-list>
        </s-box>

        <s-box
          padding="large"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-heading>Pro</s-heading>
          <s-text>${PRO_PRICE_USD} / month</s-text>
          <s-unordered-list>
            <s-list-item>Unlimited profit scans</s-list-item>
            <s-list-item>Unlimited AI profit advisor</s-list-item>
            <s-list-item>Tag dead stock & top products</s-list-item>
            <s-list-item>Winners collection automation</s-list-item>
          </s-unordered-list>
          {!plan.isPro && !billingTestMode && (
            <>
              <s-button
                onClick={() => fetcher.submit({}, { method: "POST" })}
                {...(isLoading ? { loading: true } : {})}
              >
                Upgrade to Pro — ${PRO_PRICE_USD}/mo
              </s-button>
              <s-text type="generic">
                You approve the subscription in Shopify. Cancel anytime in
                Settings → Apps and sales channels.
              </s-text>
            </>
          )}
          {fetcher.data?.error && (
            <s-text tone="critical">{fetcher.data.error}</s-text>
          )}
        </s-box>
      </s-stack>

      <s-section heading="Billing & cancellation">
        <s-unordered-list>
          <s-list-item>
            Charges appear on your Shopify bill (not a separate card to us).
          </s-list-item>
          <s-list-item>
            Free plan: {FREE_SCANS_TOTAL} scan per store. Pro: $
            {PRO_PRICE_USD}/month until you cancel.
          </s-list-item>
          <s-list-item>
            Cancel: Shopify Admin → Settings → Apps and sales channels →
            uninstall or manage subscription.
          </s-list-item>
          <s-list-item>
            Profit figures are estimates based on Shopify catalog and order
            data unless you enter product costs.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section>
        <s-text type="generic">
          Current plan: {tier === "pro" ? "Pro" : "Free"} | Free scans
          remaining:{" "}
          {plan.scansRemaining === Infinity ? "∞" : plan.scansRemaining}
        </s-text>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
