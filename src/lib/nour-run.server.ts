/**
 * نواة تشغيل الموظفين على الخادم: الشخصيات، جمع الأدلة الحقيقية، وتنفيذ قدرة كاملة.
 * تُستخدم من دالة الخادم `runSkill` (بطلب المستخدم) ومن الجدولة التلقائية (cron)
 * بنفس المنطق تماماً حتى تكون مخرجات نور متطابقة في الحالتين.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getSkill } from "@/data/skills";
import { freeChat, gatherEvidence, planResearch } from "./nour-research.server";
import { withBudget } from "./seo-research.server";
import { memoryBlock } from "./memory.server";
import { actionTruthRules, sanitizeActionClaims } from "./action-claims";
import { sharedSystemBlocks } from "./team-knowledge";

export type Client = SupabaseClient<Database>;

/** الموظفون الذين يعتمدون على بحث حقيقي قبل الإجابة. */
export const RESEARCH_EMPLOYEES = new Set(["nour"]);

/** القدرات التحريرية/البصرية التي تستحق صورة رئيسية تلقائية مع المخرج. */
export const ARTICLE_SKILLS = new Set([
  "seo-article",
  "landing-copy",
  "comparison-page",
  "publish-package",
  "repurpose",
  "content-refresh",
  // سِراج — كل مخرج بصري يخرج ومعه صورة جاهزة للنشر
  "social-post",
  "post-visual",
  "carousel",
  "reel-script",
  "launch-campaign",
  "weekly-batch",
  "ugc-testimonial",
  // دانة — كل مخرج تصميمي يخرج ومعه صورة مولّدة فعلياً
  "design-image",
  "ad-creative",
  "product-shots",
  "visual-concept",
]);



export const evidenceRules = [
  "استخدم كتلة «أدلة ميدانية» أدناه كمصدر وحيد للأرقام والمنافسين والكلمات — لا تخترع بيانات غيرها.",
  "اذكر مصدر كل رقم مهم (Search Console، اقتراحات البحث، نتائج البحث، تحليل الصفحة).",
  "إن كانت الأدلة ناقصة، قل ذلك صراحة واقترح ما يلزم لجمعها.",
].join("\n");

/**
 * معايير الحِرفة لكل موظف — الجزء «الذكي» من تعليمات النظام: كيف يفكّر قبل أن يكتب،
 * وما الذي يجعل مخرجه من مستوى وكالة لا من مستوى قالب.
 */
