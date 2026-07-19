import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getCustomerDataForExport } from "../services/shop-data-cleanup.server";

interface CustomerDataRequestPayload {
  customer?: {
    id?: number;
    email?: string;
    phone?: string;
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] ${topic} for ${shop}`);

  const data = payload as CustomerDataRequestPayload;
  const exportData = await getCustomerDataForExport(
    shop,
    data.customer?.phone ?? null,
    data.customer?.email ?? null,
  );

  console.log(
    `[GDPR] customers/data_request for ${shop} customer ${data.customer?.id ?? "unknown"}:`,
    JSON.stringify(exportData),
  );

  return new Response(JSON.stringify({ data: exportData }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
