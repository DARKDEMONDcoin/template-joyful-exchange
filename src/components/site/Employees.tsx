import { useState } from "react";
import { Megaphone, Mail, Handshake, PenTool, Palette, LineChart } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { Portrait, RegionPicker } from "@/components/site/Portrait";
import { cn } from "@/lib/utils";

type Employee = {
  id: string;
  name: string;
  role: string;
  icon: typeof Megaphone;
  tint: string;
  summary: string;
  tasks: string[];
  metric: { k: string; v: string }[];
};

const employees: Employee[] = [
  {
    id: "sonny",
    name: "سِراج",
    role: "مدير السوشيال ميديا",
    icon: Megaphone,
    tint: "var(--jade)",
    summary:
      "يخطط المحتوى الشهري، يكتب المنشورات بلهجتك، يولّد الصور بنص عربي سليم، وينشر بنفسه في أفضل توقيت لكل منصة.",
    tasks: [
      "تقويم محتوى شهري كامل بضغطة",
      "توليد صور ومقاطع قصيرة بالعلامة التجارية",
      "نشر تلقائي على 7 منصات + رد على التعليقات",
      "تقرير أسبوعي بالتفاعل والوصول",
    ],
    metric: [
      { k: "منشور/شهر", v: "120+" },
      { k: "نمو التفاعل", v: "3.2×" },
    ],
  },
  {
    id: "eva",
    name: "أمَل",
    role: "المساعدة التنفيذية",
    icon: Mail,
    tint: "var(--sky)",
    summary:
      "تفرز بريدك، ترد على المتكرر، ترتّب مواعيدك، وتحضّر لك ملخّص يومي قصير لكل ما يحتاج قرارك.",
    tasks: [
      "فلترة وترتيب البريد حسب الأولوية",
      "ردود جاهزة بأسلوبك تحتاج موافقتك فقط",
      "إدارة التقويم وحجز الاجتماعات",
      "ملخص صباحي في 60 ثانية",
    ],
    metric: [
      { k: "إيميل/يوم", v: "300+" },
      { k: "ساعة موفَّرة", v: "12/أسبوع" },
    ],
  },
  {
    id: "sam",
    name: "سالم",
    role: "مسؤول المبيعات",
    icon: Handshake,
    tint: "var(--amber)",
    summary:
      "يبحث عن العملاء المحتملين، يراسلهم برسائل مخصصة، ويتابع حتى الرد — ويحدّث خط المبيعات تلقائياً.",
    tasks: [
      "بناء قوائم عملاء محتملين مطابقة لمواصفاتك",
      "رسائل تواصل مخصصة لكل عميل",
      "متابعة آلية مهذبة حتى الرد",
      "تحديث CRM وتنبيهك بالفرص الساخنة",
    ],
    metric: [
      { k: "رسالة/شهر", v: "1,500" },
      { k: "معدل الرد", v: "12%" },
    ],
  },
  {
    id: "nour",
    name: "نور",
    role: "كاتبة المحتوى والسيو",
    icon: PenTool,
    tint: "var(--coral)",
    summary:
      "تكتب مقالات مدونة وصفحات هبوط عربية مهيّأة لمحركات البحث، بكلمات مفتاحية حقيقية من سوقك.",
    tasks: [
      "بحث كلمات مفتاحية بالعربي واللهجات",
      "مقالات طويلة جاهزة للنشر",
      "تحسين الصفحات القديمة",
      "روابط داخلية وبيانات منظمة",
    ],
    metric: [
      { k: "مقال/شهر", v: "20" },
      { k: "زيارات عضوية", v: "+180%" },
    ],
  },
  {
    id: "dana",
    name: "دانة",
    role: "المصممة",
    icon: Palette,
    tint: "var(--jade-deep)",
    summary:
      "تحوّل أفكارك إلى هويّة بصرية متسقة: بانرات، إعلانات، وقوالب منشورات — بخطوط عربية أنيقة.",
    tasks: [
      "دليل هوية بصرية مبسّط",
      "قوالب منشورات وإعلانات",
      "صور منتجات ولقطات إعلانية",
      "نسخ متعددة لاختبار A/B",
    ],
    metric: [
      { k: "تصميم/شهر", v: "200+" },
      { k: "وقت التسليم", v: "ثوانٍ" },
    ],
  },
  {
    id: "adam",
    name: "آدم",
    role: "محلل البيانات",
    icon: LineChart,
    tint: "var(--sky)",
    summary: "يجمع أرقامك من كل المنصات في لوحة واحدة، ويخبرك بما يجب إيقافه وما يجب مضاعفته.",
    tasks: [
      "لوحة موحّدة لكل القنوات",
      "تنبيهات عند أي هبوط مفاجئ",
      "توصيات أسبوعية قابلة للتنفيذ",
      "تقارير جاهزة للمشاركة",
    ],
    metric: [
      { k: "مصدر بيانات", v: "15" },
      { k: "تقرير", v: "تلقائي" },
    ],
  },
];