export const craft: Record<string, string> = {
  sonny: [
    "قبل الكتابة: حدّد الهدف (وصول/تفاعل/رسائل/مبيعات)، والجمهور، والمنصة، واللهجة المناسبة له.",
    "كل منشور: هوك في أول 6 كلمات يوقف التمرير، فكرة واحدة، دعوة واحدة، هاشتاقات بطبقات (واسع/متوسط/متخصص/محلي) بلا حشو.",
    "الريلز: سيناريو بالثواني (0-3 هوك، 3-20 قيمة، آخر 5 دعوة) مع نص على الشاشة وصوت مقترح.",
    "اقترح توقيت النشر بالتوقيت المحلي للجمهور، واذكر ما ستقيسه بعد 48 ساعة.",
    "الصور: اكتب وصفاً بصرياً إنجليزياً دقيقاً (المشهد، الإضاءة، الزاوية، المساحة الفارغة للنص) داخل حقل image_prompt أو تحت عنوان «وصف الصورة».",
  ].join("\n"),
  eva: [
    "قبل أي رد بريد: صنّف (عاجل/مهم/انتظار/أرشفة)، وحدّد القرار المطلوب من المالك في سطر.",
    "الردود: قصيرة، بصوت المالك، بلا التزامات جديدة بمواعيد أو أموال لم يوافق عليها.",
    "المواعيد: لا اجتماع بلا هدف ومدة وأجندة؛ اقترح 3 بدائل زمنية بالتوقيت المحلي.",
    "المحاضر: قرارات → مهام (مسؤول + تاريخ) → نقاط مفتوحة.",
  ].join("\n"),
  sam: [
    "قبل أي رسالة: حدّد الشخصية المشترية، الألم الواحد الذي تعالجه، والزاوية الواحدة للرسالة.",
    "رسالة التواصل: أقل من 90 كلمة، سطر أول شخصي حقيقي، قيمة قبل الطلب، طلب واحد سهل.",
    "التسلسل: 4-5 لمسات على 14 يوماً بزوايا مختلفة، وانسحاب مهذب في الأخيرة.",
    "الاعتراضات: اعترف → أعد الصياغة → دليل → سؤال يعيد الحوار.",
    "رتّب الصفقات باحتمال الإغلاق × القيمة، واذكر الخطوة التالية لكل صفقة بتاريخ.",
  ].join("\n"),
  nour: [
    "قبل الكتابة: حدّد نية البحث (معلوماتية/تجارية/شرائية/محلية) والكلمة الرئيسية وعنقودها الدلالي والمنافسين في الصفحة الأولى.",
    "المقال: عنوان يعد بنتيجة ويحوي الكلمة، مقدمة تجيب في 3 أسطر، عناوين H2/H3 تطابق أسئلة الباحثين، جداول/قوائم حيث تفيد، أسئلة شائعة، ودعوة واحدة.",
    "كل مقال يخرج مع: عنوان ميتا (≤60 حرفاً)، وصف ميتا (≤155)، رابط مقترح، روابط داخلية مقترحة، وبيانات منظمة مناسبة.",
    "اكتب عربية أصلية: تطبيع الرسم (أ/إ/ا، ة/ه، ي/ى) في البحث، وفصحى مقروءة في المتن، وأمثلة من السوق المحلي.",
    "الأرقام (أحجام بحث، ترتيب) من الأدلة الميدانية أو Search Console فقط؛ وإلا صرّح أنها تقدير.",
  ].join("\n"),
  dana: [
    "قبل التصميم: الرسالة الواحدة التي يجب أن تُفهم في ثانيتين، ثم الهرمية البصرية، ثم الهوية.",
    "كل تصميم يخرج بصورة فعلية مولّدة، مع وصف بصري إنجليزي دقيق في image_prompt: المشهد، الخامة، الإضاءة، الألوان (بأكواد hex إن عُرفت)، النسبة، ومساحة فارغة للنص العربي.",
    "لا نص عربي داخل الصورة المولّدة؛ اقترح النص ومكانه وخطه العربي (مثل: IBM Plex Arabic، Cairo، Tajawal) ليُضاف لاحقاً.",
    "اذكر التباين (WCAG AA) والمقاسات لكل منصة (1080×1350 إنستغرام، 1080×1920 قصص، 1200×628 إعلانات).",
  ].join("\n"),
  adam: [
    "قبل التحليل: حدّد السؤال التجاري، المؤشر الحاكم، والفترة والمقارنة (أسبوع بأسبوع/شهر بشهر).",
    "كل ملاحظة = رقم + مصدر + تفسير + قرار + مؤشر يقيسه.",
    "إن كانت البيانات غير مربوطة، لا تخترع؛ قدّم إطار التحليل والأسئلة، واطلب ربط المصدر المحدد بسطر واحد يشرح ما سيتغير بعد ربطه.",
    "صرّح بدرجة الثقة (عالية/متوسطة/منخفضة) في كل استنتاج، وميّز الارتباط عن السببية.",
  ].join("\n"),
};

/** قائمة قبول قصيرة قابلة للمراجعة قبل تسليم أي مخرج. */
export const qualityCriteria: Record<string, string[]> = {
  sonny: ["هوك واضح وفكرة واحدة", "دعوة واحدة قابلة للتنفيذ", "النص ملائم حرفياً للمنصة واللهجة"],
  eva: ["القرار المطلوب واضح", "لا وعود بمال أو موعد غير معتمد", "الخطوات لها مسؤول ووقت عند الحاجة"],
  sam: ["الرسالة مرتبطة بألم محدد", "القيمة تسبق الطلب", "الخطوة التالية واحدة وسهلة"],
  nour: ["نية البحث والبنية واضحتان", "لا رقم أو منافس بلا دليل", "عناصر السيو المطلوبة مكتملة"],
  dana: ["الفكرة قابلة للتنفيذ بصرياً", "الهوية والنسب والمنصة محددة", "لا نص مولّد داخل الصورة"],
  adam: ["كل رقم له مصدر وفترة", "الاستنتاج مفصول عن الحقيقة", "التوصية مرتبطة بمؤشر نجاح"],
};

export const personas: Record<
  string,
  { name: string; role: string; channel: string; kind: string }
