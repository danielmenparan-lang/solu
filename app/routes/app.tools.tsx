import type { HeadersFunction, LoaderFunctionArgs } from "react-router";

import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

import { TOOL_CATALOG } from "../services/knowledge/tool-catalog";



export const loader = async ({ request }: LoaderFunctionArgs) => {

  await authenticate.admin(request);

  return { tools: TOOL_CATALOG };

};



export default function ToolsPage() {

  return (

    <s-page heading="Recommended tools">

      <s-section heading="Integrations that boost profit">

        <s-paragraph>

          The advisor suggests tools only when there is a clear business need —

          not every store needs every app.

        </s-paragraph>

      </s-section>



      <s-stack direction="block" gap="base">

        {TOOL_CATALOG.map((tool) => (

          <s-box

            key={tool.slug}

            padding="base"

            borderWidth="base"

            borderRadius="base"

          >

            <s-heading>{tool.name}</s-heading>

            <s-text type="generic">{tool.category}</s-text>

            <s-paragraph>{tool.description}</s-paragraph>

            <s-text type="strong">When to use: </s-text>

            <s-text>{tool.useCase}</s-text>

          </s-box>

        ))}

      </s-stack>

    </s-page>

  );

}



export const headers: HeadersFunction = (headersArgs) => {

  return boundary.headers(headersArgs);

};


