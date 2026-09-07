import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/Reveal";

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-20">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: "var(--gradient-ink)" }}
      />
      <div
        aria-hidden
        className="absolute -top-1/2 -left-1/4 h-[140%] w-[80%] opacity-45 blur-3xl"
        style={{
          backgroundImage: "var(--gradient-aurora)",
          backgroundSize: "200% 200%",
          animation: "aurora-pan 20s ease-in-out infinite",
          borderRadius: "48% 52% 40% 60%",
        }}
      />
      <div aria-hidden className="grid-lines absolute inset-0 opacity-30" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-24"
        style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }}
      />
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        {eyebrow ? (
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">
              {eyebrow}
            </span>
          </Reveal>
        ) : null}
        <Reveal delay={70}>
          <h1 className="mt-6 font-display text-[2.2rem] leading-[1.2] font-black text-white md:text-5xl">
            {title}
          </h1>
        </Reveal>
        {lead ? (
          <Reveal delay={140}>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/90">{lead}</p>
          </Reveal>
        ) : null}
        {children ? <Reveal delay={200}>{children}</Reveal> : null}
      </div>
    </section>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function CtaBand({
  title = "فريقك الجديد جاهز للعمل الليلة",
  lead = "ابدأ مجاناً بدون بطاقة ائتمان. أول منشور خلال دقائق، وأول تقرير خلال أسبوع.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section className="px-5 py-20">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] p-10 text-center md:p-16">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: "var(--gradient-aurora)",
              backgroundSize: "200% 200%",
              animation: "aurora-pan 14s ease-in-out infinite",
            }}
          />
          <div aria-hidden className="grid-lines absolute inset-0 opacity-40" />
          <div className="relative">
            <h2 className="font-display text-3xl leading-tight font-black text-white md:text-5xl">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">{lead}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/contact"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 font-bold text-background transition-transform duration-300 hover:-translate-y-1"
              >
                وظّف فريقك الآن
                <ArrowLeft className="size-5 transition-transform duration-300 group-hover:-translate-x-1" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center rounded-full border border-white/60 bg-white/15 px-7 py-4 font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                شاهد الأسعار
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
