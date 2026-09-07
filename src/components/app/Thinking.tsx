import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { Portrait } from "@/components/site/Portrait";
import { cn } from "@/lib/utils";

/** لمسة كل موظف: أول مرحلة وآخر مرحلة تعكسان مهنته. */
const OPENING: Record<string, string> = {
  nour: "تقرأ طلبك وتحدّد نية البحث",
  sonny: "يقرأ طلبك ويحدّد زاوية المنشور",
  eva: "تقرأ الرسالة وتفهم سياق العميل",
  sam: "يقرأ الطلب ويحدد الفرصة",
  dana: "تقرأ الطلب وتحدّد الاتجاه البصري",
  adam: "يقرأ الطلب ويحدد الأرقام المطلوبة",
};
const CLOSING: Record<string, string> = {
  nour: "تراجع الدقة والمصادر قبل التسليم",
  sonny: "يضبط النبرة والهاشتاقات",
  eva: "تراجع الرد قبل الإرسال",
  sam: "يجهّز الخطوة التالية",
  dana: "تضبط اللمسة النهائية",
  adam: "يكتب الخلاصة بوضوح",
};

/**
 * مراحل مشتقّة من الطلب الفعلي — لا عبارات محفوظة عامة: نقرأ ما طلبه المستخدم
 * (بحث، رابط، صورة، نشر، جدولة، منافس…) ونعرض الخطوات التي ستُنفَّذ فعلاً.
 */
export function phasesFor(
  memberId: string,
  request: string,
  opts: { imageRequested?: boolean; attachments?: number } = {},
): string[] {
  const t = (request ?? "").toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  const steps: string[] = [OPENING[memberId] ?? "يقرأ طلبك"];

  if (opts.attachments) steps.push(`يفحص ${opts.attachments} مرفقاً أرسلته`);
  steps.push("يستحضر عقل علامتك ونبرتها");

  const urls = (request.match(/https?:\/\/\S+/g) ?? []).length;
  if (urls) steps.push(urls > 1 ? `يحلّل ${urls} روابط أرسلتها` : "يحلّل الرابط الذي أرسلته");
  if (has("منافس", "مقارنة", "competitor")) steps.push("يقارن بمحتوى المنافسين");
  if (has("بحث", "كلمات", "سيو", "seo", "ترتيب", "كيوورد")) steps.push("يبحث في مصادر حية ويجمع الأدلة");
  if (has("تحليل", "تقرير", "أرقام", "نتائج", "احصائ", "إحصائ")) steps.push("يقرأ البيانات ويستخرج الأنماط");
  if (has("انستغرام", "انستقرام", "instagram")) steps.push("يكيّف الصياغة لإنستغرام");
  if (has("فيسبوك", "facebook")) steps.push("يكيّف الصياغة لفيسبوك");
  if (has("لينكد", "linkedin")) steps.push("يكيّف الصياغة لينكدإن");
  if (has("انشر", "نشر", "publish")) steps.push("يجهّز المنشور للنشر ويتحقق من الاتصال");
  if (has("جدول", "موعد", "بكرة", "غدا", "الأسبوع")) steps.push("يحسب أفضل توقيت للجدولة");
  if (opts.imageRequested || has("صورة", "صور", "تصميم")) steps.push("يصوغ وصف الصورة ثم يولّدها");
  if (has("مقال", "تدوينة", "طويل", "دليل")) steps.push("يبني الهيكل ثم يكتب الأقسام");

  steps.push("يصوغ المخرج بعربية طبيعية");
  steps.push(CLOSING[memberId] ?? "يراجع الجودة قبل التسليم");
  return Array.from(new Set(steps));
}

export function Thinking({
  memberId,
  name,
  className,
  request = "",
  imageRequested,
  attachments,
}: {
  memberId: string;
  name: string;
  className?: string;
  request?: string;
  imageRequested?: boolean;
  attachments?: number;
}) {
  const phases = useMemo(
    () => phasesFor(memberId, request, { ...(imageRequested !== undefined ? { imageRequested } : {}), ...(attachments !== undefined ? { attachments } : {}) }),
    [memberId, request, imageRequested, attachments],
  );
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  const started = useRef(Date.now());

  useEffect(() => {
    started.current = Date.now();
    setI(0);
    setSecs(0);
  }, [request]);

  useEffect(() => {
    // آخر مرحلة تبقى ظاهرة حتى يصل الرد فعلاً — لا نلفّ من البداية كأننا نعيد العمل.
    const t = setInterval(() => {
      setSecs(Math.round((Date.now() - started.current) / 1000));
      setI((v) => Math.min(v + 1, phases.length - 1));
    }, 2200);
    return () => clearInterval(t);
  }, [phases.length]);

  return (
    <div
      className={cn("flex justify-end gap-3 animate-bubble-in", className)}
      role="status"
      aria-live="polite"
      aria-label={`${name} يعمل على طلبك`}
    >
      <span className="relative order-2 block size-9 shrink-0 rounded-xl">
        <span className="absolute inset-0 rounded-xl animate-pulse-ring" />
        <span className="relative block size-full overflow-hidden rounded-xl shadow-sm">
          <Portrait memberId={memberId} name={name} className="size-full" />
        </span>
        <span className="absolute -bottom-1 -start-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-2.5" strokeWidth={2.8} />
        </span>
      </span>

      <div className="order-1 w-[min(30rem,88%)] rounded-3xl rounded-se-lg border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex items-end gap-1" aria-hidden>
            <span className="size-1.5 rounded-full bg-primary think-dot" />
            <span className="size-1.5 rounded-full bg-primary think-dot [animation-delay:0.18s]" />
            <span className="size-1.5 rounded-full bg-primary think-dot [animation-delay:0.36s]" />
          </span>
          <span key={i} className="min-w-0 truncate text-sm font-bold shimmer-text animate-fade-in">
            {name} {phases[i]}…
          </span>
          {secs > 3 ? (
            <span className="ms-auto shrink-0 text-[0.7rem] font-semibold tabular-nums text-muted-foreground">
              {secs}ث
            </span>
          ) : null}
        </div>

        <ol className="mt-3 space-y-1.5 text-[0.72rem] text-muted-foreground">
          {phases.slice(Math.max(0, i - 2), i).map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-jade" aria-hidden />
              <span className="truncate line-through/0">{p}</span>
            </li>
          ))}
        </ol>

        <div className="mt-3 space-y-2" aria-hidden>
          <span className="block h-2.5 w-[92%] rounded-full shimmer-line" />
          <span className="block h-2.5 w-[74%] rounded-full shimmer-line [animation-delay:0.2s]" />
          <span className="block h-2.5 w-[58%] rounded-full shimmer-line [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  );
}
