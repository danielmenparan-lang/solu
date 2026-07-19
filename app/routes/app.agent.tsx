import type {

  ActionFunctionArgs,

  HeadersFunction,

  LoaderFunctionArgs,

} from "react-router";

import { useFetcher, useLoaderData } from "react-router";

import { useState, useEffect } from "react";

import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

import {

  getAgentHistory,

  getLatestScan,

  saveAgentMessage,

} from "../services/scan-orchestrator.server";

import { chatWithAgent } from "../services/agent/brain.server";

import {

  assertCanChat,

  assertProFeature,

} from "../services/billing/shop-plan.server";

import {

  executeAgentActions,

  parseActionsFromAgentText,

  SAFE_AUTO_ACTIONS,

  type AgentExecutableAction,

} from "../services/agent/agent-executor.server";

import {

  getShopSettings,

  updateShopSettings,

} from "../services/shop-settings.server";



export const loader = async ({ request }: LoaderFunctionArgs) => {

  const { session } = await authenticate.admin(request);

  const [history, latestScan, settings] = await Promise.all([

    getAgentHistory(session.shop),

    getLatestScan(session.shop),

    getShopSettings(session.shop),

  ]);



  return {

    history,

    latestScan: latestScan?.scan ?? null,

    settings,

  };

};



export const action = async ({ request }: ActionFunctionArgs) => {

  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();

  const intent = formData.get("intent") as string;



  if (intent === "save_settings") {

    const settings = await updateShopSettings(session.shop, {

      agentAutoExecute: formData.get("agentAutoExecute") === "true",

    });

    return { settingsSaved: true, settings };

  }



  const message = formData.get("message") as string;

  if (!message?.trim()) {

    return { error: "Message is empty" };

  }



  const chatCheck = await assertCanChat(admin, session.shop);

  if (!chatCheck.allowed) {

    return { error: chatCheck.reason, plan: chatCheck.plan };

  }



  const settings = await getShopSettings(session.shop);

  const history = await getAgentHistory(session.shop);

  const latestScan = await getLatestScan(session.shop);



  await saveAgentMessage(session.shop, "user", message);



  const { reply, suggestedActions } = await chatWithAgent(

    session.shop,

    message,

    history.map((h: { role: string; content: string }) => ({

      role: h.role as "user" | "assistant",

      content: h.content,

    })),

    latestScan?.scan ?? null,

    settings.agentAutoExecute,

  );



  let executedActions: Awaited<ReturnType<typeof executeAgentActions>> = [];

  const actionsFromText = parseActionsFromAgentText(message);

  const allActions = [

    ...new Set([

      ...suggestedActions,

      ...actionsFromText,

    ] as AgentExecutableAction[]),

  ];



  if (settings.agentAutoExecute && allActions.length > 0) {

    const proCheck = await assertProFeature(

      admin,

      session.shop,

      "automations",

    );

    if (proCheck.allowed) {

      const runnable = allActions.filter(

        (a) => SAFE_AUTO_ACTIONS.includes(a),

      ) as AgentExecutableAction[];



      if (runnable.length > 0) {

        executedActions = await executeAgentActions(

          admin,

          session.shop,

          runnable,

          latestScan?.scan ?? null,

        );

      }

    }

  }



  let fullReply = reply;

  if (executedActions.length > 0) {

    const actionSummary = executedActions

      .map((r) => `✓ ${r.action}: ${r.message}`)

      .join("\n");

    fullReply = `${reply}\n\n**Actions completed:**\n${actionSummary}`;

  }



  await saveAgentMessage(session.shop, "assistant", fullReply);



  return { reply: fullReply, executedActions };

};



type ChatMessage = {

  id: string;

  role: string;

  content: string;

  createdAt: Date;

};



export default function AgentChat() {

  const { history, latestScan, settings } =

    useLoaderData<typeof loader>();

  const fetcher = useFetcher<typeof action>();

  const settingsFetcher = useFetcher<typeof action>();

  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>(history);

  const [autoExecute, setAutoExecute] = useState(settings.agentAutoExecute);



  useEffect(() => {

    if (fetcher.data?.reply) {

      setMessages((prev: ChatMessage[]) => [

        ...prev,

        {

          id: `assistant-${Date.now()}`,

          role: "assistant",

          content: fetcher.data!.reply!,

          createdAt: new Date(),

        },

      ]);

    }

  }, [fetcher.data]);



  const sendMessage = () => {

    if (!input.trim()) return;



    setMessages((prev: ChatMessage[]) => [

      ...prev,

      {

        id: `user-${Date.now()}`,

        role: "user",

        content: input,

        createdAt: new Date(),

      },

    ]);



    const formData = new FormData();

    formData.set("message", input);

    fetcher.submit(formData, { method: "POST" });

    setInput("");

  };



  const saveSettings = () => {

    const formData = new FormData();

    formData.set("intent", "save_settings");

    formData.set("agentAutoExecute", String(autoExecute));

    settingsFetcher.submit(formData, { method: "POST" });

  };



  const isLoading = fetcher.state === "submitting";



  return (

    <s-page heading="AI Profit Advisor">

      {!latestScan && (

        <s-banner tone="warning">

          Run a store scan first so the advisor can use real data.

          <s-link href="/app"> Run scan</s-link>

        </s-banner>

      )}



      <s-section heading="Automation settings (opt-in)">

        <s-paragraph>

          When enabled, the advisor can <s-text type="strong">run approved actions</s-text>{" "}

          (product tags) — only safe actions run automatically.

        </s-paragraph>

        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>

          <input

            type="checkbox"

            checked={autoExecute}

            onChange={(e) => setAutoExecute(e.target.checked)}

          />

          <span>Auto-run safe store actions after chat</span>

        </label>

        <s-button onClick={saveSettings}>Save settings</s-button>

      </s-section>



      <s-section heading="Chat">

        <s-stack direction="block" gap="base">

          {messages.length === 0 && (

            <s-paragraph>

              Try: &quot;What should I fix first?&quot; or &quot;Tag my dead stock

              products&quot;

            </s-paragraph>

          )}



          {messages.map((msg: ChatMessage) => (

            <s-box

              key={msg.id}

              padding="base"

              borderWidth="base"

              borderRadius="base"

              background={msg.role === "user" ? "subdued" : undefined}

            >

              <s-text type="strong">

                {msg.role === "user" ? "You" : "Profit Brain"}:

              </s-text>

              <s-paragraph>{msg.content}</s-paragraph>

            </s-box>

          ))}



          {isLoading && <s-text>Thinking...</s-text>}

        </s-stack>

      </s-section>



      <s-section>

        <s-stack direction="inline" gap="base">

          <input

            type="text"

            value={input}

            onChange={(e) => setInput(e.target.value)}

            onKeyDown={(e) => e.key === "Enter" && sendMessage()}

            placeholder="Ask about profit, products, or automations..."

            style={{

              flex: 1,

              padding: "8px 12px",

              borderRadius: "8px",

              border: "1px solid #ccc",

            }}

          />

          <s-button onClick={sendMessage} {...(isLoading ? { loading: true } : {})}>

            Send

          </s-button>

        </s-stack>

      </s-section>

    </s-page>

  );

}



export const headers: HeadersFunction = (headersArgs) => {

  return boundary.headers(headersArgs);

};


