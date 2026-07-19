import prisma from "../../db.server";
import {
  getProductIdsFromScan,
  runAutomation,
  type AutomationAction,
} from "../automation/product-automation.server";
import type { ScanResult } from "../../types/store-analysis";

interface ShopifyAdminClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export type AgentExecutableAction = AutomationAction;

export interface ExecutedActionResult {
  action: AgentExecutableAction;
  success: boolean;
  message: string;
  details?: string;
}

export const SAFE_AUTO_ACTIONS: AgentExecutableAction[] = [
  "tag_dead_stock",
  "tag_winning_products",
];

export function parseActionsFromAgentText(text: string): AgentExecutableAction[] {
  const actions: AgentExecutableAction[] = [];
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const source = jsonMatch?.[1] ?? text;

  try {
    const parsed = JSON.parse(source.match(/\{[\s\S]*\}/)?.[0] ?? source) as {
      actions?: string[];
    };
    if (Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {
        if (isValidAction(action)) actions.push(action);
      }
      return actions;
    }
  } catch {
    // fall through to keyword detection
  }

  const lower = text.toLowerCase();
  if (lower.includes("dead stock") || lower.includes("מוצרים מתים")) {
    actions.push("tag_dead_stock");
  }
  if (lower.includes("מפסיד") || lower.includes("losing")) {
    actions.push("tag_losing_products");
  }
  if (lower.includes("מרוויח") || lower.includes("winning")) {
    actions.push("tag_winning_products");
  }
  if (lower.includes("קולקציה") || lower.includes("collection")) {
    actions.push("create_winners_collection");
  }

  return [...new Set(actions)];
}

function isValidAction(value: string): value is AgentExecutableAction {
  return [
    "tag_dead_stock",
    "tag_losing_products",
    "tag_winning_products",
    "draft_losing_products",
    "create_winners_collection",
  ].includes(value);
}

export async function executeAgentAction(
  admin: ShopifyAdminClient,
  shop: string,
  action: AgentExecutableAction,
  scan: ScanResult | null,
): Promise<ExecutedActionResult> {
  if (!scan) {
    return {
      action,
      success: false,
      message: "No scan yet — run Profit Brain Scan first",
    };
  }

  const productIds = getProductIdsFromScan(scan);
  const result = await runAutomation(admin, action, productIds);

  await prisma.automationRun.create({
    data: {
      shop,
      action,
      details: JSON.stringify(result),
      status: result.success ? "success" : "failed",
    },
  });

  return {
    action,
    success: result.success,
    message: result.message,
    details: result.errors.length ? result.errors.join("; ") : undefined,
  };
}

export async function executeAgentActions(
  admin: ShopifyAdminClient,
  shop: string,
  actions: AgentExecutableAction[],
  scan: ScanResult | null,
): Promise<ExecutedActionResult[]> {
  const results: ExecutedActionResult[] = [];
  for (const action of actions) {
    results.push(await executeAgentAction(admin, shop, action, scan));
  }
  return results;
}

export async function autoExecuteAfterScan(
  admin: ShopifyAdminClient,
  shop: string,
  scan: ScanResult,
  options: {
    autoExecute: boolean;
  },
): Promise<ExecutedActionResult[]> {
  if (!options.autoExecute) return [];

  const actions: AgentExecutableAction[] = [];

  if (scan.kpis.deadStockCount > 0) {
    actions.push("tag_dead_stock");
  }
  if (scan.kpis.winningProducts.length > 0) {
    actions.push("tag_winning_products");
  }

  const toRun = actions.filter((a) => SAFE_AUTO_ACTIONS.includes(a));
  return executeAgentActions(admin, shop, toRun, scan);
}
