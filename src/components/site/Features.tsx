import { Languages, ShieldCheck, Zap, Layers, Video, Wallet } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const items = [
  {
    icon: Languages,
    title: "عربي أصيل، مش ترجمة",
    body: "يكتب بالفصحى وبالمصري والخليجي والمغاربي، ويولّد صوراً بنص عربي منسّق بدون حروف مكسورة.",
    span: "md:col-span-2",
  },
  {
    icon: Video,
    title: "فيديو قصير تلقائي",
    body: "ريلز وتيك توك من مقال أو منتج، مع تعليق صوتي عربي وترجمة على الشاشة.",
    span: "",
  },
  {
    icon: Zap,
    title: "نشر في التوقيت الذكي",
    body: "يتعلّم متى يتفاعل جمهورك فعلاً ويجدول النشر على أساسه.",
    span: "",
  },
  {
    icon: Layers,
    title: "ذاكرة مشتركة للفريق",
    body: "كل موظف يعرف علامتك التجارية، منتجاتك، ونبرتك — سياق واحد يتحدث تلقائياً.",
    span: "md:col-span-2",
  },
  {
    icon: Wallet,
    title: "رصيد شفاف يترحّل",
    body: "تشوف تكلفة كل مهمة بالضبط، والرصيد غير المستخدم ينتقل للشهر التالي.",
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "موافقتك قبل أي نشر",
    body: "وضع المراجعة اختياري: راجع كل شيء، أو اترك الفريق يشتغل بالكامل.",
    span: "",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 border-y border-border bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="text-sm font-bold tracking-wider text-primary">لماذا سهل</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight font-black md:text-5xl">
            كل ما ينقص الأدوات الأجنبية — <span className="text-gradient">مبني من الأساس</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 70} className={it.span}>
              <article className="group h-full rounded-3xl border border-border bg-card p-7 transition-all duration-400 hover:-translate-y-1 hover:shadow-lift">
                <span className="grid size-11 place-items-center rounded-2xl bg-jade/12 text-jade-deep transition-colors duration-300 group-hover:bg-jade group-hover:text-background">
                  <it.icon className="size-5" strokeWidth={2.2} />
                </span>
                <h3 className="mt-5 font-display text-xl font-extrabold">{it.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{it.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