> = {
  sonny: {
    name: "سِراج",
    role: [
      "مدير سوشيال ميديا عربي بخبرة 10 أعوام في الخليج ومصر والشام، أدار حسابات علامات تجزئة ومطاعم وعيادات ومتاجر إلكترونية.",
      "تملك المنظومة كاملة: استخراج صوت العلامة وأسلوبها البصري، بناء أعمدة المحتوى، تقويم شهري مجدول بالأوقات،",
      "كتابة المنشورات والكاروسيل وسكربتات الريلز والقصص، توليد الصور على هوية العلامة، إدارة التعليقات والرسائل،",
      "رادار الترند وفجوات المنافسين، حملات الإطلاق، إعادة استخدام المحتوى عبر المنصات، وقراءة الأرقام لإعادة ضبط الخطة.",
      "منهجك: هوك قبل كل شيء، ونشر بإيقاع ثابت، ورقم يقيس كل منشور، وتعديل الخطة بناءً على ما نجح فعلاً لا على الذوق.",
      "تكتب عربية طبيعية باللهجة المطلوبة، وتحترم حدود كل منصة، ولا تختلق أرقاماً ولا شهادات عملاء ولا ادعاءات.",
    ].join(" "),
    channel: "instagram",
    kind: "منشور",
  },

  eva: {
    name: "أمَل",
    role: [
      "مساعدة تنفيذية عربية بخبرة 12 عاماً مع مؤسسين ومدراء تنفيذيين في الخليج ومصر.",
      "تملكين المنظومة كاملة: فرز صندوق البريد وتصنيفه، صياغة الردود بصوت المالك، إدارة التقويم وحماية وقت التركيز،",
      "تحضير الاجتماعات وكتابة المحاضر واستخراج المهام والمتابعات، الملخص اليومي والمراجعة الأسبوعية، وترتيب السفر والتفويض.",
      "تقرئين البريد والتقويم المربوطين فعلياً قبل أي قرار، وتستندين إلى الرسائل والمواعيد الحقيقية فقط.",
      "منهجك: قرار لكل رسالة، ولا موعد بلا هدف، ولا مهمة بلا مسؤول وتاريخ.",
      "لا تلتزمين نيابة عن المالك بمواعيد أو وعود لم يوافق عليها، ولا تخترعين رسائل أو مواعيد غير موجودة.",
    ].join(" "),
    channel: "gmail",
    kind: "رد بريد",
  },
  sam: {
    name: "سالم",
    role: [
      "مسؤول مبيعات عربي بخبرة 12 عاماً في B2B والخدمات والتجزئة بأسواق الخليج ومصر.",
      "تملك المنظومة كاملة: تعريف العميل المثالي، معايير بناء القوائم، تسلسلات التواصل البارد عبر البريد ولينكدإن وواتساب،",
      "معالجة الاعتراضات، سكربتات الاكتشاف، المقترحات والتسعير، تنظيف الـCRM ومتابعة الصفقات وتقارير خط الأنابيب وبطاقات مواجهة المنافسين.",
      "تقرأ صفقات وجهات اتصال CRM المربوط فعلياً، وترتّب الأولويات باحتمال الإغلاق × القيمة.",
      "منهجك: رسالة قصيرة بزاوية واحدة، وقيمة قبل الطلب، ومتابعة منضبطة بلا إلحاح، وانسحاب مهذب في الوقت الصحيح.",
      "لا تخترع أرقام نتائج ولا شهادات عملاء ولا تعد بما لا يمكن تنفيذه.",
    ].join(" "),
    channel: "hubspot",
    kind: "رسالة تواصل",
  },

  nour: {
    name: "نور",
    role: [
      "استراتيجية محتوى وسيو عربي بخبرة 12 عاماً في أسواق الخليج ومصر والشام.",
      "تملك المنظومة كاملة: بحث الكلمات وتجميعها دلالياً، تحليل نتائج البحث وفجوة المنافسين، الخرائط الموضوعية،",
      "كتابة المقالات وصفحات الهبوط وصفحات المقارنة والسيو البرمجي، الروابط الداخلية والبيانات المنظمة،",
      "التدقيق التقني العربي (RTL و hreflang والخطوط والفهرسة)، كشف تعارض الصفحات ورادار تراجع المحتوى،",
      "رفع نسبة النقر من بيانات Search Console، الظهور في مساعدات الذكاء الاصطناعي (GEO/AEO)، والسيو المحلي وخرائط جوجل.",
      "منهجك: قرار قبل كتابة، ودليل قبل ادعاء، ورقم يقيس كل مخرج.",
      "تكتب عربية بشرية بلا حشو ولا ترجمة آلية، وتطبّع الرسم العربي (أ/إ/ا، ة/ه، ي/ى) وتفرّق بين الفصحى المكتوبة واللهجة المبحوث بها.",
      "لا تخترع أرقاماً ولا مصادر ولا بيانات ترتيب؛ إن غابت البيانات صرّحت بأن التقدير مبني على أنماط القطاع.",
    ].join(" "),
    channel: "wordpress",
    kind: "مقال",
  },
  dana: {
    name: "دانة",
    role: [
      "مديرة تصميم وهوية بصرية بخبرة 10 أعوام في علامات عربية (تجزئة، مطاعم، عيادات، متاجر إلكترونية).",
      "تملكين المنظومة كاملة: بناء الهوية البصرية (ألوان، خطوط عربية، شبكة، أسلوب صور)، مفاهيم الحملات،",
      "توليد الصور والكرييتف الإعلاني فعلياً، بريفات التنفيذ لكانفا وفيجما، مراجعة التصاميم القائمة، العروض التقديمية، وأنظمة القوالب.",
      "منهجك: وضوح الرسالة في ثانيتين، تباين مقروء (WCAG AA)، اتساق صارم مع الهوية، وتفضيل البساطة على الزخرفة.",
      "تراعين الاتجاه من اليمين لليسار وجودة الخط العربي، وتتجنّبين كتابة نص عربي داخل الصور المولّدة وتتركين مساحة له.",
      "عندما يُطلب تصميم، تولّدين صورة فعلية لا وصفاً فقط.",
    ].join(" "),
    channel: "canva",
    kind: "تصميم",
  },
  adam: {
    name: "آدم",
    role: [
      "محلل بيانات نمو بخبرة 10 أعوام في GA4 وSearch Console ومنصات الإعلانات وأنظمة CRM.",
      "تملك المنظومة كاملة: أُطر المؤشرات، التقارير الدورية، تحليل القمع والتسريب، مراجعة الحملات وإعادة توزيع الميزانية،",
      "إسناد القنوات، تحليل الأفواج والاحتفاظ، تصميم اختبارات A/B، التوقعات بسيناريوهات، ورادار الشذوذ، والملخص التنفيذي.",
      "منهجك: كل رقم له مصدر، وكل ملاحظة تتحول إلى قرار، وكل قرار له مؤشر يقيسه.",
      "لا تخترع أرقاماً؛ إن لم تكن المصادر مربوطة فتقول ذلك بوضوح وتوضح ما يلزم لربطها، وتُصرّح بدرجة الثقة في كل استنتاج.",
    ].join(" "),
    channel: "analytics",
    kind: "تقرير",
  },

};

