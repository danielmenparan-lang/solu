import Anthropic from "@anthropic-ai/sdk";
import type { ScanResult } from "../../types/store-analysis";
import {
  getAnthropicApiKey,
  getAnthropicModels,
} from "../agent/anthropic-config.server";
import { runGraphql } from "./product-automation.server";

interface ShopifyAdminClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

const PRODUCT_DESCRIPTION_QUERY = `#graphql
  query ProfitBrainProductDescription($id: ID!) {
    product(id: $id) {
      id
      title
      descriptionHtml
    }
  }
`;

const PRODUCT_UPDATE = `#graphql
  mutation ProfitBrainDescriptionUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id }
      userErrors { message }
    }
  }
`;

async function callAnthropic(prompt: string): Promise<string | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  for (const model of getAnthropicModels()) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 800,
        system:
          "You write Shopify product descriptions. Output plain HTML (p, ul, li). No guarantees or hype.",
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content.find((b) => b.type === "text");
      return block?.type === "text" ? block.text : null;
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchProductDescription(
  admin: ShopifyAdminClient,
  productId: string,
): Promise<{ title: string; descriptionHtml: string } | null> {
  const { data, errors } = await runGraphql<{
    product: { title: string; descriptionHtml: string } | null;
  }>(admin, PRODUCT_DESCRIPTION_QUERY, { id: productId });

  if (errors.length || !data?.product) return null;
  return data.product;
}

export async function generateImprovedDescription(
  productTitle: string,
  currentHtml: string,
  scan: ScanResult | null,
): Promise<{ descriptionHtml: string; summary: string }> {
  const plain = currentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const storeContext = scan
    ? `Store AOV: ${scan.snapshot.orders.averageOrderValue.toFixed(0)} ${scan.snapshot.currency}.`
    : "";

  const text = await callAnthropic(
    `Improve this product description for SEO and conversion.\nProduct: ${productTitle}\nCurrent: ${plain || "(empty)"}\n${storeContext}\nReturn JSON only: {"descriptionHtml":"...","summary":"one line what changed"}`,
  );

  if (text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          descriptionHtml: string;
          summary: string;
        };
        return {
          descriptionHtml: parsed.descriptionHtml,
          summary: parsed.summary,
        };
      }
    } catch {
      // fall through
    }
  }

  return {
    descriptionHtml: `<p><strong>${productTitle}</strong></p><p>Clear benefits for your customer. Add materials, sizing, and shipping details.</p><ul><li>Key benefit one</li><li>Key benefit two</li></ul>`,
    summary: "Starter template — edit before applying.",
  };
}

export async function applyProductDescription(
  admin: ShopifyAdminClient,
  productId: string,
  descriptionHtml: string,
): Promise<{ success: boolean; message: string; errors: string[] }> {
  const { errors } = await runGraphql(admin, PRODUCT_UPDATE, {
    input: { id: productId, descriptionHtml },
  });

  if (errors.length) {
    return { success: false, message: errors.join(", "), errors };
  }

  return {
    success: true,
    message: "Product description updated in your store.",
    errors: [],
  };
}
