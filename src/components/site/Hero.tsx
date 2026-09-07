import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Image as ImageIcon, Send, Star } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const rotating = ["ينشرون على السوشيال", "يردون على عملائك", "يصممون منشوراتك", "يتابعون مبيعاتك"];

const feed = [
  { icon: Send, text: "سِراج نشر 4 منشورات على إنستجرام و لينكدإن", time: "الآن" },
  { icon: ImageIcon, text: "تم توليد 6 صور بنص عربي لحملة الجمعة", time: "منذ دقيقتين" },
  { icon: CheckCircle2, text: "أمَل ردّت على 18 رسالة عميل وفلترت 42 إيميل", time: "منذ 9 دقائق" },
  { icon: Star, text: "التفاعل ارتفع 3.2× مقارنة بالشهر الماضي", time: "منذ ساعة" },
];

export function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % rotating.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: "var(--gradient-ink)" }}
      />
      <div
        aria-hidden
        className="absolute -top-1/3 -left-1/4 h-[120%] w-[90%] opacity-60 blur-3xl"
        style={{
          backgroundImage: "var(--gradient-aurora)",
          backgroundSize: "200% 200%",
          animation: "aurora-pan 18s ease-in-out infinite",
          borderRadius: "48% 52% 40% 60%",
        }}
      />
      <div
        aria-hidden
        className="absolute -right-1/4 -bottom-1/3 h-[90%] w-[70%] opacity-40 blur-3xl"
        style={{
          backgroundImage: "var(--gradient-aurora)",
          backgroundSize: "200% 200%",
          animation: "aurora-pan 22s ease-in-out infinite reverse",
          borderRadius: "60% 40% 55% 45%",
        }}
      />
      <div aria-hidden className="grid-lines absolute inset-0 opacity-40" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-32"
        style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="min-w-0">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/25 px-4 py-1.5 text-xs font-semibold sm:text-sm text-white backdrop-blur">
              <span className="size-2 rounded-full bg-white animate-pulse-ring" />
              أول منصة موظفين بالذكاء الاصطناعي لمصر والوطن العربي
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-[2rem] leading-[1.2] sm:text-[2.6rem] font-black text-white drop-shadow-sm md:text-[3.4rem] lg:text-[3.75rem]">
              <span className="block md:whitespace-nowrap">وظّف فريق ذكاء اصطناعي</span>
              <span className="relative mt-1 block h-[1.3em] overflow-hidden text-amber [text-shadow:0_2px_24px_oklch(0.7_0.125_79_/_0.35)]">
                {rotating.map((w, idx) => (
                  <span
                    key={w}
                    aria-hidden={idx !== i}
                    className="absolute inset-x-0 whitespace-nowrap transition-all duration-600 ease-out"
                    style={{
                      transform: `translateY(${(idx - i) * 100}%)`,
                      opacity: idx === i ? 1 : 0,
                    }}
                  >
                    {w}
                  </span>
                ))}
                <span className="invisible whitespace-nowrap">ينشرون على السوشيال</span>
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90">
              موظفون رقميون بأسماء ووجوه وأدوار حقيقية، يشتغلون 24/7 داخل حساباتك: ينشرون، يصممون،
              يردّون، ويبيعون — بلهجتك، وبتكلفة جزء بسيط من راتب موظف واحد.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" as const }}
                className="group inline-flex items-center gap-2 rounded-full bg-background px-7 py-3.5 font-bold text-foreground shadow-lift transition-transform duration-300 hover:-translate-y-1"
              >
                جرّب مجاناً — بدون بطاقة
                <ArrowLeft className="size-4.5 transition-transform duration-300 group-hover:-translate-x-1" />
              </Link>
              <a
                href="#employees"
                className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-6 py-3.5 font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                تعرّف على الفريق
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-white/85">
              {["إعداد في 8 دقائق", "7 منصات نشر", "صور بنص عربي سليم", "إلغاء في أي وقت"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-amber" strokeWidth={2.4} />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Live console mock */}
        <Reveal delay={200}>
          <div className="animate-float rounded-3xl border border-white/40 bg-card/95 p-4 shadow-lift backdrop-blur">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-coral" />
                <span className="size-2.5 rounded-full bg-amber" />
                <span className="size-2.5 rounded-full bg-jade" />
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="size-1.5 rounded-full bg-jade animate-pulse" />
                لوحة فريقك · مباشر
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 py-4">
              {[
                { k: "منشور اليوم", v: "24" },
                { k: "رد على عميل", v: "137" },
                { k: "ساعة موفَّرة", v: "68" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl bg-secondary/70 p-3 text-center">
                  <div className="font-display text-2xl font-black text-primary">{s.v}</div>
                  <div className="mt-0.5 text-[0.7rem] text-muted-foreground">{s.k}</div>
                </div>
              ))}
            </div>

            <ul className="space-y-2">
              {feed.map((f, idx) => (
                <li
                  key={f.text}
                  style={{ animationDelay: `${idx * 220 + 400}ms` }}
                  className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 opacity-0 [animation:ticker-up_0.6s_ease-out_forwards]"
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-jade/15 text-jade-deep">
                    <f.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug font-medium">{f.text}</p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{f.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
