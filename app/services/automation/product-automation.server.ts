interface ShopifyAdminClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export type AutomationAction =
  | "tag_dead_stock"
  | "tag_losing_products"
  | "tag_winning_products"
  | "draft_losing_products"
  | "create_winners_collection";

export interface AutomationResult {
  action: AutomationAction;
  success: boolean;
  affectedCount: number;
  message: string;
  errors: string[];
}

const TAG_DEAD_STOCK = "profit-brain:dead-stock";
const TAG_LOSING = "profit-brain:low-profit";
const TAG_WINNING = "profit-brain:top-profit";
const WINNERS_COLLECTION = "Profit Brain — Top Performers";

export async function runGraphql<T>(
  admin: ShopifyAdminClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data: T | null; errors: string[] }> {
  const response = await admin.graphql(query, { variables });
  const json = await response.json();

  const userErrors: string[] = [];
  const data = json.data as Record<string, { userErrors?: { message: string }[] }> | null;

  if (data) {
    for (const value of Object.values(data)) {
      value?.userErrors?.forEach((err) => userErrors.push(err.message));
    }
  }

  if (json.errors?.length) {
    json.errors.forEach((err: { message: string }) => userErrors.push(err.message));
  }

  return { data: json.data as T | null, errors: userErrors };
}

const TAGS_ADD = `#graphql
  mutation ProfitBrainTagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node { id }
      userErrors { message }
    }
  }
`;

const PRODUCT_UPDATE = `#graphql
  mutation ProfitBrainProductUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id status }
      userErrors { message }
    }
  }
`;

const COLLECTION_CREATE = `#graphql
  mutation ProfitBrainCollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id title }
      userErrors { message }
    }
  }
`;

async function tagProducts(
  admin: ShopifyAdminClient,
  productIds: string[],
  tag: string,
): Promise<AutomationResult> {
  let affectedCount = 0;
  const errors: string[] = [];

  for (const id of productIds) {
    const { errors: gqlErrors } = await runGraphql(admin, TAGS_ADD, {
      id,
      tags: [tag],
    });
    if (gqlErrors.length) {
      errors.push(...gqlErrors);
    } else {
      affectedCount += 1;
    }
  }

  return {
    action: "tag_dead_stock",
    success: errors.length === 0,
    affectedCount,
    message: `Tagged ${affectedCount} products with "${tag}"`,
    errors,
  };
}

async function draftProducts(
  admin: ShopifyAdminClient,
  productIds: string[],
): Promise<AutomationResult> {
  let affectedCount = 0;
  const errors: string[] = [];

  for (const id of productIds) {
    const { errors: gqlErrors } = await runGraphql(admin, PRODUCT_UPDATE, {
      input: { id, status: "DRAFT" },
    });
    if (gqlErrors.length) {
      errors.push(...gqlErrors);
    } else {
      affectedCount += 1;
    }
  }

  return {
    action: "draft_losing_products",
    success: errors.length === 0,
    affectedCount,
    message: `Moved ${affectedCount} products to draft`,
    errors,
  };
}

async function createWinnersCollection(
  admin: ShopifyAdminClient,
  productIds: string[],
): Promise<AutomationResult> {
  if (productIds.length === 0) {
    return {
      action: "create_winners_collection",
      success: false,
      affectedCount: 0,
      message: "No winning products to add",
      errors: ["No products"],
    };
  }

  const { data, errors } = await runGraphql<{
    collectionCreate: { collection: { id: string } | null };
  }>(admin, COLLECTION_CREATE, {
    input: {
      title: WINNERS_COLLECTION,
      ruleSet: {
        appliedDisjunctively: false,
        rules: [
          {
            column: "TAG",
            relation: "EQUALS",
            condition: TAG_WINNING,
          },
        ],
      },
    },
  });

  const created = Boolean(data?.collectionCreate?.collection?.id);

  return {
    action: "create_winners_collection",
    success: created && errors.length === 0,
    affectedCount: created ? productIds.length : 0,
    message: created
      ? `Created collection "${WINNERS_COLLECTION}"`
      : "Failed to create collection",
    errors,
  };
}

export async function runAutomation(
  admin: ShopifyAdminClient,
  action: AutomationAction,
  productIds: {
    deadStock: string[];
    losing: string[];
    winning: string[];
  },
): Promise<AutomationResult> {
  switch (action) {
    case "tag_dead_stock":
      return tagProducts(admin, productIds.deadStock, TAG_DEAD_STOCK);
    case "tag_losing_products":
      return tagProducts(admin, productIds.losing, TAG_LOSING);
    case "tag_winning_products":
      return tagProducts(admin, productIds.winning, TAG_WINNING);
    case "draft_losing_products":
      return draftProducts(admin, productIds.losing);
    case "create_winners_collection": {
      const tagResult = await tagProducts(admin, productIds.winning, TAG_WINNING);
      const collectionResult = await createWinnersCollection(
        admin,
        productIds.winning,
      );
      return {
        ...collectionResult,
        affectedCount: tagResult.affectedCount + collectionResult.affectedCount,
        message: `${tagResult.message}. ${collectionResult.message}`,
        errors: [...tagResult.errors, ...collectionResult.errors],
        success: tagResult.success && collectionResult.success,
      };
    }
    default:
      return {
        action,
        success: false,
        affectedCount: 0,
        message: "Unknown action",
        errors: ["Unknown action"],
      };
  }
}

export function getProductIdsFromScan(scan: {
  snapshot: {
    products: { id: string; status: string; totalSold: number }[];
  };
  kpis: {
    losingProducts: { productId: string }[];
    winningProducts: { productId: string }[];
    deadStockCount: number;
  };
}) {
  const deadStock = scan.snapshot.products
    .filter((p) => p.status === "ACTIVE" && p.totalSold === 0)
    .map((p) => p.id);

  return {
    deadStock,
    losing: scan.kpis.losingProducts.map((p) => p.productId),
    winning: scan.kpis.winningProducts.map((p) => p.productId),
  };
}