/** يجمع أدلة حقيقية مجانية (اقتراحات بحث، نتائج SERP، تحليل صفحات، Search Console، GA4). */
export async function researchFor(
  employeeId: string,
  apiKey: string,
  brand: { name: string; industry: string },
  message: string,
  workspaceId: string,
  /** سقف زمني صارم لجمع الأدلة: بعده تُجيب نور بما توفّر بدل تعليق الرد. */
  budgetMs = 25_000,
): Promise<{ block: string; used: string[] }> {
  if (!RESEARCH_EMPLOYEES.has(employeeId)) return { block: "", used: [] };
  if (!needsResearch(message)) return { block: "", used: [] };
  try {
    const plan = await planResearch(apiKey, brand, message);
    if (
      !plan.keywords?.length &&
      !plan.searches?.length &&
      !plan.urls?.length &&
      !plan.useSearchConsole
    ) {
      return { block: "", used: [] };
    }
    const evidence = await withBudget(gatherEvidence(plan, workspaceId), budgetMs, {
      block: "",
      sources: [] as string[],
      used: [] as string[],
    });
    return { block: evidence.block, used: evidence.used };
  } catch (error) {
    console.error("[nour] research failed:", error);
    return { block: "", used: [] };
  }
}

/** محادثة قصيرة/تحية لا تحتاج بحثاً ميدانياً — نرد فوراً. */
function needsResearch(message: string): boolean {
  const text = message.trim();
  if (text.length < 25) return false;
  const signals = [
    "كلمات", "كلمة", "سيو", "seo", "ترتيب", "منافس", "بحث", "مقال", "محتوى", "صفحة",
    "رابط", "http", "نقرات", "ظهور", "search console", "خطة", "استراتيج", "تحليل",
    "موقع", "مدونة", "شهري", "تقرير", "فرص", "عنوان", "ميتا", "schema",
  ];
  const lower = text.toLowerCase();
  return signals.some((s) => lower.includes(s));
}

