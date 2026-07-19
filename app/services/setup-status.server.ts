import { getAnthropicApiKey } from "./agent/anthropic-config.server";

export interface AppSetupStatus {
  shopify: boolean;
  anthropic: boolean;
  readyForWow: boolean;
  blockers: string[];
}

export async function getAppSetupStatus(): Promise<AppSetupStatus> {
  const blockers: string[] = [];
  const apiKey = getAnthropicApiKey();

  let anthropic = false;
  if (!apiKey) {
    blockers.push("AI key missing — set ANTHROPIC_API_KEY on the server.");
  } else {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 5,
          messages: [{ role: "user", content: "OK" }],
        }),
      });
      anthropic = res.status === 200;
      if (!anthropic && res.status === 401) {
        blockers.push(
          "Invalid AI key — create a new key at console.anthropic.com",
        );
      } else if (!anthropic) {
        blockers.push("AI unavailable — check Anthropic billing/credits.");
      }
    } catch {
      blockers.push("Cannot reach Anthropic API.");
    }
  }

  return {
    shopify: Boolean(process.env.SHOPIFY_API_KEY),
    anthropic,
    readyForWow: anthropic,
    blockers,
  };
}
