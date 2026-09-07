import { Link } from "@tanstack/react-router";
import { Check, ArrowLeft, Circle } from "lucide-react";

import {
  useBrainItems,
  useConnectedAccounts,
  useSocialPosts,
  useTasks,
  useWorkspace,
} from "@/lib/data";
import { cn } from "@/lib/utils";

type StepTo =
  | "/app/settings"
  | "/app/integrations"
  | "/app/chat"
  | "/app/approvals"
  | "/app/autopilot"
  | "/app/rankings";

type Step = {
  id: string;
  title: string;
  lead: string;
  to: StepTo;
  cta: string;
  done: boolean;
};

/**
 * خريطة التفعيل: ترتيب حقيقي لما يجب أن يفعله صاحب العمل بعد التسجيل،
 * كل خطوة محسوبة من بيانات مساحة العمل الفعلية لا من قائمة ثابتة.
 */
export function ActivationMap({ className }: { className?: string }) {
  const { data: workspace } = useWorkspace();
  const { data: accounts } = useConnectedAccounts(workspace?.id);
  const { data: tasks } = useTasks(workspace?.id);
  const { data: posts } = useSocialPosts(workspace?.id);
  const { data: brain } = useBrainItems(workspace?.id);

  if (!workspace) return null;

  const ws = workspace as { website?: string | null; profile?: Record<string, unknown> | null };
  const profileFilled = Boolean(ws.website) && Object.keys(ws.profile ?? {}).length > 0;
  const connected = (accounts ?? []).length;
  const taskList = tasks ?? [];
  const published = (posts ?? []).filter((p) => p.status === "published").length;

  const steps: Step[] = [
    {
      id: "profile",
      title: "عرّفنا على نشاطك",
      lead: "رابط موقعك ونبذة عن جمهورك — منها يبني فريقك كل شيء.",
      to: "/app/settings",
      cta: "أكمل ملف النشاط",
      done: profileFilled,
    },
    {
      id: "connect",
      title: "اربط حساباتك",
      lead: "حساب واحد يكفي للبدء، وكل حساب إضافي يوسّع وصولك.",
      to: "/app/integrations",
      cta: "اربط حساباً",
      done: connected > 0,
    },
    {
      id: "brief",
      title: "اطلب أول عمل من فريقك",
      lead: "اكتب طلبك بالعربي كما تكلّم موظفاً — ويأتيك جاهزاً.",
      to: "/app/chat",
      cta: "افتح محادثة",
      done: taskList.length > 0,
    },
    {
      id: "approve",
      title: "راجع واعتمد",
      lead: "لا يُنشر شيء قبل موافقتك، والاعتماد بنقرة واحدة.",
      to: "/app/approvals",
      cta: "راجع المخرجات",
      done: taskList.some((t) => t.status === "done") || published > 0,
    },
    {
      id: "autopilot",
      title: "شغّل النشر التلقائي",
      lead: "حدد الأيام والأوقات، ويكمل فريقك بدون تدخّل يومي.",
      to: "/app/autopilot",
      cta: "اضبط الطيار الآلي",
      done: (posts ?? []).some((p) => p.status === "scheduled") || published > 0,
    },
    {
      id: "measure",
      title: "تابع نتائجك",
      lead: "ترتيبك في البحث وأداء منشوراتك في مكان واحد.",
      to: "/app/rankings",
      cta: "افتح المتابعة",
      done: (brain ?? []).length > 0 && published > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const next = steps.find((s) => !s.done)!;

  return (
    <section className={cn("rounded-3xl border border-border bg-card p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black">خطواتك للانطلاق</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {doneCount} من {steps.length} مكتملة · التالي: {next.title}
          </p>
        </div>
        <Link
          to={next.to}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background"
        >
          {next.cta} <ArrowLeft className="size-3.5" />
        </Link>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${(doneCount / steps.length) * 100}%`,
            backgroundImage: "var(--gradient-aurora)",
          }}
        />
      </div>

      <ol className="mt-5 grid gap-3 md:grid-cols-2">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4",
              s.done ? "border-jade/30 bg-jade/8" : "border-border/70",
              s.id === next.id && "border-foreground/40 bg-secondary/50",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg text-[0.7rem] font-black",
                s.done ? "bg-jade text-background" : "bg-secondary text-ink-soft",
              )}
            >
              {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-bold">
                {s.title}
                {s.id === next.id ? (
                  <Circle className="size-2 fill-coral text-coral" />
                ) : null}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{s.lead}</span>
              {!s.done ? (
                <Link to={s.to} className="mt-2 inline-block text-xs font-bold text-primary">
                  {s.cta}
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
