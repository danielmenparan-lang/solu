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
    <div className={styles.page} dir="rtl" lang="he">
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoMark} aria-hidden="true">
            🧠
          </div>
          <span>{APP_NAME}</span>
        </div>
        <nav className={styles.nav}>
          <a href="#features">מה האפ עושה</a>
          <a href="#pricing">מחירים</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>תמיכה</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.badge}>אפליקציית Shopify · ניתוח רווחים</span>
          <h1 className={styles.title}>
            גלה בדיוק איפה החנות שלך מפסידה כסף
          </h1>
          <p className={styles.subtitle}>{APP_TAGLINE}</p>
          <div className={styles.ctaRow}>
            <a className={styles.primaryBtn} href="#install">
              התקנה על החנות שלי
            </a>
            <a className={styles.secondaryBtn} href="#pricing">
              לראות מחירים
            </a>
          </div>
        </div>

        <div className={styles.heroCard}>
          <h2>דוגמה לתוצאות סריקה</h2>
          <div className={styles.metric}>
            <span>ציון רווח לחנות</span>
            <strong>B+</strong>
          </div>
          <div className={styles.metric}>
            <span>מוצרים שלא נמכרים</span>
            <strong>12 מוצרים</strong>
          </div>
          <div className={styles.metric}>
            <span>מוצרים שמרוויחים הכי הרבה</span>
            <strong>8 מוצרים</strong>
          </div>
          <div className={styles.metric}>
            <span>רשימת מה לעשות עכשיו</span>
            <strong>מוכנה</strong>
          </div>
        </div>
      </section>

      <section id="features" className={styles.features}>
        <article className={styles.feature}>
          <h3>סריקת רווח בלחיצה אחת</h3>
          <p>
            בודק מוצרים, החזרות, לקוחות שחוזרים, והרבה נתונים נוספים — ומסביר
            את התוצאות בשפה פשוטה.
          </p>
        </article>
        <article className={styles.feature}>
          <h3>מי מרוויח ומי מפסיד</h3>
          <p>
            רואה בבירור אילו מוצרים מכניסים כסף ואילו מוצרים עולים לך כסף.
          </p>
        </article>
        <article className={styles.feature}>
          <h3>יועץ AI</h3>
          <p>
            שואל שאלות על החנות ומקבל תשובות ברורות — בלי מונחים מסובכים.
          </p>
        </article>
        <article className={styles.feature}>
          <h3>תוכנית פעולה</h3>
          <p>
            רשימה מסודרת של מה כדאי לתקן קודם. אפשר גם לתייג מוצרים — רק
            באישור שלך.
          </p>
        </article>
      </section>

      <section id="pricing" className={styles.pricing}>
        <article className={styles.plan}>
          <h3>חינם</h3>
          <p className={styles.price}>$0</p>
          <ul>
            <li>סריקה אחת מלאה לחנות</li>
            <li>דשבורד רווחים</li>
            <li>5 הודעות ליועץ AI ביום</li>
          </ul>
        </article>
        <article className={`${styles.plan} ${styles.planPro}`}>
          <h3>Pro</h3>
          <p className={styles.price}>$19/חודש</p>
          <ul>
            <li>סריקות ללא הגבלה</li>
            <li>יועץ AI מלא</li>
            <li>תוכנית פעולה + תיוג מוצרים</li>
            <li>חיוב דרך Shopify</li>
          </ul>
        </article>
      </section>

      {showForm && (
        <section id="install" className={styles.install}>
          <div className={styles.installBox}>
            <Form method="post" action="/auth/login">
              <label htmlFor="shop">התקנה / התחברות לחנות</label>
              <input
                id="shop"
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your-store.myshopify.com"
                dir="ltr"
                required
              />
              <button type="submit" className={styles.primaryBtn}>
                חיבור לחנות
              </button>
            </Form>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span>
          תמיכה:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </span>
        <span>
          <a href="/privacy">מדיניות פרטיות</a> ·{" "}
          <a href="/terms">תנאי שימוש</a>
        </span>
      </footer>
    </div>
  );
}
