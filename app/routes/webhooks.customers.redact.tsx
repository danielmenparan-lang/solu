import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { redactCustomerData } from "../services/shop-data-cleanup.server";

interface CustomerRedactPayload {
  customer?: {
    id?: number;
    email?: string;
    phone?: string;
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] ${topic} for ${shop}`);

  const data = payload as CustomerRedactPayload;
  const deleted = await redactCustomerData(shop, data.customer?.phone ?? null);

  console.log(`[GDPR] customers/redact removed ${deleted} SMS log(s) for ${shop}`);

  return new Response();
};
