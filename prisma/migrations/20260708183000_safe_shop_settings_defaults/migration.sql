-- Safe defaults: automations and SMS require explicit merchant opt-in
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "agentAutoExecute" BOOLEAN NOT NULL DEFAULT false,
    "autoSmsRecovery" BOOLEAN NOT NULL DEFAULT false,
    "smsConsentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "smsTemplate" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ShopSettings" ("shop", "agentAutoExecute", "autoSmsRecovery", "smsConsentConfirmed", "smsTemplate", "updatedAt")
SELECT "shop", "agentAutoExecute", "autoSmsRecovery", "smsConsentConfirmed", "smsTemplate", "updatedAt" FROM "ShopSettings";
DROP TABLE "ShopSettings";
ALTER TABLE "new_ShopSettings" RENAME TO "ShopSettings";
PRAGMA foreign_keys=ON;
