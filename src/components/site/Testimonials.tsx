import { Star } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const quotes = [
  {
    q: "أول مرة أشوف أداة تكتب بلهجتنا بدون ما تبان مترجمة. سِراج بيدير حسابات ٣ فروع لوحده.",
    n: "ريم القحطاني",
    r: "مؤسِّسة، سلسلة مقاهي",
  },
  {
    q: "وفّرت راتب مسؤول سوشيال كامل، والتفاعل زاد أكتر من الضعف في شهرين.",
    n: "أحمد شوقي",
    r: "متجر إلكتروني",
  },
  {
    q: "أمَل بتفلتر بريدي الصبح وتخليني أبدأ يومي بقرارات مش برسايل.",
    n: "ليلى بن عمر",
    r: "استشارية تسويق",
  },
  {
    q: "الصور بالنص العربي كانت المشكلة الأكبر عندي — هنا اتحلّت بالكامل.",
    n: "خالد المرزوقي",
    r: "وكالة إعلانات",
  },
];

export function Testimonials() {
  const row = [...quotes, ...quotes];
  return (
    <section className="overflow-hidden py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="text-sm font-bold tracking-wider text-primary">آراء العملاء</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight font-black md:text-5xl">
            أصحاب مشاريع يشتغلون بفريق <span className="text-gradient">أصغر وأسرع</span>
          </h2>
        </Reveal>
      </div>
      <div className="relative mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="marquee-track-rtl gap-5">
          {row.map((t, i) => (
            <figure
              key={`${t.n}-${i}`}
              className="w-[22rem] shrink-0 rounded-3xl border border-border bg-card p-7 shadow-card"
            >
              <div className="flex gap-0.5 text-amber" aria-label="تقييم 5 من 5">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="size-4 fill-current" strokeWidth={0} />
                ))}
              </div>
              <blockquote className="mt-4 text-lg leading-relaxed">«{t.q}»</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  className="grid size-10 place-items-center rounded-full font-display font-black text-background"
                  style={{ backgroundImage: "var(--gradient-ink)" }}
                >
                  {t.n.charAt(0)}
                </span>
                <span>
                  <span className="block font-bold">{t.n}</span>
                  <span className="block text-sm text-muted-foreground">{t.r}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
