import type { PlanTier } from "./plans";
import { PLAN_FEATURES, PRO_PRICE_USD, PRO_TRIAL_DAYS } from "./plans";

interface ShopifyAdminClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

const ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
  query ProfitBrainActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        lineItems {
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_SUBSCRIPTION_MUTATION = `#graphql
  mutation ProfitBrainCreateSubscription(
    $name: String!
    $returnUrl: URL!
    $test: Boolean
    $trialDays: Int
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      trialDays: $trialDays
      lineItems: $lineItems
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

export function isBillingTestMode(): boolean {
  return (
    process.env.SHOPIFY_BILLING_TEST === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

export async function getActivePlanTier(
  admin: ShopifyAdminClient,
): Promise<PlanTier> {
  if (isBillingTestMode()) {
    return "pro";
  }

  try {
    const response = await admin.graphql(ACTIVE_SUBSCRIPTIONS_QUERY);
    const json = await response.json();
    const subs =
      json.data?.currentAppInstallation?.activeSubscriptions ?? [];

    const activePro = subs.find(
      (sub: { status: string; name: string }) =>
        sub.status === "ACTIVE" &&
        (sub.name.toLowerCase().includes("pro") ||
          sub.name.toLowerCase().includes("profit brain")),
    );

    return activePro ? "pro" : "free";
  } catch {
    return "free";
  }
}

export async function createProSubscription(
  admin: ShopifyAdminClient,
  shop: string,
  returnUrl: string,
): Promise<{ confirmationUrl: string | null; error: string | null }> {
  const variables: Record<string, unknown> = {
    name: "Profit Brain AI Pro",
    returnUrl,
    test: isBillingTestMode(),
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: PRO_PRICE_USD, currencyCode: "USD" },
            interval: "EVERY_30_DAYS",
          },
        },
      },
    ],
  };
  if (PRO_TRIAL_DAYS > 0) {
    variables.trialDays = PRO_TRIAL_DAYS;
  }

  const response = await admin.graphql(CREATE_SUBSCRIPTION_MUTATION, {
    variables,
  });

  const json = await response.json();
  const result = json.data?.appSubscriptionCreate;
  const userErrors = result?.userErrors ?? [];

  if (userErrors.length > 0) {
    return {
      confirmationUrl: null,
      error: userErrors.map((e: { message: string }) => e.message).join(", "),
    };
  }

  return {
    confirmationUrl: result?.confirmationUrl ?? null,
    error: null,
  };
}

export function getPlanFeatures(tier: PlanTier) {
  return PLAN_FEATURES[tier];
}

export function getProTrialDays(): number {
  return PRO_TRIAL_DAYS;
}
