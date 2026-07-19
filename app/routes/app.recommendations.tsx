import type {

  ActionFunctionArgs,

  HeadersFunction,

  LoaderFunctionArgs,

} from "react-router";

import { useLoaderData } from "react-router";

import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

import { getRecommendations } from "../services/scan-orchestrator.server";



const PRIORITY_LABELS: Record<string, string> = {

  critical: "Critical",

  high: "High",

  medium: "Medium",

  low: "Low",

};



const CATEGORY_LABELS: Record<string, string> = {

  products: "Products",

  marketing: "Marketing",

  costs: "Costs",

  tools: "Tools",

  inventory: "Inventory",

  pricing: "Pricing",

};



export const loader = async ({ request }: LoaderFunctionArgs) => {

  const { session } = await authenticate.admin(request);

  const recommendations = await getRecommendations(session.shop);

  return { recommendations };

};



export default function Recommendations() {

  const { recommendations } = useLoaderData<typeof loader>();



  return (

    <s-page heading="Recommendations">

      {recommendations.length === 0 ? (

        <s-section>

          <s-paragraph>

            No recommendations yet. Run a store scan to get tailored actions.

            <s-link href="/app"> Run scan now</s-link>

          </s-paragraph>

        </s-section>

      ) : (

        <s-stack direction="block" gap="base">

          {recommendations.map((rec: (typeof recommendations)[number]) => (

            <s-box

              key={rec.id}

              padding="base"

              borderWidth="base"

              borderRadius="base"

            >

              <s-stack direction="inline" gap="base">

                <s-badge tone={rec.priority === "critical" ? "critical" : "info"}>

                  {PRIORITY_LABELS[rec.priority] ?? rec.priority}

                </s-badge>

                <s-badge>

                  {CATEGORY_LABELS[rec.category] ?? rec.category}

                </s-badge>

              </s-stack>

              <s-heading>{rec.title}</s-heading>

              <s-paragraph>{rec.description}</s-paragraph>

              <s-text type="generic">Expected impact: {rec.impact}</s-text>

            </s-box>

          ))}

        </s-stack>

      )}

    </s-page>

  );

}



export const headers: HeadersFunction = (headersArgs) => {

  return boundary.headers(headersArgs);

};


