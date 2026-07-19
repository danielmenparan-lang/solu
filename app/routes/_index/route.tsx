import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function LandingPage() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: "2rem 1rem",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
        Profit Brain AI
      </h1>
      <p style={{ fontSize: "1.1rem", color: "#444" }}>
        AI profit scanner for Shopify — find money leaks, score your store, and
        get actions that pay for themselves.
      </p>

      <ul style={{ marginTop: "1.5rem" }}>
        <li>One-click 7-dimension profit scan</li>
        <li>Winning &amp; losing product insights</li>
        <li>AI profit advisor chat</li>
        <li>Pro automations (tags, collections)</li>
      </ul>

      {showForm && (
        <Form
          method="post"
          action="/auth/login"
          style={{
            marginTop: "2rem",
            padding: "1.25rem",
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            <strong>Install / log in</strong>
            <input
              type="text"
              name="shop"
              placeholder="your-store.myshopify.com"
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              background: "#008060",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Open in Shopify Admin
          </button>
        </Form>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.9rem" }}>
        <a href="/privacy">Privacy Policy</a>
      </p>
    </div>
  );
}
