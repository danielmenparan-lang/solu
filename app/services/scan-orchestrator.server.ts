import prisma from "../db.server";
import type { ScanResult, RecommendationInput } from "../types/store-analysis";
import { scanStore } from "./scanner/store-scanner.server";
import { buildScanResult } from "./analyzer/profitability-analyzer.server";
import { analyzeWithAgent } from "./agent/brain.server";
import { autoExecuteAfterScan } from "./agent/agent-executor.server";
import { getShopSettings } from "./shop-settings.server";
import type { ExecutedActionResult } from "./agent/agent-executor.server";

export async function runFullStoreScan(
  admin: Parameters<typeof scanStore>[0],
  shop: string,
) {
  const snapshot = await scanStore(admin, shop);
  const scanResult = buildScanResult(snapshot);
  const aiAnalysis = await analyzeWithAgent(scanResult);
  const settings = await getShopSettings(shop);

  const savedScan = await prisma.storeScan.create({
    data: {
      shop,
      snapshot: JSON.stringify(scanResult.snapshot),
      kpis: JSON.stringify(scanResult.kpis),
    },
  });

  if (aiAnalysis.recommendations.length > 0) {
    await prisma.recommendation.createMany({
      data: aiAnalysis.recommendations.map((rec: RecommendationInput) => ({
        shop,
        scanId: savedScan.id,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        priority: rec.priority,
        toolSlug: rec.toolSlug ?? null,
      })),
    });
  }

  let executedActions: ExecutedActionResult[] = [];
  if (settings.agentAutoExecute) {
    executedActions = await autoExecuteAfterScan(admin, shop, scanResult, {
      autoExecute: settings.agentAutoExecute,
    });
  }

  return {
    scanId: savedScan.id,
    scanResult,
    aiAnalysis,
    executedActions,
  };
}

export async function getLatestScan(shop: string): Promise<{
  scan: ScanResult;
  scanId: string;
  createdAt: Date;
} | null> {
  const latest = await prisma.storeScan.findFirst({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return null;

  return {
    scanId: latest.id,
    createdAt: latest.createdAt,
    scan: {
      snapshot: JSON.parse(latest.snapshot),
      kpis: JSON.parse(latest.kpis),
    },
  };
}

export async function getRecommendations(shop: string) {
  return prisma.recommendation.findMany({
    where: { shop },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export async function getAgentHistory(shop: string, limit = 20) {
  return prisma.agentMessage.findMany({
    where: { shop },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function saveAgentMessage(
  shop: string,
  role: "user" | "assistant",
  content: string,
) {
  return prisma.agentMessage.create({
    data: { shop, role, content },
  });
}
