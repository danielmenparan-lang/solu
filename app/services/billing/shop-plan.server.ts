import prisma from "../../db.server";

import type { ShopifyAdminClient } from "./usage-types";

import {

  getActivePlanTier,

  getPlanFeatures,

  isBillingTestMode,

} from "./billing.server";

import type { PlanTier, ShopPlanInfo } from "./plans";



export type { ShopifyAdminClient };



const DAY_MS = 24 * 60 * 60 * 1000;



export async function getShopPlanInfo(

  admin: ShopifyAdminClient,

  shop: string,

): Promise<ShopPlanInfo> {

  if (isBillingTestMode()) {

    return {

      tier: "pro",

      isPro: true,

      subscriptionName: "Profit Brain AI Pro (dev)",

      scansRemaining: Infinity,

      aiMessagesRemainingToday: Infinity,

    };

  }



  const tier = await getActivePlanTier(admin);

  const features = getPlanFeatures(tier);

  const dayAgo = new Date(Date.now() - DAY_MS);



  const [totalScanCount, aiCount] = await Promise.all([

    prisma.storeScan.count({ where: { shop } }),

    prisma.agentMessage.count({

      where: { shop, role: "user", createdAt: { gte: dayAgo } },

    }),

  ]);



  const scansRemaining =

    tier === "pro"

      ? Infinity

      : Math.max(0, features.scansTotal - totalScanCount);

  const aiRemaining =

    tier === "pro"

      ? Infinity

      : Math.max(0, features.aiMessagesPerDay - aiCount);



  return {

    tier,

    isPro: tier === "pro",

    subscriptionName: tier === "pro" ? "Profit Brain AI Pro" : null,

    scansRemaining,

    aiMessagesRemainingToday: aiRemaining,

  };

}



export async function assertCanScan(

  admin: ShopifyAdminClient,

  shop: string,

): Promise<{ allowed: boolean; reason?: string; plan: ShopPlanInfo }> {

  const plan = await getShopPlanInfo(admin, shop);

  if (plan.isPro || plan.scansRemaining > 0) {

    return { allowed: true, plan };

  }

  return {

    allowed: false,

    reason:

      "Free plan includes 1 store scan. Upgrade to Pro ($19/month) for unlimited scans.",

    plan,

  };

}



export async function assertProFeature(

  admin: ShopifyAdminClient,

  shop: string,

  feature: "automations" | "profitByCountry",

): Promise<{ allowed: boolean; reason?: string; plan: ShopPlanInfo }> {

  const plan = await getShopPlanInfo(admin, shop);



  if (isBillingTestMode()) {

    return { allowed: true, plan: { ...plan, isPro: true, tier: "pro" } };

  }



  const features = getPlanFeatures(plan.tier);



  const blocked =

    (feature === "automations" && !features.automations) ||

    (feature === "profitByCountry" && !features.profitByCountry);



  if (!blocked) return { allowed: true, plan };



  return {

    allowed: false,

    reason: "This feature requires Profit Brain AI Pro ($19/month).",

    plan,

  };

}



export async function assertCanChat(

  admin: ShopifyAdminClient,

  shop: string,

): Promise<{ allowed: boolean; reason?: string; plan: ShopPlanInfo }> {

  const plan = await getShopPlanInfo(admin, shop);

  if (plan.isPro || plan.aiMessagesRemainingToday > 0) {

    return { allowed: true, plan };

  }

  return {

    allowed: false,

    reason: "Free plan: 5 AI messages per day. Upgrade to Pro for unlimited.",

    plan,

  };

}



export function maskProData<T>(isPro: boolean, data: T, fallback: T): T {

  return isPro ? data : fallback;

}


