const ANTHROPIC_MODELS = [
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
] as const;

export function getAnthropicApiKey(): string | null {
  const raw = process.env.ANTHROPIC_API_KEY?.trim();
  if (!raw) return null;
  if (!raw.startsWith("sk-ant-")) return null;
  return raw;
}

export function getAnthropicModels(): readonly string[] {
  const override = process.env.ANTHROPIC_MODEL?.trim();
  if (override) return [override, ...ANTHROPIC_MODELS.filter((m) => m !== override)];
  return ANTHROPIC_MODELS;
}

export function getAnthropicKeyHelpMessage(): string {
  return "Invalid or missing Anthropic API key. Create a key at console.anthropic.com → API Keys and set ANTHROPIC_API_KEY on the server (Fly secrets or .env locally).";
}