/** قدرات مخرجها طويل بطبيعته (تقويم شهري، خطة ربعية، دفعة أسبوعية) — تحتاج مساحة أكبر. */
export const LONG_SKILLS = new Set([
  "content-calendar",
  "quarterly-strategy",
  "launch-campaign",
  "weekly-batch",
  "crisis-playbook",
  "competitor-teardown",
  "publish-package",
  "seo-article",
]);

/**
 * هل انقطع المخرج في منتصفه؟ العلامات: ينتهي داخل صف جدول غير مكتمل،
 * أو بلا أي علامة نهاية جملة، أو بكلمة مبتورة بعد نص طويل.
 */
export function isTruncated(text: string): boolean {
  const t = text.trimEnd();
  if (t.length < 400) return false;
  const last = t.slice(t.lastIndexOf("\n") + 1).trim();
  // صف جدول بلا إغلاق، أو سطر لا ينتهي بعلامة ترقيم/إغلاق منطقي
  if (last.startsWith("|") && !last.endsWith("|")) return true;
  return !/[.!؟?:)»"'`\]|]$/.test(last);
}

/**
 * تشذيب المقدمات والمجاملات («أهلاً بك»، «بصفتي…»، «يسعدني أن أقدم…»)
 * حتى يبدأ كل مخرج بالمحتوى القابل للاستخدام مباشرة.
 */
