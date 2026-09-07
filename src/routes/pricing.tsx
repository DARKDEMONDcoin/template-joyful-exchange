import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { plans, priceOf, currencyOf } from "@/data/pricing";
import { useRegion } from "@/hooks/use-region";
import { RegionPicker } from "@/components/site/Portrait";


export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "الأسعار | فريق كامل بأقل من راتب موظف واحد — سهل" },
      {
        name: "description",
        content:
          "ثلاث باقات واضحة بدون رسوم خفية: البداية، النمو، والمؤسسات. جرّب 14 يوماً مجاناً وألغِ في أي وقت.",
      },
      { property: "og:title", content: "أسعار سهل" },
      {
        property: "og:description",
        content: "ابدأ بـ 149 ريالاً شهرياً لموظف رقمي كامل يعمل 24/7 بالعربية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

// الباقات مصدرها ملف واحد مشترك مع قسم الأسعار في الصفحة الرئيسية.


const matrix: { f: string; v: (boolean | string)[] }[] = [
  { f: "عدد الموظفين الرقميين", v: ["1", "6", "6+"] },
  { f: "المهام الشهرية", v: ["60", "1000", "غير محدودة"] },
  { f: "النشر التلقائي على 7 منصات", v: [true, true, true] },
  { f: "مسارات عمل بين الموظفين", v: [false, true, true] },
  { f: "صندوق العملاء الموحّد", v: [false, true, true] },
  { f: "سجل تدقيق وتصدير كامل", v: [true, true, true] },
  { f: "صلاحيات فريق متعددة", v: [false, false, true] },
  { f: "مدير حساب مخصص", v: [false, false, true] },
];

function PricingPage() {
  const { country } = useRegion();
  const cur = currencyOf(country);
  return (
    <PageShell>
      <PageHero
        eyebrow="أسعار واضحة"
        title="فريق كامل بأقل من راتب موظف مبتدئ"
        lead="بدون رسوم إعداد، بدون عقد سنوي إجباري، وبدون مفاجآت في الفاتورة. الأسعار شهرية وتُعرض تقريبياً بعملة بلدك."
      />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>العملة حسب بلدك:</span>
          <RegionPicker />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.id} delay={i * 70}>
              <div
                className={
                  p.highlight
                    ? "relative h-full overflow-hidden rounded-3xl p-[2px] shadow-lift"
                    : "h-full rounded-3xl border border-border bg-card p-8 shadow-card"
                }
                style={
                  p.highlight
                    ? { backgroundImage: "var(--gradient-aurora)", backgroundSize: "200% 200%" }
                    : undefined
                }
              >
                <div
                  className={
                    p.highlight ? "h-full rounded-[calc(1.5rem-2px)] bg-card p-8" : "contents"
                  }
                >
                  {p.highlight ? (
                    <span className="mb-4 inline-flex rounded-full bg-jade/15 px-3 py-1 text-xs font-bold text-jade-deep">
                      الأكثر اختياراً
                    </span>
                  ) : null}
                  <h2 className="font-display text-2xl font-black">{p.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{p.tag}</p>
                  <div className="mt-6 flex items-end gap-2">
                    <span className="font-display text-4xl font-black text-primary">
                      {priceOf(p, false, country)}
                    </span>
                    {p.monthly !== null ? (
                      <span className="pb-1 text-sm text-muted-foreground">{cur.label} / شهرياً</span>
                    ) : null}
                  </div>

                  <ul className="mt-6 space-y-3">
                    {p.perks.map((k) => (
                      <li key={k} className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-jade/15 text-jade-deep">
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                        <span className="leading-relaxed">{k}</span>
                      </li>
                    ))}
                  </ul>
                  {p.id === "scale" ? (
                    <Link
                      to="/contact"
                      className="mt-8 block rounded-full border border-border py-3.5 text-center font-bold transition-colors hover:bg-secondary"
                    >
                      {p.cta}
                    </Link>
                  ) : (
                    <Link
                      to="/auth"
                      search={{ mode: "signup", plan: p.id }}
                      className={
                        p.highlight
                          ? "mt-8 block rounded-full bg-foreground py-3.5 text-center font-bold text-background transition-transform duration-300 hover:-translate-y-1"
                          : "mt-8 block rounded-full border border-border py-3.5 text-center font-bold transition-colors hover:bg-secondary"
                      }
                    >
                      {p.cta}
                    </Link>
                  )}

                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <Reveal>
          <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[36rem] text-right">
              <thead>
                <tr className="border-b border-border text-sm">
                  <th className="p-5 font-display text-base font-black">المقارنة</th>
                  {plans.map((p) => (
                    <th key={p.id} className="p-5 font-display text-base font-black">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.f} className="border-b border-border/70 last:border-0">
                    <td className="p-5 font-medium">{row.f}</td>
                    {row.v.map((v, idx) => (
                      <td key={idx} className="p-5">
                        {typeof v === "boolean" ? (
                          v ? (
                            <Check className="size-5 text-jade-deep" strokeWidth={3} />
                          ) : (
                            <Minus className="size-5 text-muted-foreground" />
                          )
                        ) : (
                          <span className="font-bold">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          كل الباقات تشمل: تشفير البيانات، تصدير كامل في أي وقت، وإلغاء بضغطة دون مكالمة احتفاظ.
        </p>
      </section>

      <CtaBand title="جرّب قبل أن تدفع" lead="١٤ يوماً كاملة بكل مزايا باقة النمو، بدون بطاقة." />
    </PageShell>
  );
}
