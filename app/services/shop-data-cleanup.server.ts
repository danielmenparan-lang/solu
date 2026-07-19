import prisma from "../db.server";

/** Deletes all app-owned data for a shop (GDPR / uninstall). */
export async function deleteAllShopData(shop: string): Promise<void> {
  await prisma.$transaction([
    prisma.recommendation.deleteMany({ where: { shop } }),
    prisma.storeScan.deleteMany({ where: { shop } }),
    prisma.agentMessage.deleteMany({ where: { shop } }),
    prisma.automationRun.deleteMany({ where: { shop } }),
    prisma.smsRecoveryLog.deleteMany({ where: { shop } }),
    prisma.shopSettings.deleteMany({ where: { shop } }),
    prisma.session.deleteMany({ where: { shop } }),
  ]);
}

/** Removes customer PII stored by this app (SMS recovery logs). */
export async function redactCustomerData(
  shop: string,
  phone?: string | null,
): Promise<number> {
  if (!phone?.trim()) return 0;

  const normalized = normalizePhone(phone);
  const logs = await prisma.smsRecoveryLog.findMany({
    where: { shop },
    select: { id: true, phone: true },
  });

  const ids = logs
    .filter((log) => normalizePhone(log.phone) === normalized)
    .map((log) => log.id);

  if (ids.length === 0) return 0;

  await prisma.smsRecoveryLog.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

export async function getCustomerDataForExport(
  shop: string,
  phone?: string | null,
  email?: string | null,
) {
  const normalizedPhone = phone ? normalizePhone(phone) : null;

  const smsLogs = await prisma.smsRecoveryLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const matchingSms = smsLogs.filter((log) => {
    if (normalizedPhone && normalizePhone(log.phone) === normalizedPhone) {
      return true;
    }
    if (email && log.message.toLowerCase().includes(email.toLowerCase())) {
      return true;
    }
    return false;
  });

  return {
    smsRecoveryLogs: matchingSms.map((log) => ({
      checkoutId: log.checkoutId,
      phone: log.phone,
      message: log.message,
      status: log.status,
      sentAt: log.createdAt.toISOString(),
    })),
  };
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
