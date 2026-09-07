import { Link } from "@tanstack/react-router";

import { PageShell, PageHero } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export type LegalSection = {
  /** معرّف الرابط المباشر للقسم — يُستخدم في فهرس المحتويات. */
  id: string;
  h: string;
  /** فقرات نصية؛ يمكن أن تبدأ الفقرة بـ«• » لتظهر كنقطة. */
  p: string[];
};

/**
 * قالب موحّد لكل الصفحات القانونية: فهرس محتويات جانبي، أقسام مرقّمة بروابط مباشرة،
 * وتذييل يربط بقية المستندات القانونية — ليسهل على فرق المراجعة في الشركات تصفّحها.
 */
export function LegalDoc({
  title,
  lead,
  updated,
  effective,
  sections,
  related = true,
}: {
  title: string;
  lead: string;
  updated: string;
  effective?: string;
  sections: LegalSection[];
  related?: boolean;
}) {
  return (
    <PageShell>
      <PageHero eyebrow="مركز الوثائق القانونية" title={title} lead={lead} />

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold text-muted-foreground">المحتويات</p>
            <ol className="mt-3 space-y-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {i + 1}. {s.h}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
              <p>آخر تحديث: {updated}</p>
              {effective ? <p>تاريخ السريان: {effective}</p> : null}
            </div>
          </div>
        </aside>

        <div className="space-y-10">
          {sections.map((s, i) => (
            <Reveal key={s.id} delay={Math.min(i * 30, 180)}>
              <section id={s.id} className="scroll-mt-28">
                <h2 className="font-display text-2xl font-black">
                  <span className="text-muted-foreground">{i + 1}.</span> {s.h}
                </h2>
                <div className="mt-3 space-y-3">
                  {s.p.map((line) =>
                    line.startsWith("• ") ? (
                      <p
                        key={line}
                        className="relative pr-5 text-[1.05rem] leading-[2] text-muted-foreground before:absolute before:top-[0.95em] before:right-0 before:size-1.5 before:rounded-full before:bg-primary"
                      >
                        {line.slice(2)}
                      </p>
                    ) : (
                      <p key={line} className="text-[1.05rem] leading-[2] text-muted-foreground">
                        {line}
                      </p>
                    ),
                  )}
                </div>
              </section>
            </Reveal>
          ))}

          {related ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-black">وثائق قانونية أخرى</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  { to: "/terms", label: "شروط الاستخدام" },
                  { to: "/privacy", label: "سياسة الخصوصية" },
                  { to: "/cookies", label: "سياسة ملفات الارتباط" },
                  { to: "/acceptable-use", label: "سياسة الاستخدام المقبول" },
                  { to: "/dpa", label: "اتفاقية معالجة البيانات (DPA)" },
                  { to: "/subprocessors", label: "قائمة المعالِجين الفرعيين" },
                  { to: "/refunds", label: "سياسة الاشتراك والاسترداد" },
                  { to: "/security", label: "الأمان" },
                ]
                  .filter((l) => l.label !== title)
                  .map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
