export type PlanTier = "free" | "pro";



export const PRO_PRICE_USD = 19;

/** Free plan includes one lifetime store scan per shop. */

export const FREE_SCANS_TOTAL = 1;

/** No separate Pro trial — merchants try with 1 free scan, then subscribe. */

export const PRO_TRIAL_DAYS = 0;



export const PLAN_FEATURES = {

  free: {

    scansTotal: FREE_SCANS_TOTAL,

    aiMessagesPerDay: 5,

    automations: false,

    fullScores: true,

    profitByCountry: false,

    agentDeepAnalysis: false,

  },

  pro: {

    scansTotal: Infinity,

    aiMessagesPerDay: Infinity,

    automations: true,

    fullScores: true,

    profitByCountry: true,

    agentDeepAnalysis: true,

  },

} as const;



export interface ShopPlanInfo {

  tier: PlanTier;

  isPro: boolean;

  subscriptionName: string | null;

  scansRemaining: number;

  aiMessagesRemainingToday: number;

}


