import prisma from "../db.server";

export interface ShopAgentSettings {
  shop: string;
  agentAutoExecute: boolean;
}

const DEFAULTS: Omit<ShopAgentSettings, "shop"> = {
  agentAutoExecute: false,
};

export async function getShopSettings(shop: string): Promise<ShopAgentSettings> {
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  if (!row) {
    return { shop, ...DEFAULTS };
  }
  return {
    shop,
    agentAutoExecute: row.agentAutoExecute,
  };
}

export async function updateShopSettings(
  shop: string,
  patch: Partial<Omit<ShopAgentSettings, "shop">>,
): Promise<ShopAgentSettings> {
  const row = await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      agentAutoExecute: patch.agentAutoExecute ?? DEFAULTS.agentAutoExecute,
    },
    update: patch,
  });

  return {
    shop,
    agentAutoExecute: row.agentAutoExecute,
  };
}
