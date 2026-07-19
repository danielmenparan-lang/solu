import type { StoreSnapshot, ProductSummary } from "../../types/store-analysis";

interface ShopifyAdminClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

const SHOP_QUERY = `#graphql
  query ProfitBrainShop {
    shop {
      name
      myshopifyDomain
      currencyCode
    }
  }
`;

const PRODUCTS_QUERY = `#graphql
  query ProfitBrainProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          status
          vendor
          totalInventory
          descriptionHtml
          seo {
            title
            description
          }
          media(first: 10) {
            edges {
              node {
                id
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
                compareAtPrice
                inventoryItem {
                  unitCost {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const ORDERS_QUERY = `#graphql
  query ProfitBrainOrders($cursor: String) {
    orders(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
            }
          }
          displayFinancialStatus
          customer {
            id
          }
          shippingAddress {
            country
            countryCodeV2
          }
          lineItems(first: 50) {
            edges {
              node {
                quantity
                product {
                  id
                }
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
              }
            }
          }
          refunds(first: 10) {
            refundLineItems(first: 20) {
              edges {
                node {
                  quantity
                  lineItem {
                    product {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const ABANDONED_CHECKOUTS_QUERY = `#graphql
  query ProfitBrainAbandonedCheckouts {
    abandonedCheckouts(first: 50, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          createdAt
          totalPriceSet {
            shopMoney {
              amount
            }
          }
        }
      }
    }
  }
`;

function stripHtml(html: string | null | undefined): string {
  return (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function scanStore(
  admin: ShopifyAdminClient,
  shopDomain: string,
): Promise<StoreSnapshot> {
  const shopResponse = await admin.graphql(SHOP_QUERY);
  const shopJson = await shopResponse.json();
  const shop = shopJson.data!.shop!;

  const products: ProductSummary[] = [];
  const salesByProduct = new Map<string, { units: number; revenue: number }>();
  const refundsByProduct = new Map<string, number>();

  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const productsResponse = await admin.graphql(PRODUCTS_QUERY, {
      variables: { cursor },
    });
    const productsJson = await productsResponse.json();
    const connection = productsJson.data!.products!;

    for (const edge of connection.edges) {
      const node = edge.node;
      const variant = node.variants.edges[0]?.node;
      const description = stripHtml(node.descriptionHtml);

      products.push({
        id: node.id,
        title: node.title,
        status: node.status,
        vendor: node.vendor || "Unknown",
        totalInventory: node.totalInventory ?? 0,
        price: variant?.price ?? "0",
        compareAtPrice: variant?.compareAtPrice ?? null,
        unitCost: variant?.inventoryItem?.unitCost?.amount ?? null,
        totalSold: 0,
        revenue: 0,
        refundUnits: 0,
        hasSeoTitle: Boolean(node.seo?.title?.trim()),
        hasSeoDescription: Boolean(node.seo?.description?.trim()),
        descriptionLength: description.length,
        imageCount: node.media?.edges?.length ?? 0,
      });
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  let totalOrders = 0;
  let totalRevenue = 0;
  let refundCount = 0;
  let abandonedCheckoutCount = 0;
  let abandonedCheckoutValue = 0;
  const customerIds = new Set<string>();
  const customerOrderCount = new Map<string, number>();

  const countrySalesMap = new Map<
    string,
    { revenue: number; orderCount: number; shippingCost: number }
  >();

  try {
    let ordersCursor: string | null = null;
    let ordersHasNext = true;

    while (ordersHasNext) {
      const ordersResponse = await admin.graphql(ORDERS_QUERY, {
        variables: { cursor: ordersCursor },
      });
      const ordersJson = await ordersResponse.json();
      const connection = ordersJson.data?.orders;

      if (!connection) break;

      for (const edge of connection.edges) {
        const order = edge.node;
        const orderRevenue = parseFloat(order.totalPriceSet.shopMoney.amount);
        const shippingCost = parseFloat(
          order.totalShippingPriceSet?.shopMoney?.amount ?? "0",
        );
        totalOrders += 1;
        totalRevenue += orderRevenue;

        const country =
          order.shippingAddress?.country ||
          order.shippingAddress?.countryCodeV2 ||
          "Unknown";
        const countryStats = countrySalesMap.get(country) ?? {
          revenue: 0,
          orderCount: 0,
          shippingCost: 0,
        };
        countrySalesMap.set(country, {
          revenue: countryStats.revenue + orderRevenue,
          orderCount: countryStats.orderCount + 1,
          shippingCost: countryStats.shippingCost + shippingCost,
        });

        if (
          order.displayFinancialStatus === "REFUNDED" ||
          order.displayFinancialStatus === "PARTIALLY_REFUNDED"
        ) {
          refundCount += 1;
        }

        if (order.customer?.id) {
          customerIds.add(order.customer.id);
          customerOrderCount.set(
            order.customer.id,
            (customerOrderCount.get(order.customer.id) ?? 0) + 1,
          );
        }

        for (const lineEdge of order.lineItems.edges) {
          const line = lineEdge.node;
          const productId = line.product?.id;
          if (!productId) continue;

          const qty = line.quantity ?? 0;
          const lineRevenue =
            qty * parseFloat(line.originalUnitPriceSet.shopMoney.amount);

          const existing = salesByProduct.get(productId) ?? {
            units: 0,
            revenue: 0,
          };
          salesByProduct.set(productId, {
            units: existing.units + qty,
            revenue: existing.revenue + lineRevenue,
          });
        }

        for (const refund of order.refunds ?? []) {
          for (const refundLineEdge of refund.refundLineItems.edges) {
            const refundLine = refundLineEdge.node;
            const productId = refundLine.lineItem?.product?.id;
            if (!productId) continue;
            refundsByProduct.set(
              productId,
              (refundsByProduct.get(productId) ?? 0) + (refundLine.quantity ?? 0),
            );
          }
        }
      }

      ordersHasNext = connection.pageInfo.hasNextPage;
      ordersCursor = connection.pageInfo.endCursor;
    }
  } catch {
    // Orders scope may not be granted yet.
  }

  try {
    const abandonedResponse = await admin.graphql(ABANDONED_CHECKOUTS_QUERY);
    const abandonedJson = await abandonedResponse.json();
    const abandonedEdges = abandonedJson.data?.abandonedCheckouts?.edges ?? [];

    for (const edge of abandonedEdges) {
      abandonedCheckoutCount += 1;
      abandonedCheckoutValue += parseFloat(
        edge.node.totalPriceSet.shopMoney.amount,
      );
    }
  } catch {
    // Checkout scope may not be granted yet.
  }

  for (const product of products) {
    const sales = salesByProduct.get(product.id);
    product.totalSold = sales?.units ?? 0;
    product.revenue = sales?.revenue ?? 0;
    product.refundUnits = refundsByProduct.get(product.id) ?? 0;
  }

  const repeatCustomers = [...customerOrderCount.values()].filter(
    (count) => count > 1,
  ).length;

  return {
    shopName: shop.name,
    shopDomain: shop.myshopifyDomain ?? shopDomain,
    currency: shop.currencyCode,
    productCount: products.length,
    activeProductCount: products.filter((p) => p.status === "ACTIVE").length,
    products,
    orders: {
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      refundRate: totalOrders > 0 ? (refundCount / totalOrders) * 100 : 0,
      repeatCustomerRate:
        customerIds.size > 0 ? (repeatCustomers / customerIds.size) * 100 : 0,
      abandonedCheckoutCount,
      abandonedCheckoutValue,
    },
    countrySales: [...countrySalesMap.entries()].map(([country, stats]) => ({
      country,
      ...stats,
    })),
    scannedAt: new Date().toISOString(),
  };
}
