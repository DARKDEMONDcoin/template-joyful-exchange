import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { Portrait } from "@/components/site/Portrait";
import { getMember } from "@/data/team";
import { useConnectedAccounts, useSocialPosts, useWorkspace, type SocialPost } from "@/lib/data";
import {
  generateCalendarPost,
  learnFromPerformanceNow,
  planContentCalendar,
  publishCalendarPost,
  updateCalendarPost,
} from "@/lib/content-calendar.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/calendar")({
  head: () => ({
    meta: [
      { title: "تقويم المحتوى | سهل" },
      { name: "description", content: "خطة محتوى شهرية جاهزة بالنصوص والصور من سِراج — راجع، عدّل، وانشر بضغطة." },
      { property: "og:title", content: "تقويم المحتوى | سهل" },
      { property: "og:description", content: "شهر كامل من المنشورات بالصور — يبقى لك زر النشر فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});

type Meta = { title?: string; pillar?: string; hook?: string; angle?: string; error?: string; batch?: string };
type Post = SocialPost & { meta?: Meta | null; metrics?: { likes?: number; comments?: number } | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  idea: { label: "فكرة", cls: "bg-amber/15 text-amber" },
  draft: { label: "جاهز للمراجعة", cls: "bg-sky/15 text-sky" },
  scheduled: { label: "مجدول", cls: "bg-jade/12 text-jade-deep" },
  published: { label: "منشور", cls: "bg-foreground text-background" },
  failed: { label: "فشل", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "ملغى", cls: "bg-secondary text-muted-foreground" },
};

const PROVIDERS = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest"];
const DAYS_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function CalendarPage() {
  const { data: workspace } = useWorkspace();
  const { data: posts, isLoading } = useSocialPosts(workspace?.id);
  const { data: accounts } = useConnectedAccounts(workspace?.id);
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["social-posts", workspace?.id] });

  const plan = useServerFn(planContentCalendar);
  const gen = useServerFn(generateCalendarPost);
  const update = useServerFn(updateCalendarPost);
  const publish = useServerFn(publishCalendarPost);
  const learn = useServerFn(learnFromPerformanceNow);

  const connected = new Set((accounts ?? []).map((a) => a.provider));
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // نموذج الخطة
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [perDay, setPerDay] = useState(1);
  const [providers, setProviders] = useState<string[]>(["instagram"]);
  const [topic, setTopic] = useState("");
  const [withImage, setWithImage] = useState(true);

  const list = (posts ?? []) as Post[];
  const byDay = useMemo(() => {
    const m: Record<string, Post[]> = {};
    for (const p of list) (m[dayKey(new Date(p.scheduled_at))] ??= []).push(p);
    return m;
  }, [list]);

  const grid = useMemo(() => {
    const first = new Date(cursor);
    const startOffset = first.getDay(); // الأحد = 0
    const cells: (Date | null)[] = Array.from({ length: startOffset }, () => null);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [cursor]);

  const ideas = list.filter((p) => p.status === "idea");
  const drafts = list.filter((p) => p.status === "draft");
  const selectedPost = list.find((p) => p.id === selected) ?? null;
  const todayKey = dayKey(new Date());

  const generateAll = async (targets: Post[]) => {
    if (!workspace) return;
    setError(null);
    setProgress({ done: 0, total: targets.length });
    let done = 0;
    for (const t of targets) {
      setProgress({ done, total: targets.length, current: t.meta?.title ?? t.provider });
      try {
        await gen({ data: { workspaceId: workspace.id, id: t.id, withImage } });
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر توليد منشور");
      }
      done += 1;
      setProgress({ done, total: targets.length });
      invalidate();
    }
    setProgress(null);
  };

  const planMutation = useMutation({
    mutationFn: () =>
      plan({
        data: {
          workspaceId: workspace!.id,
          days,
          perDay,
          providers,
          topic: topic.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
        },
      }),
    onSuccess: async () => {
      setPlanOpen(false);
      invalidate();
      const fresh = await qc.fetchQuery<Post[]>({ queryKey: ["social-posts", workspace?.id] });
      const newIdeas = (fresh ?? []).filter((p) => p.status === "idea");
      await generateAll(newIdeas);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "تعذّر التخطيط"),
  });

  const learnMutation = useMutation({
    mutationFn: () => learn({ data: { workspaceId: workspace!.id } }),
    onError: (e) => setError(e instanceof Error ? e.message : "تعذّر التعلّم"),
  });

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تنفيذ الطلب");
    } finally {
      setBusy(null);
    }
  };

  const approveAll = async () => {
    if (!workspace) return;
    for (const d of drafts) {
      if (!connected.has(d.provider)) continue;
      await act(d.id, () => update({ data: { workspaceId: workspace.id, id: d.id, action: "approve" } }));
    }
  };

  const monthLabel = cursor.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
  const siraj = getMember("sonny");

  return (
    <AppShell
      title="تقويم المحتوى"
      lead="سِراج يخطّط الشهر ويكتب المنشورات ويصمّم الصور — يبقى لك زر النشر"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => learnMutation.mutate()}
            disabled={!workspace || learnMutation.isPending}
            title="يقرأ أداء منشوراتك الحقيقية ويتعلّم ما ينجح"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-bold hover:bg-secondary disabled:opacity-50"
          >
            {learnMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
            تعلّم من الأداء
          </button>
          <button
            onClick={() => setPlanOpen(true)}
            disabled={!workspace || Boolean(progress)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-bold text-background disabled:opacity-50"
          >
            <Sparkles className="size-4" /> خطّط لي المحتوى
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
          <span>
            {error}
            {/مربوط|اربط|ربط/.test(error) ? (
              <>
                {" "}
                <Link to="/app/integrations" className="underline underline-offset-4">
                  اربط الحساب الآن ←
                </Link>
              </>
            ) : null}
          </span>
          <button onClick={() => setError(null)} aria-label="إغلاق">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {learnMutation.data ? (
        <section className="mb-4 rounded-3xl border border-jade/30 bg-jade/6 p-5">
          <p className="flex items-center gap-2 text-sm font-black">
            <TrendingUp className="size-4 text-jade-deep" /> ما تعلّمه سِراج من {learnMutation.data.analyzed} منشوراً
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.68rem] font-bold text-muted-foreground">
              {learnMutation.data.source === "live" ? "من حساباتك المربوطة" : learnMutation.data.source === "internal" ? "من منشورات سهل" : "لا بيانات بعد"}
            </span>
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{learnMutation.data.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">حُفظ في «عقل العلامة» وسيُطبَّق تلقائياً في كل منشور قادم.</p>
        </section>
      ) : null}

      {progress ? (
        <section className="mb-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="size-10 shrink-0 overflow-hidden rounded-2xl">
              {siraj ? <Portrait memberId="sonny" name={siraj.name} className="size-full" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">
                سِراج يكتب ويصمّم… {progress.done}/{progress.total}
              </p>
              <p className="truncate text-xs text-muted-foreground">{progress.current ? `الآن: ${progress.current}` : "جارٍ التجهيز"}</p>
            </div>
            <Loader2 className="size-5 animate-spin text-jade" />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-jade transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
          </div>
        </section>
      ) : null}

      {/* شريط الحالة */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Stat label="أفكار" n={ideas.length} cls="bg-amber/15 text-amber" />
        <Stat label="جاهز للمراجعة" n={drafts.length} cls="bg-sky/15 text-sky" />
        <Stat label="مجدول" n={list.filter((p) => p.status === "scheduled").length} cls="bg-jade/12 text-jade-deep" />
        <Stat label="منشور" n={list.filter((p) => p.status === "published").length} cls="bg-foreground text-background" />
        <span className="flex-1" />
        {ideas.length ? (
          <button
            onClick={() => void generateAll(ideas)}
            disabled={Boolean(progress)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-bold hover:bg-secondary disabled:opacity-50"
          >
            <ImageIcon className="size-3.5" /> اكتب وصمّم {ideas.length} فكرة
          </button>
        ) : null}
        {drafts.length ? (
          <button
            onClick={() => void approveAll()}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 rounded-full bg-jade px-3 py-1.5 font-bold text-background disabled:opacity-50"
          >
            <CheckCheck className="size-3.5" /> اعتمد الكل للنشر
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        {/* الشبكة */}
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-xl p-2 hover:bg-secondary" aria-label="الشهر السابق">
              <ChevronRight className="size-5" />
            </button>
            <h2 className="font-display text-lg font-black">{monthLabel}</h2>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-xl p-2 hover:bg-secondary" aria-label="الشهر التالي">
              <ChevronLeft className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-bold text-muted-foreground">
            {DAYS_AR.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          {isLoading ? (
            <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
            </p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                if (!d) return <div key={`e${i}`} className="min-h-24 rounded-xl bg-secondary/30" />;
                const k = dayKey(d);
                const items = byDay[k] ?? [];
                return (
                  <div
                    key={k}
                    className={cn(
                      "min-h-24 rounded-xl border border-border/60 p-1.5 transition-colors",
                      k === todayKey && "border-jade bg-jade/5",
                    )}
                  >
                    <p className={cn("mb-1 text-[0.7rem] font-bold", k === todayKey ? "text-jade-deep" : "text-muted-foreground")}>{d.getDate()}</p>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelected(p.id)}
                          className={cn(
                            "flex w-full items-center gap-1 overflow-hidden rounded-lg border p-1 text-start transition-shadow hover:shadow-sm",
                            selected === p.id ? "border-foreground" : "border-border/60 bg-background",
                          )}
                          title={p.meta?.title ?? p.body.slice(0, 80)}
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="size-7 shrink-0 rounded-md object-cover" loading="lazy" />
                          ) : (
                            <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", STATUS[p.status]?.cls ?? "bg-secondary")}>
                              <AppIcon name={p.provider} className="size-3.5" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.66rem] font-bold leading-tight">{p.meta?.title ?? p.body.split("\n")[0]}</span>
                            <span className="block truncate text-[0.6rem] text-muted-foreground">
                              {new Date(p.scheduled_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} · {STATUS[p.status]?.label ?? p.status}
                            </span>
                          </span>
                        </button>
                      ))}
                      {items.length > 3 ? <p className="text-[0.6rem] text-muted-foreground">+{items.length - 3} أخرى</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isLoading && list.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary">
                <CalendarDays className="size-6 text-ink-soft" />
              </span>
              <p className="mt-3 font-black">تقويمك فارغ</p>
              <p className="mt-1 text-sm text-ink-soft">اضغط «خطّط لي المحتوى» وسيجهّز سِراج أسبوعاً أو شهراً كاملاً بالنصوص والصور خلال دقائق.</p>
            </div>
          ) : null}
        </section>

        {/* اللوحة الجانبية */}
        <aside className="space-y-4">
          {selectedPost ? (
            <PostPanel
              post={selectedPost}
              connected={connected.has(selectedPost.provider)}
              busy={busy === selectedPost.id}
              onClose={() => setSelected(null)}
              onGenerate={() => void act(selectedPost.id, () => gen({ data: { workspaceId: workspace!.id, id: selectedPost.id, withImage: true } }))}
              onRegenerate={() =>
                void act(selectedPost.id, async () => {
                  await update({ data: { workspaceId: workspace!.id, id: selectedPost.id, action: "unapprove", imageUrl: null } });
                  await gen({ data: { workspaceId: workspace!.id, id: selectedPost.id, withImage: true } });
                })
              }
              onApprove={() => void act(selectedPost.id, () => update({ data: { workspaceId: workspace!.id, id: selectedPost.id, action: "approve" } }))}
              onUnapprove={() => void act(selectedPost.id, () => update({ data: { workspaceId: workspace!.id, id: selectedPost.id, action: "unapprove" } }))}
              onPublish={() => void act(selectedPost.id, () => publish({ data: { workspaceId: workspace!.id, id: selectedPost.id } }))}
              onDelete={() =>
                void act(selectedPost.id, async () => {
                  await update({ data: { workspaceId: workspace!.id, id: selectedPost.id, action: "delete" } });
                  setSelected(null);
                })
              }
              onSave={(body, scheduledAt) =>
                void act(selectedPost.id, () => update({ data: { workspaceId: workspace!.id, id: selectedPost.id, action: "edit", body, scheduledAt } }))
              }
            />
          ) : (
            <section className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="size-12 shrink-0 overflow-hidden rounded-2xl">{siraj ? <Portrait memberId="sonny" name={siraj.name} className="size-full" /> : null}</span>
                <div>
                  <p className="font-display font-black">سِراج</p>
                  <p className="text-xs text-muted-foreground">مدير السوشيال ميديا</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                اختر منشوراً من التقويم لمعاينته بالصورة، تعديله، اعتماده أو نشره فوراً. أو اطلب مني خطة جديدة بمحور معيّن.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-ink-soft">
                <li className="flex gap-2"><Lightbulb className="size-3.5 shrink-0 text-amber" /> فكرة → أكتبها وأصمّم صورتها على هوية علامتك.</li>
                <li className="flex gap-2"><Check className="size-3.5 shrink-0 text-sky" /> جاهز → تراجعه وتعتمده، فيُنشر في موعده تلقائياً.</li>
                <li className="flex gap-2"><TrendingUp className="size-3.5 shrink-0 text-jade" /> أتعلّم من أداء منشوراتك وأعدّل الخطة تلقائياً.</li>
              </ul>
              <Link to="/app/chat/$id" params={{ id: "sonny" }} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                تحدّث مع سِراج
              </Link>
            </section>
          )}
          {!connected.size ? (
            <section className="rounded-3xl border border-amber/40 bg-amber/8 p-4 text-sm">
              <p className="font-black">لا حسابات مربوطة بعد</p>
              <p className="mt-1 text-ink-soft">تستطيع التخطيط والمعاينة الآن، وعند النشر سيطلب سِراج ربط المنصة بضغطة واحدة.</p>
              <Link to="/app/integrations" className="mt-2 inline-block text-xs font-bold text-primary">
                اربط إنستجرام/فيسبوك/لينكدإن ←
              </Link>
            </section>
          ) : null}
        </aside>
      </div>

      {/* نافذة الخطة */}
      {planOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => !planMutation.isPending && setPlanOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (providers.length) planMutation.mutate();
            }}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl"
          >
            <h2 className="font-display text-xl font-black">خطة محتوى جديدة</h2>
            <p className="mt-1 text-sm text-ink-soft">سيخطّط سِراج الأفكار على أعمدة المحتوى وأفضل الأوقات، ثم يكتب كل منشور ويصمّم صورته.</p>

            <p className="mt-4 text-xs font-bold text-muted-foreground">المدة</p>
            <div className="mt-1 flex gap-2">
              {([7, 14, 30] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-bold", days === d ? "border-foreground bg-foreground text-background" : "border-border")}>
                  {d === 7 ? "أسبوع" : d === 14 ? "أسبوعان" : "شهر"}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold text-muted-foreground">منشورات في اليوم</p>
            <div className="mt-1 flex gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => setPerDay(n)} className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-bold", perDay === n ? "border-foreground bg-foreground text-background" : "border-border")}>
                  {n}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold text-muted-foreground">المنصات</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {PROVIDERS.map((p) => {
                const on = providers.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProviders(on ? providers.filter((x) => x !== p) : [...providers, p])}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold", on ? "border-jade bg-jade/10 text-jade-deep" : "border-border")}
                  >
                    <AppIcon name={p} className="size-3.5" /> {appLabel(p)}
                    {connected.has(p) ? <span className="size-1.5 rounded-full bg-jade" title="مربوط" /> : null}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-muted-foreground">محور اختياري (عرض، إطلاق، موسم…)</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: عروض رمضان على المنيو الجديد" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} /> صمّم صورة لكل منشور
            </label>

            <p className="mt-3 text-xs text-muted-foreground">
              سيُنشأ {Math.min(days * perDay, 45)} منشوراً. الكتابة والتصميم يأخذان نحو 20 ثانية للمنشور — يمكنك متابعة التقدّم هنا.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPlanOpen(false)} disabled={planMutation.isPending} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-secondary">
                إلغاء
              </button>
              <button type="submit" disabled={planMutation.isPending || !providers.length} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background disabled:opacity-60">
                {planMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {planMutation.isPending ? "سِراج يخطّط…" : "ابدأ التخطيط"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}

function Stat({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 font-bold", cls)}>
      {n} {label}
    </span>
  );
}

function PostPanel(props: {
  post: Post;
  connected: boolean;
  busy: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onUnapprove: () => void;
  onPublish: () => void;
  onDelete: () => void;
  onSave: (body: string, scheduledAt?: string) => void;
}) {
  const { post } = props;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body);
  const [when, setWhen] = useState(() => toLocalInput(post.scheduled_at));
  const st = STATUS[post.status] ?? STATUS["draft"]!;
  const isIdea = post.status === "idea";

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      {post.image_url ? (
        <img src={post.image_url} alt={post.meta?.title ?? "صورة المنشور"} className="aspect-square w-full object-cover" />
      ) : (
        <div className="grid aspect-[4/2] place-items-center bg-secondary/60 text-muted-foreground">
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImageIcon className="size-6" /> {isIdea ? "الصورة تُصمَّم عند الكتابة" : "بلا صورة"}
          </span>
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <AppIcon name={post.provider} className="size-4" /> {appLabel(post.provider)}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 font-bold", st.cls)}>{st.label}</span>
          {post.meta?.pillar ? <span className="rounded-full bg-secondary px-2 py-0.5 font-bold text-muted-foreground">{post.meta.pillar}</span> : null}
          <button onClick={props.onClose} className="ms-auto rounded-lg p-1 hover:bg-secondary" aria-label="إغلاق">
            <X className="size-4" />
          </button>
        </div>
        {post.meta?.title ? <p className="mt-2 font-display font-black">{post.meta.title}</p> : null}
        {post.meta?.error ? <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{post.meta.error}</p> : null}
        {post.last_error ? <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{post.last_error}</p> : null}
        {post.metrics?.likes != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            الأداء: {post.metrics.likes} إعجاب · {post.metrics.comments ?? 0} تعليق
          </p>
        ) : null}

        {editing ? (
          <div className="mt-3 space-y-2">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed" />
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  props.onSave(body, when ? new Date(when).toISOString() : undefined);
                  setEditing(false);
                }}
                className="flex-1 rounded-xl bg-foreground py-2 text-sm font-bold text-background"
              >
                حفظ
              </button>
              <button onClick={() => setEditing(false)} className="rounded-xl px-4 py-2 text-sm font-bold hover:bg-secondary">
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{post.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(post.scheduled_at).toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" })}
            </p>
          </>
        )}

        {post.status !== "published" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {isIdea ? (
              <Btn primary onClick={props.onGenerate} busy={props.busy} icon={Sparkles} className="col-span-2">
                اكتب وصمّم الآن
              </Btn>
            ) : null}
            {post.status === "draft" ? (
              <Btn primary onClick={props.onApprove} busy={props.busy} icon={Check} title={props.connected ? "" : "سيطلب ربط الحساب"}>
                اعتمد للنشر
              </Btn>
            ) : null}
            {post.status === "scheduled" ? (
              <Btn onClick={props.onUnapprove} busy={props.busy} icon={X}>
                ألغِ الجدولة
              </Btn>
            ) : null}
            {!isIdea ? (
              <Btn primary={post.status === "scheduled"} onClick={props.onPublish} busy={props.busy} icon={Send}>
                انشر الآن
              </Btn>
            ) : null}
            {!isIdea ? (
              <Btn onClick={() => setEditing(true)} icon={Pencil}>
                عدّل
              </Btn>
            ) : null}
            {!isIdea ? (
              <Btn onClick={props.onRegenerate} busy={props.busy} icon={RefreshCw}>
                أعد التوليد
              </Btn>
            ) : null}
            <Btn onClick={props.onDelete} icon={Trash2} className={cn("text-coral", isIdea ? "col-span-2" : "")}>
              احذف
            </Btn>
          </div>
        ) : post.remote_ref ? (
          <p className="mt-3 text-xs text-jade-deep">نُشر بنجاح ✓</p>
        ) : null}
      </div>
    </section>
  );
}

function Btn({
  children,
  onClick,
  busy,
  icon: Icon,
  primary,
  className,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  icon: typeof Send;
  primary?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60",
        primary ? "bg-foreground text-background" : "border border-border hover:bg-secondary",
        className,
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
      {children}
    </button>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
