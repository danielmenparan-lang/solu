import type {

  ActionFunctionArgs,

  HeadersFunction,

  LoaderFunctionArgs,

} from "react-router";

import { useFetcher, useLoaderData } from "react-router";

import { useEffect } from "react";

import { useAppBridge } from "@shopify/app-bridge-react";

import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

import prisma from "../db.server";

import { getLatestScan } from "../services/scan-orchestrator.server";

import {

  getProductIdsFromScan,

  runAutomation,

  type AutomationAction,

} from "../services/automation/product-automation.server";

import { assertProFeature, getShopPlanInfo } from "../services/billing/shop-plan.server";



const ACTIONS: {

  id: AutomationAction;

  title: string;

  description: string;

  tone: "info" | "warning" | "critical";

  confirm?: string;

}[] = [

  {

    id: "tag_dead_stock",

    title: "Tag dead stock products",

    description: 'Adds tag "profit-brain:dead-stock" to products with zero sales.',

    tone: "info",

  },

  {

    id: "tag_losing_products",

    title: "Tag low-profit products",

    description: 'Adds tag "profit-brain:low-profit" to estimated losing products.',

    tone: "warning",

  },

  {

    id: "tag_winning_products",

    title: "Tag top profit products",

    description: 'Adds tag "profit-brain:top-profit" to your best performers.',

    tone: "info",

  },

  {

    id: "create_winners_collection",

    title: "Create Top Performers collection",

    description: "Creates a smart collection for your highest-profit products.",

    tone: "info",

  },

  {

    id: "draft_losing_products",

    title: "Draft losing products",

    description: "Hides estimated losing products from the storefront. Requires confirmation.",

    tone: "critical",

    confirm: "I understand — move to draft",

  },

];



export const loader = async ({ request }: LoaderFunctionArgs) => {

  const { admin, session } = await authenticate.admin(request);

  const [latestScan, runs, plan] = await Promise.all([

    getLatestScan(session.shop),

    prisma.automationRun.findMany({

      where: { shop: session.shop },

      orderBy: { createdAt: "desc" },

      take: 10,

    }),

    getShopPlanInfo(admin, session.shop),

  ]);



  const productIds = latestScan

    ? getProductIdsFromScan(latestScan.scan)

    : { deadStock: [], losing: [], winning: [] };



  return { latestScan, productIds, runs, plan };

};



export const action = async ({ request }: ActionFunctionArgs) => {

  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();

  const actionType = formData.get("action") as AutomationAction;



  const latestScan = await getLatestScan(session.shop);

  if (!latestScan) {

    return { error: "Run a Profit Brain Scan before using automations." };

  }



  const proCheck = await assertProFeature(admin, session.shop, "automations");

  if (!proCheck.allowed) {

    return { error: proCheck.reason };

  }



  const productIds = getProductIdsFromScan(latestScan.scan);

  const result = await runAutomation(admin, actionType, productIds);



  await prisma.automationRun.create({

    data: {

      shop: session.shop,

      action: actionType,

      details: JSON.stringify(result),

      status: result.success ? "success" : "failed",

    },

  });



  return { result };

};



export default function AutomationsPage() {

  const { latestScan, productIds, runs, plan } = useLoaderData<typeof loader>();

  const fetcher = useFetcher<typeof action>();

  const shopify = useAppBridge();

  const isRunning = fetcher.state !== "idle";



  useEffect(() => {

    if (fetcher.data?.result?.success) {

      shopify.toast.show(fetcher.data.result.message);

    } else if (fetcher.data?.result && !fetcher.data.result.success) {

      shopify.toast.show("Action failed — check write_products scope", {

        isError: true,

      });

    }

  }, [fetcher.data, shopify]);



  const runAction = (actionId: AutomationAction) => {

    const formData = new FormData();

    formData.set("action", actionId);

    fetcher.submit(formData, { method: "POST" });

  };



  const counts: Record<AutomationAction, number> = {

    tag_dead_stock: productIds.deadStock.length,

    tag_losing_products: productIds.losing.length,

    tag_winning_products: productIds.winning.length,

    draft_losing_products: productIds.losing.length,

    create_winners_collection: productIds.winning.length,

  };



  return (

    <s-page heading="Automations">

      <s-section heading="You approve every change">

        <s-paragraph>

          Nothing changes in your store unless you click a button below. Profit

          Brain AI never edits products silently.

        </s-paragraph>

      </s-section>



      {!latestScan && (

        <s-banner tone="warning">

          Run a Profit Brain Scan first.

          <s-link href="/app"> Dashboard</s-link>

        </s-banner>

      )}



      {!plan?.isPro && latestScan && (

        <s-banner tone="warning">

          Automations require Pro ($19/mo).{" "}

          <s-link href="/app/billing">Upgrade</s-link>

        </s-banner>

      )}



      {latestScan && (

        <s-stack direction="block" gap="base">

          {ACTIONS.map((item) => (

            <s-box

              key={item.id}

              padding="base"

              borderWidth="base"

              borderRadius="base"

            >

              <s-heading>{item.title}</s-heading>

              <s-paragraph>{item.description}</s-paragraph>

              <s-text type="generic">

                Up to {counts[item.id]} products affected

              </s-text>

              <s-button

                onClick={() => runAction(item.id)}

                {...(isRunning ? { loading: true } : {})}

                {...(item.tone === "critical" ? { tone: "critical" } : {})}

              >

                {item.confirm ?? "Run"}

              </s-button>

            </s-box>

          ))}

        </s-stack>

      )}



      {runs.length > 0 && (

        <s-section heading="Run history">

          <s-stack direction="block" gap="base">

            {runs.map((run) => (

              <s-box

                key={run.id}

                padding="base"

                borderWidth="base"

                borderRadius="base"

                background="subdued"

              >

                <s-text type="strong">{run.action}</s-text>

                <s-text>

                  {run.status} — {run.createdAt.toLocaleString()}

                </s-text>

              </s-box>

            ))}

          </s-stack>

        </s-section>

      )}

    </s-page>

  );

}



export const headers: HeadersFunction = (headersArgs) => {

  return boundary.headers(headersArgs);

};


