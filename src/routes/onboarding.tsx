import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";

import { useServerFn } from "@tanstack/react-start";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { BusinessProfileCard } from "@/components/app/BusinessProfileCard";
import { team } from "@/data/team";
import { saveAutomation } from "@/lib/automations.functions";
import { useAddBrainItem, useUpdateWorkspace, useWorkspace } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "جهّز فريقك في ٤ خطوات | سهل" },
      {
        name: "description",
        content: "عرّف سهل على نشاطك، اختر موظفيك، اربط حساباتك، وابدأ العمل خلال دقائق.",
      },
      { property: "og:title", content: "جهّز فريقك الرقمي في ٤ خطوات — سهل" },
      { property: "og:description", content: "إعداد كامل خلال ١١ دقيقة، بدون خبرة تقنية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

const steps = ["نشاطك", "نبرتك", "فريقك", "حساباتك"] as const;

const tones = [
  { id: "دافئة وقريبة، بدون مبالغة", label: "دافئة وقريبة", sample: "أهلاً! جهّزنا لك شيئاً يعجبك اليوم 🌿" },
  {
    id: "احترافية ورصينة",
    label: "احترافية ورصينة",
    sample: "يسرّنا مشاركتكم آخر تحديثات المنتج لهذا الربع.",
  },
  { id: "جريئة ومباشرة", label: "جريئة ومباشرة", sample: "توقف عن إضاعة ميزانيتك. إليك ما ينجح فعلاً." },
];

const field = "w-full rounded-2xl border border-border px-4 py-3 outline-none focus:border-jade";

function Onboarding() {
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const addBrain = useAddBrainItem(workspace?.id);
  const createAutomation = useServerFn(saveAutomation);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [about, setAbout] = useState("");
  const [tone, setTone] = useState(tones[0]!.id);
  const [banned, setBanned] = useState("الأفضل في العالم، مجاناً ١٠٠٪");
  const [hired, setHired] = useState<string[]>(team.map((t) => t.id));
  /** التكاملات المقترحة من تحليل الموقع — للعرض فقط، الربط الحقيقي من صفحة التكاملات. */
  const [recommended, setRecommended] = useState<string[]>([]);

  useEffect(() => {
    if (!workspace) return;
    setName((v) => v || workspace.name);
    setIndustry((v) => v || workspace.industry);
  }, [workspace]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const finish = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await updateWorkspace.mutateAsync({
        id: workspace.id,
        patch: {
          name: name || workspace.name,
          industry: industry || workspace.industry,
          initials: (name || workspace.name).slice(0, 2),
          tone,
          banned_words: banned
            .split("،")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      if (about.trim()) {
        await addBrain.mutateAsync({
          kind: "note",
          title: "ماذا نبيع ولمن",
          body: about.trim(),
          meta: "ملاحظة · من الإعداد الأولي",
        });
      }
      // لا نضع أي حساب في حالة «مربوط» بلا OAuth حقيقي — الربط يتم من صفحة التكاملات
      // لحظة الحاجة، وإلا ظنّ الموظفون أن النشر ممكن وهو ليس كذلك.
      // نور تبدأ العمل من أول يوم: 5 أفكار محتوى كل صباح بلا طلب منك
      try {
        await createAutomation({
          data: {
            workspaceId: workspace.id,
            employeeId: "nour",
            skillId: "daily-ideas",
            label: "5 أفكار محتوى كل صباح",
            values: {
              topic: industry || workspace.industry || name || workspace.name,
              count: "5",
            },
            cadence: "daily",
            dayOfWeek: 1,
            hour: 6,
            autoPublish: false,
            active: true,
          },
        });
      } catch (error) {
        console.error("[onboarding] daily ideas automation failed:", error);
      }
      // سِراج كذلك: 3 أفكار منشورات جاهزة كل صباح
      try {
        await createAutomation({
          data: {
            workspaceId: workspace.id,
            employeeId: "sonny",
            skillId: "social-daily-ideas",
            label: "3 أفكار منشورات كل صباح",
            values: {
              business: industry || workspace.industry || name || workspace.name,
              platform: "إنستغرام",
              dialect: "خليجية (السعودية/الإمارات)",
            },
            cadence: "daily",
            dayOfWeek: 1,
            hour: 7,
            autoPublish: false,
            active: true,
          },
        });
      } catch (error) {
        console.error("[onboarding] sonny daily ideas automation failed:", error);
      }
      void navigate({ to: "/app" });
    } finally {
      setSaving(false);
    }
  };

  const next = () => (step === steps.length - 1 ? void finish() : setStep(step + 1));

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link to="/" className="font-display text-2xl font-black">
          سهل<span className="text-jade">.</span>
        </Link>
        <Link to="/app" className="text-sm font-bold text-muted-foreground">
          تخطّي الإعداد
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20">
        <ol className="flex items-center gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-xs font-black transition-colors",
                  i < step && "bg-jade text-background",
                  i === step && "bg-foreground text-background",
                  i > step && "bg-secondary text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-bold sm:block",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
              {i < steps.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-3xl border border-border bg-card p-7 md:p-10">
          {step === 0 ? (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-black md:text-3xl">عرّفنا على نشاطك</h1>
              <p className="text-ink-soft">
                أسهل طريقة: ضع رابط موقعك ونملأ كل شيء عنك تلقائياً — أو اكتب بنفسك.
              </p>
              {workspace ? (
                <BusinessProfileCard
                  workspaceId={workspace.id}
                  compact
                  onProfiled={(p) => {
                    if (p.name) setName(p.name);
                    if (p.industry && p.industry !== "عام") setIndustry(p.industry);
                    const about = [p.summary, p.products.length ? `نبيع: ${p.products.join("، ")}` : "", p.audience ? `لمن: ${p.audience}` : ""]
                      .filter(Boolean)
                      .join("\n");
                    if (about) setAbout(about);
                    if (p.suggestedTone) setTone(p.suggestedTone);
                    setRecommended(p.recommendedIntegrations.map((i) => i.provider));
                  }}
                />
              ) : null}
              <label className="block">
                <span className="mb-2 block text-sm font-bold">اسم النشاط</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={field}
                  placeholder="مثال: نخلة للتمور الفاخرة"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">مجال النشاط</span>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className={field}
                  placeholder="تجزئة، مطاعم، خدمات…"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">ماذا تبيع ولمن؟</span>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className={cn(field, "min-h-32 resize-none")}
                  placeholder="نورّد تموراً فاخرة معبأة يدوياً للمتاجر والفنادق في السعودية…"
                />
              </label>
              <p className="flex items-center gap-2 rounded-2xl bg-secondary/60 p-4 text-sm text-ink-soft">
                <Sparkles className="size-4 shrink-0 text-jade" />
                هذا النص يذهب إلى عقل العلامة ويقرأه كل موظفيك.
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-black md:text-3xl">كيف تتكلم علامتك؟</h1>
              <div className="grid gap-3">
                {tones.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={cn(
                      "rounded-2xl border p-5 text-start transition-colors",
                      tone === t.id ? "border-jade bg-jade/8" : "border-border hover:bg-secondary/50",
                    )}
                  >
                    <span className="block font-bold">{t.label}</span>
                    <span className="mt-1 block text-sm text-ink-soft">«{t.sample}»</span>
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">كلمات ممنوعة</span>
                <input
                  value={banned}
                  onChange={(e) => setBanned(e.target.value)}
                  className={field}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-black md:text-3xl">من تريد أن يعمل معك؟</h1>
              <p className="text-ink-soft">كل الموظفين مشمولون في اشتراكك — فعّل من تحتاجه الآن.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {team.map((m) => {
                  const on = hired.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(hired, setHired, m.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-4 text-start transition-colors",
                        on ? "border-jade bg-jade/8" : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-2xl"
                        style={{ background: m.tintSoft, color: m.tint }}
                      >
                        <m.icon className="size-5" strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{m.name}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {m.role}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full border",
                          on ? "border-jade bg-jade text-background" : "border-border",
                        )}
                      >
                        {on ? <Check className="size-3.5" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-black md:text-3xl">حساباتك — عند الحاجة فقط</h1>
              <p className="text-ink-soft">
                لا نطلب ربط أي حساب الآن. موظفوك يبدؤون العمل فوراً بما فهمناه من موقعك، وعندما تطلب نشراً أو
                إرسالاً أو بيانات حقيقية سيطلب الموظف المعني ربط الحساب المحدد بضغطة واحدة عبر OAuth الرسمي.
              </p>
              <div>
                <p className="mb-2 text-sm font-bold">
                  {recommended.length ? "الأعلى فائدة لنشاطك تحديداً:" : "أكثر الحسابات فائدة عادةً:"}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(recommended.length ? recommended : ["instagram", "search-console", "gmail", "wordpress", "analytics", "whatsapp"]).map((p) => (
                    <div
                      key={p}
                      className="flex items-center gap-2.5 rounded-2xl border border-border p-4 text-start"
                    >
                      <AppIcon name={p} className="size-5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{appLabel(p)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="flex items-center gap-2 rounded-2xl bg-secondary/60 p-4 text-sm text-ink-soft">
                <Sparkles className="size-4 shrink-0 text-jade" />
                يمكنك ربط أي حساب في أي وقت من صفحة «التكاملات» — لا نحتفظ بأي كلمة مرور.
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold disabled:opacity-40"
            >
              <ArrowRight className="size-4" /> السابق
            </button>
            <button
              onClick={next}
              disabled={saving || !workspace}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {step === steps.length - 1 ? "ابدأ العمل" : "التالي"}
              <ArrowLeft className="size-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
