-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "agentAutoExecute" BOOLEAN NOT NULL DEFAULT true,
    "autoSmsRecovery" BOOLEAN NOT NULL DEFAULT true,
    "smsConsentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
