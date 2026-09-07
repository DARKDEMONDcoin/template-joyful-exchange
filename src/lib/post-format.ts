/**
 * تكييف نص المنشور لكل منصة + اقتراح أفضل وقت للنشر.
 * ملف محايد (يعمل على المتصفح والخادم) حتى تستعمله لوحة النشر والطيار الآلي بنفس المنطق.
 */

/**
 * أسطر «كلام الموظف» التي لا يجوز أن تُنشر أبداً على المنصة:
 * إرشادات الأزرار، قسم الافتراضات، معرض صور الموقع، وأي تعليق موجّه للمستخدم.
 */
const CUT_FROM = [
  /^\s*#{0,6}\s*(?:📸|📷)?\s*صور\s+من\s+موقعك/u,
  /^\s*#{0,6}\s*\**\s*افتراضات\s*[:：]?/u,
  /^\s*#{0,6}\s*\**\s*(?:ملاحظة للمستخدم|تعليمات)\s*[:：]/u,
];

const DROP_LINE = [
  /انشر\s*الآن/u,
  /«?\s*جدولة\s*»?\s*(?:أسفل|من)/u,
  /اربط\s+حساب/u,
  /أسفل\s+المخرج/u,
  /اعتمده?\s+من\s+(?:صفحة\s+)?(?:الموافقات|الاعتمادات)/u,
  /اختر\s+أي\s+صورة/u,
  /الصورة\s+المولّدة/u,
  /المنشور\s+جاهز/u,
  /راقب\s+الوصول/u,
];

/**
 * ينظّف نص المنشور: يزيل صيغ الماركداون وكل ما هو موجَّه للمستخدم داخل الشات،
 * ويُبقي نص المنشور نفسه فقط. يُطبَّق في الواجهة وفي الخادم قبل الإرسال للمنصة.
 */
export function sanitizePostBody(input: string | null | undefined): string {
  if (!input) return "";
  let text = input
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "");

  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (CUT_FROM.some((re) => re.test(line))) break;
    if (line.trim() && DROP_LINE.some((re) => re.test(line))) continue;
    kept.push(line);
  }
  text = kept.join("\n");

  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * هل الرد مجرد كلام موظف (اعتذار/رفض/سؤال/توضيح) وليس منشوراً؟
 * يُستخدم لمنع ظهور لوحة النشر بنص ليس منشوراً أصلاً.
 */
const REFUSAL = [
  /لا\s+(?:يمكنني|أستطيع|أقدر)/u,
  /لست\s+قادراً/u,
  /خارج\s+نطاق/u,
  /عذرا?ً?[،,]/u,
  /آسف/u,
  /هل\s+تريد(?:ني)?\s+أن/u,
  /وضّح\s+لي/u,
  /أحتاج\s+منك/u,
];

export function isNonPostReply(input: string | null | undefined): boolean {
  const text = sanitizePostBody(input);
  if (!text) return true;
  const head = text.split("\n").slice(0, 6).join("\n");
  return REFUSAL.some((re) => re.test(head));
}



/** نسخة مختصرة تناسب حدّ إكس (٢٨٠ حرفاً) وتنتهي عند جملة كاملة مع أهم هاشتاقين. */
export function shortForX(caption: string): string {
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, 2).join(" ");
  const text = caption.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\n{2,}/g, "\n").trim();
  const budget = 275 - (tags ? tags.length + 1 : 0);
  if (text.length <= budget) return [text, tags].filter(Boolean).join("\n");
  const cut = text.slice(0, budget);
  const stop = Math.max(
    cut.lastIndexOf("."),
    cut.lastIndexOf("!"),
    cut.lastIndexOf("؟"),
    cut.lastIndexOf("\n"),
  );
  return [(stop > 80 ? cut.slice(0, stop + 1) : cut).trim(), tags].filter(Boolean).join("\n");
}

/** حدود النص المعروفة لكل منصة. */
const LIMIT: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 5000,
  linkedin: 3000,
  pinterest: 480,
  youtube: 5000,
};

/** يعيد نص المنشور مكيّفاً لحدود المنصة المطلوبة. */
export function adaptForProvider(provider: string, rawCaption: string): string {
  const caption = sanitizePostBody(rawCaption) || rawCaption;
  if (provider === "x") return shortForX(caption);
  const limit = LIMIT[provider];
  return limit && caption.length > limit ? `${caption.slice(0, limit - 1).trim()}…` : caption;
}

/** أفضل ساعات النشر (بالتوقيت المحلي للمستخدم) لكل منصة — متوسطات تفاعل معروفة. */
const BEST_HOURS: Record<string, number[]> = {
  instagram: [11, 14, 20],
  facebook: [10, 13, 21],
  linkedin: [8, 10, 12],
  x: [9, 12, 18],
  pinterest: [14, 20, 22],
  youtube: [16, 19, 21],
};

/** أقرب «أفضل وقت» قادم للمنصة (بعد ٢٠ دقيقة على الأقل من الآن). */
export function bestTimeFor(provider: string, from: Date = new Date()): Date {
  const hours = BEST_HOURS[provider] ?? [10, 14, 20];
  const floor = new Date(from.getTime() + 20 * 60_000);
  for (let day = 0; day < 2; day += 1) {
    for (const hour of hours) {
      const candidate = new Date(floor);
      candidate.setDate(floor.getDate() + day);
      candidate.setHours(hour, 0, 0, 0);
      if (candidate > floor) return candidate;
    }
  }
  return new Date(floor.getTime() + 3_600_000);
}