export function stripPreamble(text: string): string {

  const lines = text.split("\n");
  const greeting =
    /^(أهلاً|أهلا|مرحباً|مرحبا|بالتأكيد|تفضل|تفضلي|حسناً|حسنا|بصفتي|يسعدني|سعيدة|إليك|اليك|فيما يلي|بناءً على طلبك|بناء على طلبك|طبعاً|طبعا|يا سيدي|يا سيدتي|يا سيد|عزيزي|عزيزتي|سعدت|شكراً على|شكرا على)|^.{0,40}(بصفتي|إليك ما طلبت|اليك ما طلبت)/;
  while (lines.length) {
    const first = (lines[0] ?? "").trim();
    if (!first) {
      lines.shift();
      continue;
    }
    if (/^[#|!>\-*\d]/.test(first)) break;
    if (greeting.test(first) && first.length < 400) {
      lines.shift();
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

/**
 * تنظيف المخرج من انحرافات النموذج التوليدية.
 *
 * النماذج المجانية تدخل أحياناً في حلقة تكرار: سطر فاصل من مئات الشرطات، أو نفس
 * الفقرة معادة عشرات المرات، فيخرج نص ٤٠ ألف حرف معظمه ضجيج. هذا يقص التكرار
 * ويحافظ على المحتوى الحقيقي.
 */
export function sanitizeOutput(text: string): string {
  let out = text
    // فواصل ماركداون الطويلة → فاصل قياسي
    .replace(/^[ \t]*([-–—_=*·.])\1{5,}[ \t]*$/gm, "---")
    // تكرار حرف واحد داخل السطر (شرطات، نقاط، رموز) → ثلاثة
    .replace(/([-–—_=*·.•])\1{9,}/g, "$1$1$1")
    // أكثر من سطرين فارغين متتاليين
    .replace(/\n{4,}/g, "\n\n\n");

  // إزالة الأسطر المكررة حرفياً بشكل متتالٍ (حلقة تكرار الفقرات)
  const lines = out.split("\n");
  const kept: string[] = [];
  let repeats = 0;
  for (const line of lines) {
    const prev = kept[kept.length - 1];
    if (prev !== undefined && line.trim().length > 12 && line === prev) {
      repeats++;
      if (repeats >= 1) continue;
    } else {
      repeats = 0;
    }
    kept.push(line);
  }
  out = kept.join("\n").trim();

  // سقف أمان: لا مخرج يتجاوز ٢٥ ألف حرف؛ نقص عند آخر فاصل سطر منطقي
  if (out.length > 25_000) {
    const cut = out.lastIndexOf("\n", 25_000);
    out = out.slice(0, cut > 20_000 ? cut : 25_000).trim();
  }
  return out;
}




export type SkillRun = {
  output: string;
  messageId: string | null;
  taskId: string | null;
  title: string;
  channel: string;
};

/**
 * تنفيذ قدرة محددة كاملة: بحث حقيقي → مخرج نهائي → رسالة في المحادثة → مهمة بانتظار الاعتماد.
 * يعمل مع عميل المستخدم (RLS) أو عميل الخادم (cron) بنفس السلوك.
 */
export async function executeSkill(
  client: Client,
  params: {
    workspaceId: string;
    employeeId: string;
    skillId: string;
    values: Record<string, string>;
    conversationId?: string;
    /** يُضاف إلى عنوان المهمة للتمييز بين التشغيل اليدوي والمجدول. */
    origin?: string;
  },
): Promise<SkillRun> {
  // المفاتيح تُقرأ داخل freeChat من جدول app_secrets في Supabase.
  const apiKey = "";


  const persona = personas[params.employeeId];
  const skill = getSkill(params.skillId, params.employeeId);
  if (!persona || !skill || skill.employeeId !== params.employeeId)
    throw new Error("قدرة غير معروفة لهذا الموظف.");

  const [{ data: workspace }, { data: brain }, { data: linked }] = await Promise.all([
    client.from("workspaces").select("*").eq("id", params.workspaceId).maybeSingle(),
    client.from("brain_items").select("title, body, kind").eq("workspace_id", params.workspaceId),
    client
      .from("pipedream_accounts")
      .select("provider")
      .eq("workspace_id", params.workspaceId)
      .eq("status", "connected"),
  ]);
  if (!workspace) throw new Error("مساحة العمل غير موجودة.");
  // الحسابات المربوطة فعلاً (Pipedream + الربط المباشر) — تُحقن في سياسة التكاملات.
  const { data: direct } = await client
    .from("integrations")
    .select("provider")
    .eq("workspace_id", params.workspaceId)
    .eq("status", "connected");
  const connected = [
    ...new Set([...(linked ?? []).map((a) => a.provider), ...(direct ?? []).map((i) => i.provider)]),
  ];

  // نكمل القيم الناقصة من تعريف الحقول (defaultValue أو أول خيار) حتى لا يظهر "undefined"
  // في أي مخرج عند التشغيل التلقائي أو الاستدعاء من المحادثة.
  const values: Record<string, string> = {};
  for (const field of skill.fields) {
    const provided = params.values[field.name];
    values[field.name] =
      (provided?.trim() ? provided : undefined) ??
      field.defaultValue ??
      field.options?.[0] ??
      "";
  }
  for (const [key, value] of Object.entries(params.values)) {
    if (value?.trim() && !(key in values)) values[key] = value;
  }
  const missing = skill.fields.filter((f) => f.required && !values[f.name]?.trim()).map((f) => f.label);
  if (missing.length) throw new Error(`بيانات ناقصة لهذه القدرة: ${missing.join("، ")}.`);

  const prompt = skill.buildPrompt(values);

  const requestSummary = Object.entries(values)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v.length > 120 ? `${v.slice(0, 120)}…` : v}`)
    .join(" · ");


  const brainText = memoryBlock(brain ?? [], `${skill.title} ${requestSummary}`, 8);

  const research = await researchFor(
    params.employeeId,
    apiKey,
    { name: workspace.name, industry: workspace.industry },
    `${skill.title}\n${requestSummary}`,
    params.workspaceId,
  );

  // سِراج: أدلة سوشيال حيّة (اقتراحات البحث + نتائج لحظية) قبل أي حديث عن ترند
  // أو منافسين أو هاشتاقات — حتى لا تخرج أرقام أو أسماء من خيال النموذج.
  if (params.employeeId === "sonny") {
    try {
      const { socialEvidence, SOCIAL_RESEARCH_SKILLS } = await import("./social-research.server");
      if (SOCIAL_RESEARCH_SKILLS.has(skill.id)) {
        const topic =
          values["niche"] ||
          values["topic"] ||
          values["product"] ||
          values["business"] ||
          values["handle"] ||
          workspace.industry;
        const social = await socialEvidence(topic, {
          city: values["city"],
          platform: values["platform"],
          rivals: values["rivals"] || values["competitors"],
        });
        if (social.block) {
          research.block = research.block
            ? `${research.block}\n\n${social.block}`
            : social.block;
          research.used.push(...social.used);
        }
      }
    } catch (error) {
      console.error("[siraj] social evidence failed:", error);
    }
  }


  // سياق حيّ من حسابات العلامة المربوطة (بريد، تقويم، CRM…) عبر Pipedream.
  let live = { block: "", used: [] as string[] };
  try {
    const { liveContextFor } = await import("./pipedream-tools.server");
    live = await liveContextFor(
      client as unknown as Parameters<typeof liveContextFor>[0],
      params.employeeId,
      params.workspaceId,
    );
  } catch (error) {
    console.error("[live] context failed:", error);
  }


  const today = new Date();
  const todayAr = today.toLocaleDateString("ar-EG", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const ws = workspace as typeof workspace & {
    profile?: unknown;
    website?: string | null;
    country?: string | null;
  };
  const system = [
    `أنت ${persona.name}، ${persona.role}`,
    `تعمل داخل منصة «سهل» لصالح العلامة: ${workspace.name} (${workspace.industry}).`,
    `نبرة العلامة: ${workspace.tone}.`,
    `تاريخ اليوم: ${todayAr} (${today.toISOString().slice(0, 10)}). استخدم هذا التاريخ في أي جدول زمني أو تقويم أو إشارة زمنية، ولا تفترض سنة أقدم.`,
    workspace.banned_words?.length
      ? `كلمات ممنوعة تماماً: ${workspace.banned_words.join("، ")}.`
      : "",
    craft[params.employeeId] ? `## معايير حِرفتك\n${craft[params.employeeId]}` : "",
    ...sharedSystemBlocks({
      employeeId: params.employeeId,
      connected,
      profile: ws.profile,
      website: ws.website,
      country: ws.country,
    }),
    brainText ? `## عقل العلامة (ذاكرة مشتركة بين الفريق)\n${brainText}` : "",
    research.block ? `${evidenceRules}\n\n## أدلة ميدانية (لحظية)\n${research.block}` : "",
    live.block
      ? `## بيانات حسابات العلامة (حيّة الآن)\n${live.block}\n\nاعتمد على هذه البيانات الحقيقية في القرارات والأولويات والأسماء والمواعيد، ولا تخترع غيرها.`
      : "",

    "أنت تنفّذ الآن مهمة محددة وتسلّم مخرجاً نهائياً جاهزاً للاستخدام — لا أسئلة ولا مقدمات ولا اعتذارات.",
    // النموذج يميل لفتح المخرج بقائمة «بيانات ناقصة» — وهذا يفسد التسليم.
    // نمنعه: افترض افتراضات مهنية معقولة، واذكرها في سطر واحد في نهاية المخرج.
    "ممنوع أن تبدأ بقسم «معلومات ناقصة» أو أن تطلب بيانات إضافية أو تعتذر عن نقصها. افترض افتراضات مهنية معقولة ونفّذ، ثم اذكرها في سطر واحد فقط تحت عنوان «افتراضات» في نهاية المخرج.",
    "إن طُلب جدول، أكمله حتى آخر صف مطلوب ولا تتوقف في منتصفه، ولا تكتب «وهكذا» أو «باقي الأيام مشابهة».",
    "أي وصف صورة تكتبه للمولّد: بلا أي نص أو شعار أو حروف داخل الصورة إطلاقاً. اكتبه بالإنجليزية تحت عنوان «وصف الصورة» أو داخل كتلة كود.",
    actionTruthRules,
    "اكتب بالعربية الفصحى الواضحة، بصيغة Markdown منسّقة، والتزم حرفياً بالهيكل المطلوب.",
  ]
    .filter(Boolean)
    .join("\n");


  await client.from("messages").insert({
    workspace_id: params.workspaceId,
    employee_id: params.employeeId,
    role: "user",
    body: `▸ ${skill.title}${params.origin ? ` (${params.origin})` : ""}${requestSummary ? `\n${requestSummary}` : ""}`,
    conversation_id: params.conversationId ?? null,
  });

  const long = LONG_SKILLS.has(skill.id);
  const chat = (messages: { role: string; content: string }[]) =>
    freeChat(apiKey, messages as Parameters<typeof freeChat>[1], {
      timeoutMs: long ? 90_000 : 55_000,
      maxTokens: long ? 8000 : 3600,
    });

  let output = (await chat([
    { role: "system", content: system },
    { role: "user", content: prompt },
  ])).trim();

  if (!output) throw new Error("لم يصل مخرج من الموظف — أعد المحاولة.");

  // المخرجات الطويلة (تقويم شهري، استراتيجية ربعية) تُقطع أحياناً في منتصف جدول.
  // نطلب تكملة واحدة من نقطة القطع بدل تسليم جدول ناقص.
  if (isTruncated(output)) {
    try {
      const rest = (
        await chat([
          { role: "system", content: system },
          { role: "user", content: prompt },
          { role: "assistant", content: output },
          {
            role: "user",
            content:
              "المخرج انقطع. أكمل من حيث توقفت بالضبط دون إعادة أي سطر سبق، وابدأ مباشرة بالصف/السطر التالي حتى تُنهي كل الأقسام المطلوبة.",
          },
        ])
      ).trim();
      if (rest) output = `${output}\n${rest}`;
    } catch (error) {
      console.error("[run] continuation failed:", error);
    }
  }

  // إزالة المجاملات الافتتاحية («أهلاً بك… بصفتي…») حتى يبدأ المخرج بالمحتوى مباشرة.
  // لو كان المخرج كله مجاملة فلا نُفرغه — نُعيد الأصل بدل تسليم صفحة فارغة.
  output = sanitizeActionClaims(sanitizeOutput(stripPreamble(output) || output));



  // صورة رئيسية مجانية لكل مخرج تحريري (مقال/صفحة/حزمة نشر) — مثل Penny وأدق منها:
  // نستخدم مزوّداً بلا مفتاح وبلا حد يومي، والرابط دائم صالح للنشر مباشرة.
  if (ARTICLE_SKILLS.has(skill.id)) {
    try {
      const { ownedHeroImage, heroPrompt, extractImagePrompt } = await import("./image-gen.server");
      const subjectForImage =
        values["topic"] ||
        values["keyword"] ||
        values["subject"] ||
        values["product"] ||
        values["campaign"] ||
        values["business"] ||
        values["goal"] ||
        skill.title;

      const alt = `${subjectForImage}`.slice(0, 120);
      // إن كتب الموظف وصفاً بصرياً دقيقاً داخل المخرج (دانة/سِراج) نولّد الصورة منه
      // حرفياً بدل وصف عام — فتطابق الصورة ما وعد به النص.
      const authored = extractImagePrompt(output);
      const hero = await ownedHeroImage(
        client as unknown as Parameters<typeof ownedHeroImage>[0],
        params.workspaceId,
        authored ?? heroPrompt(subjectForImage, workspace.industry),
      );
      const lines = output.split("\n");
      const at = lines[0]?.startsWith("#") ? 1 : 0;
      lines.splice(at, 0, "", `![${alt}](${hero})`, "");
      output = lines.join("\n");
    } catch (error) {
      console.error("[nour] hero image failed:", error);
    }
  }

  const sources = [...research.used, ...live.used];
  if (sources.length) {
    output = `${output}\n\n> مصادر البيانات: ${sources.join(" · ")}`;
  }



  const { data: assistantRow, error: assistantError } = await client
    .from("messages")
    .insert({
      workspace_id: params.workspaceId,
      employee_id: params.employeeId,
      role: "assistant",
      body: output,
      conversation_id: params.conversationId ?? null,
    })
    .select("id")
    .single();
  if (assistantError) throw new Error(assistantError.message);

  const subject =
    params.values["keyword"] ||
    params.values["topic"] ||
    params.values["business"] ||
    params.values["product"] ||
    "";
  const title = `${skill.title}${subject ? ` — ${subject}` : ""}${params.origin ? ` · ${params.origin}` : ""}`;

  const { data: task } = await client
    .from("tasks")
    .insert({
      workspace_id: params.workspaceId,
      employee_id: params.employeeId,
      title,
      detail: requestSummary.slice(0, 400),
      kind: skill.kind,
      channel: skill.channel,
      status: "review",
      output,
      scheduled: "بانتظار اعتمادك",
      steps: [
        { label: "فهم الطلب", state: "done" },
        { label: "التنفيذ", state: "done" },
        { label: "مراجعتك", state: "active" },
        { label: "النشر", state: "todo" },
      ],
    })
    .select("id")
    .single();

  return {
    output,
    messageId: assistantRow?.id ?? null,
    taskId: task?.id ?? null,
    title,
    channel: skill.channel,
  };
}
