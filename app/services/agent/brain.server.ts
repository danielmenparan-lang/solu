import Anthropic from "@anthropic-ai/sdk";
import type { ScanResult, RecommendationInput } from "../../types/store-analysis";
import {
  PROFIT_BRAIN_SYSTEM_PROMPT,
  SCAN_ANALYSIS_PROMPT,
  AGENT_ACTION_PROMPT,
} from "./prompts";
import { getKnowledgeContext } from "../knowledge/knowledge-base.server";
import { getToolBySlug } from "../knowledge/tool-catalog";
import {
  getAnthropicApiKey,
  getAnthropicKeyHelpMessage,
  getAnthropicModels,
} from "./anthropic-config.server";

function getAnthropicClient() {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function getAnthropicErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;

  const message = error.message.toLowerCase();
  if (message.includes("credit balance is too low")) {
    return "Your Anthropic account has no credits. Add billing at console.anthropic.com → Plans & Billing.";
  }
  if (
    message.includes("invalid x-api-key") ||
    message.includes("authentication")
  ) {
    return getAnthropicKeyHelpMessage();
  }
  if (message.includes("not_found_error") && message.includes("model")) {
    return "AI model unavailable. Set ANTHROPIC_MODEL in server env (e.g. claude-sonnet-4-6).";
  }

  return null;
}

async function createAnthropicMessage(
  params: Omit<Anthropic.MessageCreateParams, "model">,
): Promise<Anthropic.Message> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("missing_api_key");
  }

  let lastError: unknown;
  for (const model of getAnthropicModels()) {
    try {
      return (await client.messages.create({
        ...params,
        model,
      })) as Anthropic.Message;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      if (msg.includes("not_found") && msg.includes("model")) continue;
      throw error;
    }
  }

  throw lastError ?? new Error("no_model_available");
}

interface AiAnalysisResult {
  summary: string;
  criticalIssues: string[];
  immediateActions: string[];
  recommendations: RecommendationInput[];
  successProbability: {
    current: number;
    potential: number;
    reasoning: string;
  };
}

function parseAiResponse(text: string): AiAnalysisResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as AiAnalysisResult;
  } catch {
    return null;
  }
}

function fallbackRecommendations(scan: ScanResult): RecommendationInput[] {
  const recs: RecommendationInput[] = [];

  if (scan.kpis.deadStockCount > 0) {
    recs.push({
      category: "inventory",
      title: "Clear dead stock",
      description: `${scan.kpis.deadStockCount} active products have zero sales. Remove or stop promoting them.`,
      impact: "Sharper marketing focus and better margins",
      priority: "high",
    });
  }

  if (scan.snapshot.orders.repeatCustomerRate < 25) {
    recs.push({
      category: "marketing",
      title: "Win-back repeat customers",
      description: "Set up email flows for one-time buyers.",
      impact: "May improve repeat revenue (estimated, not guaranteed)",
      priority: "high",
      toolSlug: "klaviyo",
    });
  }

  if (scan.snapshot.activeProductCount > 50) {
    recs.push({
      category: "products",
      title: "Trim the catalog",
      description: "Focus on revenue-driving products. Remove low performers.",
      impact: "Easier ops and focused marketing",
      priority: "medium",
    });
  }

  return recs;
}

export async function analyzeWithAgent(
  scan: ScanResult,
): Promise<AiAnalysisResult> {
  if (!getAnthropicApiKey()) {
    return {
      summary: `Profitability score: ${scan.kpis.profitabilityScore}/100. ${scan.kpis.wasteAreas[0] ?? "Keep analyzing your store."}`,
      criticalIssues: scan.kpis.wasteAreas.slice(0, 3),
      immediateActions: [
        getAnthropicKeyHelpMessage(),
        "Review products with zero sales",
        "Check repeat customer rate",
      ],
      recommendations: fallbackRecommendations(scan),
      successProbability: {
        current: Math.round(scan.kpis.profitabilityScore * 0.2),
        potential: 55,
        reasoning: "Basic analysis without AI — add a valid Anthropic API key",
      },
    };
  }

  const knowledge = getKnowledgeContext();
  const storeData = JSON.stringify(scan, null, 2);

  try {
    const response = await createAnthropicMessage({
      max_tokens: 4096,
      system: `${PROFIT_BRAIN_SYSTEM_PROMPT}\n\n${knowledge}`,
      messages: [
        {
          role: "user",
          content: `${SCAN_ANALYSIS_PROMPT}\n\nStore data:\n${storeData}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const parsed =
      textBlock?.type === "text" ? parseAiResponse(textBlock.text) : null;

    if (parsed) {
      parsed.recommendations = parsed.recommendations.map((rec) => {
        if (rec.toolSlug) {
          const tool = getToolBySlug(rec.toolSlug);
          if (tool) {
            rec.description += ` Recommended tool: ${tool.name} — ${tool.useCase}`;
          }
        }
        return rec;
      });
      return parsed;
    }

    return {
      summary:
        textBlock?.type === "text"
          ? textBlock.text.slice(0, 500)
          : "Analysis complete",
      criticalIssues: scan.kpis.wasteAreas.slice(0, 3),
      immediateActions: [],
      recommendations: fallbackRecommendations(scan),
      successProbability: {
        current: 20,
        potential: 50,
        reasoning: "Partial analysis",
      },
    };
  } catch (error) {
    const apiMessage = getAnthropicErrorMessage(error);

    return {
      summary: apiMessage ?? "Anthropic connection error. Basic analysis applied.",
      criticalIssues: scan.kpis.wasteAreas.slice(0, 3),
      immediateActions: apiMessage
        ? [apiMessage]
        : ["Try again in a few minutes"],
      recommendations: fallbackRecommendations(scan),
      successProbability: {
        current: Math.round(scan.kpis.profitabilityScore * 0.2),
        potential: 55,
        reasoning: apiMessage ?? "AI analysis unavailable",
      },
    };
  }
}

export interface AgentChatResult {
  reply: string;
  suggestedActions: string[];
}

export async function chatWithAgent(
  shop: string,
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  latestScan?: ScanResult | null,
  executeMode = false,
): Promise<AgentChatResult> {
  if (!getAnthropicApiKey()) {
    return {
      reply: getAnthropicKeyHelpMessage(),
      suggestedActions: [],
    };
  }

  const knowledge = getKnowledgeContext();
  const scanContext = latestScan
    ? `\n\nLatest scan data:\n${JSON.stringify(latestScan, null, 2)}`
    : "";

  const actionInstructions = executeMode
    ? `\n\n${AGENT_ACTION_PROMPT}`
    : `\n\nIf the user asks to run an action (tags, automation) — append JSON:\n{"actions":["tag_dead_stock"]}`;

  try {
    const response = await createAnthropicMessage({
      max_tokens: 2048,
      system: `${PROFIT_BRAIN_SYSTEM_PROMPT}\n\n${knowledge}${scanContext}\n\nShop: ${shop}${actionInstructions}`,
      messages: [
        ...history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: message },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const raw =
      textBlock?.type === "text" ? textBlock.text : "No response received.";

    const { parseActionsFromAgentText } = await import(
      "./agent-executor.server"
    );
    const suggestedActions = parseActionsFromAgentText(raw).map(String);
    const reply = raw.replace(/```json[\s\S]*?```/g, "").trim();

    return { reply, suggestedActions };
  } catch (error) {
    return {
      reply:
        getAnthropicErrorMessage(error) ??
        "Anthropic connection error. Try again in a few minutes.",
      suggestedActions: [],
    };
  }
}

export type { AiAnalysisResult };
