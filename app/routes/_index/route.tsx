import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import {
  APP_NAME,
  APP_TAGLINE,
  SUPPORT_EMAIL,
} from "../../constants/support";
import styles from "./landing.module.css";

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
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoMark} aria-hidden="true">
            🧠
          </div>
          <span>{APP_NAME}</span>
        </div>
        <nav className={styles.nav}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.badge}>Shopify App Store · Profit Analytics</span>
          <h1 className={styles.title}>
            Know exactly where your Shopify store is losing money
          </h1>
          <p className={styles.subtitle}>{APP_TAGLINE}</p>
          <div className={styles.ctaRow}>
            <a className={styles.primaryBtn} href="#install">
              Install on your store
            </a>
            <a className={styles.secondaryBtn} href="#pricing">
              View pricing
            </a>
          </div>
        </div>

        <div className={styles.heroCard}>
          <h2>Sample profit scan snapshot</h2>
          <div className={styles.metric}>
            <span>Store profit grade</span>
            <strong>B+</strong>
          </div>
          <div className={styles.metric}>
            <span>Dead stock products</span>
            <strong>12 flagged</strong>
          </div>
          <div className={styles.metric}>
            <span>Top profit drivers</span>
            <strong>8 winners</strong>
          </div>
          <div className={styles.metric}>
            <span>AI action plan</span>
            <strong>Ready</strong>
          </div>
        </div>
      </section>

      <section id="features" className={styles.features}>
        <article className={styles.feature}>
          <h3>7-dimension profit scan</h3>
          <p>
            One click analyzes products, margins, refunds, repeat buyers, and
            more.
          </p>
        </article>
        <article className={styles.feature}>
          <h3>Winners & losers</h3>
          <p>See which SKUs drive profit and which ones drain it.</p>
        </article>
        <article className={styles.feature}>
          <h3>AI profit advisor</h3>
          <p>Chat with an AI trained on e-commerce best practices.</p>
        </article>
        <article className={styles.feature}>
          <h3>Action plan + automations</h3>
          <p>Prioritized fixes with optional tags, drafts, and collections.</p>
        </article>
      </section>

      <section id="pricing" className={styles.pricing}>
        <article className={styles.plan}>
          <h3>Free</h3>
          <p className={styles.price}>$0</p>
          <ul>
            <li>1 full store scan</li>
            <li>Profit dashboard</li>
            <li>5 AI messages per day</li>
          </ul>
        </article>
        <article className={`${styles.plan} ${styles.planPro}`}>
          <h3>Pro</h3>
          <p className={styles.price}>$19/mo</p>
          <ul>
            <li>Unlimited scans</li>
            <li>Full AI advisor</li>
            <li>Automations & action plan</li>
            <li>Billed through Shopify</li>
          </ul>
        </article>
      </section>

      {showForm && (
        <section id="install" className={styles.install}>
          <div className={styles.installBox}>
            <Form method="post" action="/auth/login">
              <label htmlFor="shop">Install / log in with your shop</label>
              <input
                id="shop"
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your-store.myshopify.com"
                required
              />
              <button type="submit" className={styles.primaryBtn}>
                Connect store
              </button>
            </Form>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span>
          Support:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </span>
        <span>
          <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
        </span>
      </footer>
    </div>
  );
}
