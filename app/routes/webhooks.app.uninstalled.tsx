import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteAllShopData } from "../services/shop-data-cleanup.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await deleteAllShopData(shop);

  if (session) {
    console.log(`Session already cleared for ${shop} via deleteAllShopData`);
  }

  return new Response();
};
