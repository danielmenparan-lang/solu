import { readFileSync } from "fs";

function env(name) {
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") ?? "";
}

const checks = [];

checks.push({
  name: "Shopify API",
  ok: Boolean(env("SHOPIFY_API_KEY") && env("SHOPIFY_API_SECRET")),
});

const anthropicKey = env("ANTHROPIC_API_KEY");
if (!anthropicKey) {
  checks.push({ name: "Anthropic AI", ok: false, note: "חסר מפתח" });
} else {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 5,
      messages: [{ role: "user", content: "OK" }],
    }),
  });
  checks.push({
    name: "Anthropic AI",
    ok: res.status === 200,
    note: res.status === 200 ? "עובד" : res.status === 401 ? "מפתח לא תקין" : "שגיאה",
  });
}

checks.push({
  name: "Billing (dev)",
  ok: env("SHOPIFY_BILLING_TEST") === "true",
  note: "Pro פתוח בלי תשלום אמיתי",
});

console.log("=== Profit Brain — בדיקת חיבורים ===");
for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.note ? " — " + c.note : ""}`);
}
const allCore = checks.every((c) => c.ok);
console.log(allCore ? "\nREADY: מוכן לניסיון מלא" : "\nBLOCKED: תקן את הסימונים ✗");
