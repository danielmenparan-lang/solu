import type { LoaderFunctionArgs } from "react-router";



export const loader = async ({ request }: LoaderFunctionArgs) => {

  const html = `<!DOCTYPE html>

<html lang="en">

<head>

  <meta charset="utf-8" />

  <title>Profit Brain AI — Privacy Policy</title>

  <style>

    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }

    h1 { font-size: 1.5rem; }

    h2 { font-size: 1.1rem; margin-top: 1.5rem; }

  </style>

</head>

<body>

  <h1>Profit Brain AI — Privacy Policy</h1>

  <p>Last updated: July 2026</p>



  <h2>What we collect</h2>

  <ul>

    <li>Shop domain and Shopify OAuth session data (required to operate the app)</li>

    <li>Product, order, and checkout analytics needed for profit analysis</li>

    <li>Scan results, recommendations, and AI chat messages stored for your shop</li>

    <li>Automation logs (product tags, collections) when you explicitly run automations</li>

  </ul>



  <h2>What we do not collect</h2>

  <ul>

    <li>Customer payment card details (handled by Shopify)</li>

    <li>Data from shops that uninstall the app (deleted on uninstall and shop/redact webhooks)</li>

  </ul>



  <h2>How we use data</h2>

  <p>Data is used solely to provide profit analytics, AI recommendations, and optional automations you approve. We do not sell merchant or customer data.</p>



  <h2>Third parties</h2>

  <ul>

    <li><strong>Anthropic (Claude)</strong> — AI analysis of aggregated store metrics and chat messages you send</li>

    <li><strong>Shopify Admin API</strong> — read/write store data per granted scopes</li>

  </ul>



  <h2>Data retention & deletion</h2>

  <p>All shop data is deleted when the app is uninstalled or when Shopify sends a <code>shop/redact</code> webhook (within 48 hours of uninstall). You may request deletion by uninstalling the app or contacting support.</p>



  <h2>Your rights (GDPR / CCPA)</h2>

  <p>Shopify sends mandatory compliance webhooks (<code>customers/data_request</code>, <code>customers/redact</code>, <code>shop/redact</code>). We respond to these automatically. Merchants may contact us for additional privacy requests via the Shopify App Store listing support email.</p>



  <h2>Billing</h2>

  <p>Profit Brain AI offers a free plan with 1 one-time store scan per shop, and an optional Pro subscription at $19 USD/month for unlimited scans and advanced features. All app charges are processed by Shopify on your Shopify invoice. We do not store your payment card details.</p>



  <h2>Security</h2>

  <p>All traffic is served over HTTPS. OAuth tokens are stored encrypted in our database. Store changes (product tags, drafts) require explicit merchant action or opt-in settings.</p>



  <h2>Contact</h2>

  <p>For privacy requests, contact <a href="mailto:vonx.support@gmail.com">vonx.support@gmail.com</a> or the Shopify App Store listing support email.</p>

</body>

</html>`;



  return new Response(html, {

    headers: { "Content-Type": "text/html; charset=utf-8" },

  });

};



export default function PrivacyPolicy() {

  return null;

}

