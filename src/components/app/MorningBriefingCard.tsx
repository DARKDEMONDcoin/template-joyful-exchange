import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight, CalendarDays, CheckCheck, Coffee, Lightbulb, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { getMember } from "@/data/team";
import { getMorningBriefing } from "@/lib/briefing.functions";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  idea: "فكرة",
  draft: "مسودة",
  scheduled: "مجدول",
  published: "نُشر",
  failed: "فشل",
  publishing: "ينشر الآن",
};

/** إحاطة أمَل الصباحية: ما يهمك اليوم في بطاقة واحدة، تُبنى مرة يومياً. */
export function MorningBriefingCard({ workspaceId, className }: { workspaceId: string; className?: string }) {
  const qc = useQueryClient();
  const fetchBriefing = useServerFn(getMorningBriefing);
  const eva = getMember("eva");
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["briefing", workspaceId],
    queryFn: () => fetchBriefing({ data: { workspaceId } }),
    staleTime: 10 * 60 * 1000,
  });

  const refresh = async () => {
    await qc.fetchQuery({ queryKey: ["briefing", workspaceId], queryFn: () => fetchBriefing({ data: { workspaceId, refresh: true } }) });
    void refetch();
  };

  return (
    <section
      className={cn("relative overflow-hidden rounded-3xl border border-border bg-card p-6", className)}
      style={{ backgroundImage: `radial-gradient(60% 80% at 100% 0%, ${eva?.tintSoft ?? "transparent"} 0%, transparent 60%)` }}
      aria-label="الإحاطة الصباحية"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl text-background" style={{ background: eva?.tint }}>
            <Coffee className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-muted-foreground">إحاطة {eva?.name ?? "أمَل"} الصباحية</p>
            <h2 className="font-display text-lg font-black">
              {data ? `${data.greeting} — ${data.headline}` : "جارٍ تجهيز إحاطة اليوم…"}
            </h2>
          </div>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} /> حدّث
        </button>
      </div>

      {isLoading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> أمَل تجمع ما يهمك اليوم…
        </p>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">
          {error instanceof Error ? error.message : "تعذّر بناء الإحاطة"}
        </p>
      ) : data ? (
        <>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              { k: "أُنجز هذا الأسبوع", v: data.stats.done7d },
              { k: "نُشر هذا الأسبوع", v: data.stats.published7d },
              { k: "مجدول قادم", v: data.stats.scheduled },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-background/70 px-4 py-3">
                <p className="text-[11px] text-muted-foreground">{s.k}</p>
                <p className="font-display text-xl font-black">{s.v.toLocaleString("en-US")}</p>
              </div>
            ))}
          </div>

          {data.attention.length ? (
            <ul className="mt-4 space-y-1.5">
              {data.attention.map((a) => (
                <li key={a} className="flex items-center gap-2 rounded-xl bg-amber/12 px-3 py-2 text-xs font-semibold">
                  <TriangleAlert className="size-3.5 shrink-0 text-amber" /> {a}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black">
                <CheckCheck className="size-4 text-jade" /> بانتظار موافقتك
              </h3>
              {data.approvals.length ? (
                <ul className="mt-2 space-y-1.5">
                  {data.approvals.map((a) => (
                    <li key={a.id}>
                      <Link to="/app/tasks" className="block truncate rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary">
                        <span className="font-bold">{getMember(a.employee)?.name ?? a.employee}</span> · {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">لا شيء ينتظرك — صندوقك نظيف.</p>
              )}
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black">
                <CalendarDays className="size-4 text-jade" /> منشورات اليوم
              </h3>
              {data.todayPosts.length ? (
                <ul className="mt-2 space-y-1.5">
                  {data.todayPosts.map((p) => (
                    <li key={p.id}>
                      <Link to="/app/calendar" className="flex items-center gap-2 rounded-xl border border-border p-1.5 pe-3 text-xs hover:bg-secondary">
                        {p.image ? (
                          <img src={p.image} alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" />
                        ) : (
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
                            <AppIcon name={p.provider} className="size-4" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{p.title}</span>
                          <span className="text-muted-foreground">
                            {appLabel(p.provider)} · {new Date(p.at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} · {statusLabel[p.status] ?? p.status}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  لا منشورات اليوم —{" "}
                  <Link to="/app/calendar" className="font-bold text-primary">
                    خطط أسبوعك مع سِراج
                  </Link>
                </p>
              )}
              {data.rankMoves.length ? (
                <ul className="mt-3 space-y-1">
                  {data.rankMoves.map((m) => (
                    <li key={m.keyword} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{m.keyword}</span>
                      <span className={cn("inline-flex items-center gap-0.5 font-black", m.delta > 0 ? "text-jade" : "text-coral")}>
                        {m.delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                        {m.from} → {m.to}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black">
                <Lightbulb className="size-4 text-amber" /> 3 أفكار لليوم
              </h3>
              {data.ideas.length ? (
                <ul className="mt-2 space-y-1.5">
                  {data.ideas.map((i) => (
                    <li key={i.title}>
                      <Link
                        to="/app/chat/$id"
                        params={{ id: "sonny" }}
                        search={{ prompt: i.prompt }}
                        className="group block rounded-xl border border-border px-3 py-2 text-xs hover:border-jade hover:bg-secondary"
                      >
                        <span className="flex items-center gap-1.5 font-bold">
                          <AppIcon name={i.provider} className="size-3.5" /> {i.title}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">«{i.hook}»</span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 transition group-hover:opacity-100">
                          <Sparkles className="size-3" /> اطلبها من سِراج
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">أفكار اليوم ستظهر بعد تحليل علامتك.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
