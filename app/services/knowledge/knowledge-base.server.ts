export const ECOM_BEST_PRACTICES = [
  "חנויות רווחיות מתמקדות ב-20% מוצרים שמייצרים 80% מההכנסה — לא בקטלוג ענק.",
  "AOV (ערך הזמנה ממוצע) מעל 1.5x עלות הרכישה (CAC) הוא סימן לבריאות.",
  "שיעור לקוחות חוזרים מעל 25% מצביע על מוצר וחוויה טובים.",
  "מוצרים ללא מכירה 60+ יום הם dead stock — הם הורגים רווח ומבלבלים לקוחות.",
  "הנחות מעל 30% ללא אסטרטגיה הורסות את perception של המותג.",
  "Social proof (ביקורות) מעלה המרה ב-15-30% בממוצע.",
  "אימייל לעגלה נטושה מחזיר 5-15% מהעגלות.",
  "פחות מ-50 מוצרים פעילים = קל יותר לנהל, לשווק ולייעל.",
  "תרגום מקצועי לשווקים בינלאומיים מגדיל המרה פי 2-3 לעומת תרגום אוטומטי גרוע.",
  "Dropshipping ללא בדיקת איכות ספק = החזרות גבוהות והרס מוניטין.",
];

export const BENCHMARKS = {
  healthyConversionRate: 2.5,
  healthyRepeatRate: 25,
  healthyRefundRate: 5,
  minProfitMargin: 30,
  maxDeadStockRatio: 0.2,
  minAov: 50,
};

export function getKnowledgeContext(): string {
  return [
    "## Best Practices",
    ...ECOM_BEST_PRACTICES.map((p, i) => `${i + 1}. ${p}`),
    "",
    "## Benchmarks",
    `- Conversion rate בריא: ${BENCHMARKS.healthyConversionRate}%+`,
    `- לקוחות חוזרים: ${BENCHMARKS.healthyRepeatRate}%+`,
    `- שיעור החזרות: מתחת ל-${BENCHMARKS.healthyRefundRate}%`,
    `- שולי רווח מינימליים: ${BENCHMARKS.minProfitMargin}%`,
    `- מקסימום dead stock: ${BENCHMARKS.maxDeadStockRatio * 100}% מהקטלוג`,
  ].join("\n");
}
