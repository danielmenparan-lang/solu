import type { LoaderFunctionArgs } from "react-router";
import { SUPPORT_EMAIL } from "../constants/support";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Profit Brain AI — Terms of Service</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    a { color: #008060; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e3e3e3; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Profit Brain AI — Terms of Service</h1>
  <p>Last updated: July 2026</p>

  <h2>1. Agreement</h2>
  <p>By installing or using Profit Brain AI ("the App") on your Shopify store, you agree to these Terms of Service. If you do not agree, do not install or use the App.</p>

  <h2>2. Service description</h2>
  <p>The App provides profit analytics, AI-powered recommendations, optional automations you explicitly approve, and subscription billing through Shopify. Features may change as we improve the product.</p>

  <h2>3. Merchant responsibilities</h2>
  <ul>
    <li>You must have authority to connect the App to your Shopify store.</li>
    <li>You are responsible for reviewing AI suggestions and automation actions before applying them.</li>
    <li>You must comply with Shopify's terms, applicable laws, and customer privacy obligations.</li>
  </ul>

  <h2>4. Plans & billing</h2>
  <p>The free plan includes one full store scan per shop. The Pro plan is billed at $19 USD/month through Shopify's app billing system. Charges appear on your Shopify invoice. You may cancel Pro at any time through Shopify Admin; access continues until the end of the current billing cycle.</p>

  <h2>5. AI & analytics disclaimer</h2>
  <p>Scan scores, profit estimates, and AI outputs are informational only — not financial, legal, or tax advice. Results depend on your store data and settings. We do not guarantee revenue increases or specific business outcomes.</p>

  <h2>6. Automations</h2>
  <p>Product tags, drafts, and collections are changed only when you explicitly run an automation or enable an approved action. You remain responsible for catalog changes made through the App.</p>

  <h2>7. Availability</h2>
  <p>We aim for reliable uptime but do not guarantee uninterrupted service. Maintenance, third-party outages (Shopify, Anthropic), or force majeure may cause temporary downtime.</p>

  <h2>8. Limitation of liability</h2>
  <p>To the maximum extent permitted by law, the App is provided "as is." We are not liable for indirect, incidental, or consequential damages arising from use of the App, including lost profits or data.</p>

  <h2>9. Termination</h2>
  <p>You may uninstall the App at any time. We may suspend access if you violate these terms or misuse the App. Upon uninstall, your shop data is deleted per our Privacy Policy and Shopify compliance webhooks.</p>

  <h2>10. Changes</h2>
  <p>We may update these terms. Continued use after changes constitutes acceptance. Material changes will be reflected in the "Last updated" date above.</p>

  <h2>11. Contact</h2>
  <p>Questions about these terms: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>

  <footer>
    <a href="/">Home</a> · <a href="/privacy">Privacy Policy</a>
  </footer>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

export default function TermsOfService() {
  return null;
}
