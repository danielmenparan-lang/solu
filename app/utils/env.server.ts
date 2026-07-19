const DEFAULT_PRODUCTION_APP_URL = "https://profit-brain-ai.onrender.com";

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

export function resolveShopifyAppUrl(): string {
  let raw = process.env.SHOPIFY_APP_URL?.trim() ?? "";

  // Common Render paste mistake: entire .env line saved as the value.
  if (/^SHOPIFY_APP_URL=/i.test(raw)) {
    raw = raw.replace(/^SHOPIFY_APP_URL=/i, "").trim();
  }

  raw = stripQuotes(raw);

  if (raw === "0.0.0.0" || raw === "127.0.0.1") {
    raw = "";
  }

  if (raw) {
    try {
      const url = new URL(raw);
      return url.origin;
    } catch {
      // Fall through to production default below.
    }
  }

  if (process.env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_APP_URL;
  }

  return raw;
}
