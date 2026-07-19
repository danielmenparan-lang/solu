import type { ToolCatalogEntry } from "../../types/store-analysis";

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  {
    slug: "autods",
    name: "AutoDS",
    category: "dropshipping",
    description: "אוטומציה למציאת מוצרים, ייבוא מספקים וניהול מלאי.",
    useCase: "כשיש יותר מדי מוצרים ללא מכירות או כשצריך להרחיב קטלוג במהירות.",
  },
  {
    slug: "google-translate",
    name: "Google Translate",
    category: "localization",
    description: "תרגום אוטומטי של תיאורי מוצרים ודפי חנות.",
    useCase: "כשהחנות מכוונת לשוק בינלאומי אבל התוכן רק בעברית/אנגלית.",
  },
  {
    slug: "klaviyo",
    name: "Klaviyo",
    category: "email-marketing",
    description: "אימייל מרקטינג ואוטומציות לפי התנהגות לקוח.",
    useCase: "כששיעור לקוחות חוזרים נמוך או שאין אוטומציות לעגלה נטושה.",
  },
  {
    slug: "judgeme",
    name: "Judge.me",
    category: "social-proof",
    description: "ביקורות מוצרים ואמון לקוחות.",
    useCase: "כששיעור המרה נמוך למרות תנועה — חסר social proof.",
  },
  {
    slug: "reconvert",
    name: "ReConvert",
    category: "upsell",
    description: "אפסייל ו-cross-sell בדף תודה לאחר רכישה.",
    useCase: "כש-AOV נמוך ואפשר להגדיל רווח ללא עלות רכישה נוספת.",
  },
];

export function getToolBySlug(slug: string): ToolCatalogEntry | undefined {
  return TOOL_CATALOG.find((tool) => tool.slug === slug);
}
