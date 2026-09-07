import { Reveal } from "@/components/Reveal";

const steps = [
  {
    n: "01",
    t: "عرّفنا بشركتك",
    d: "رابط موقعك أو ثلاث جمل تكفي. الفريق يقرأ ويبني ملف علامتك التجارية تلقائياً.",
  },
  {
    n: "02",
    t: "اختر موظفيك",
    d: "فعّل من تحتاجه فقط — سِراج للسوشيال، أمَل للبريد، سالم للمبيعات — واربط حساباتك بأمان.",
  },
  {
    n: "03",
    t: "حدّد مستوى التحكم",
    d: "راجع كل مخرج قبل النشر، أو شغّل الوضع التلقائي الكامل ودعهم يعملون.",
  },
  {
    n: "04",
    t: "تابع النتائج",
    d: "لوحة واحدة تعرض ما أُنجز، ما تكلّف، وماذا حقق — مع توصيات أسبوعية.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
      <Reveal>
        <p className="text-sm font-bold tracking-wider text-primary">كيف يعمل</p>
        <h2 className="mt-3 font-display text-4xl leading-tight font-black md:text-5xl">
          من التسجيل إلى أول منشور في 8 دقائق
        </h2>
      </Reveal>

      <ol className="relative mt-14 grid gap-8 md:grid-cols-4">
        <span
          aria-hidden
          className="absolute inset-x-0 top-6 hidden h-px md:block"
          style={{ backgroundImage: "var(--gradient-aurora)", opacity: 0.5 }}
        />
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 110}>
            <li className="relative">
              <span
                className="relative z-10 grid size-12 place-items-center rounded-2xl font-display font-black text-background"
                style={{ backgroundImage: "var(--gradient-ink)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-5 font-display text-xl font-extrabold">{s.t}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