export function Employees() {
  const [active, setActive] = useState(employees[0]!.id);
  const current = employees.find((e) => e.id === active)!;

  return (
    <section id="employees" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
      <Reveal>
        <p className="text-sm font-bold tracking-wider text-primary">الفريق</p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight font-black md:text-5xl">
          ستة موظفين، <span className="text-gradient">اشتراك واحد</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          كل موظف متخصص في مجاله ومتصل ببقية الفريق. يتشاركون نفس السياق عن شركتك، فلا تشرح نفسك
          مرتين — ويظهرون لك بزيّ بلدك من مصر إلى المغرب ومن الخليج إلى السودان.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">فريقك بزيّ بلدك:</span>
          <RegionPicker />
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {employees.map((e) => {
              const on = e.id === active;
              return (
                <li key={e.id}>
                  <button
                    onMouseEnter={() => setActive(e.id)}
                    onFocus={() => setActive(e.id)}
                    onClick={() => setActive(e.id)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl border p-4 text-right transition-all duration-300",
                      on
                        ? "-translate-y-0.5 border-transparent bg-card shadow-lift"
                        : "border-border bg-card/40 hover:bg-card",
                    )}
                  >
                    <span
                      className="relative size-12 shrink-0 overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-card transition-all duration-300"
                      style={{ ["--tw-ring-color" as string]: e.tint }}
                    >
                      <Portrait
                        memberId={e.id}
                        name={e.name}
                        className="size-full scale-105 transition-transform duration-500"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-extrabold">{e.name}</span>
                      <span className="block text-sm text-muted-foreground">{e.role}</span>
                    </span>
                    <span
                      className={cn(
                        "mr-auto h-8 w-1 rounded-full transition-all duration-300",
                        on ? "opacity-100" : "opacity-0",
                      )}
                      style={{ backgroundColor: e.tint }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal delay={100}>
          <div
            key={current.id}
            className="relative h-full overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card"
          >
            <div
              aria-hidden
              className="absolute -top-24 -left-24 size-56 rounded-full opacity-25 blur-3xl"
              style={{ backgroundColor: current.tint }}
            />
            <div className="relative">
              <div className="flex items-center gap-5">
                <span className="relative block size-24 shrink-0 overflow-hidden rounded-3xl shadow-card">
                  <Portrait memberId={current.id} name={current.name} className="size-full" />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-1/3"
                    style={{
                      background: `linear-gradient(to top, color-mix(in oklab, ${current.tint} 55%, transparent), transparent)`,
                    }}
                  />
                </span>
                <div>
                  <h3 className="font-display text-2xl font-black">{current.name}</h3>
                  <p className="text-muted-foreground">{current.role}</p>
                  <span
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{
                      background: `color-mix(in oklab, ${current.tint} 16%, transparent)`,
                      color: current.tint,
                    }}
                  >
                    <current.icon className="size-3.5" strokeWidth={2.4} />
                    متاح الآن
                  </span>
                </div>
              </div>


              <p className="mt-6 text-lg leading-relaxed">{current.summary}</p>

              <ul className="mt-6 space-y-3">
                {current.tasks.map((t, i) => (
                  <li
                    key={t}
                    style={{ animationDelay: `${i * 90}ms` }}
                    className="flex items-start gap-3 opacity-0 [animation:ticker-up_0.5s_ease-out_forwards]"
                  >
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: current.tint }}
                    />
                    <span className="text-ink-soft">{t}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex gap-3">
                {current.metric.map((m) => (
                  <div key={m.k} className="flex-1 rounded-2xl bg-secondary/70 p-4">
                    <div className="font-display text-2xl font-black">{m.v}</div>
                    <div className="text-xs text-muted-foreground">{m.k}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
