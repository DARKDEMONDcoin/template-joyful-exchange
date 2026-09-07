import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe2, Loader2, Users, Unplug } from "lucide-react";

import {
  disconnectWebAnalytics,
  saveWebAnalytics,
  visitorsSnapshot,
  type AnalyticsProvider,
} from "@/lib/web-analytics.functions";
import { cn } from "@/lib/utils";

const PROVIDERS: {
  id: AnalyticsProvider;
  label: string;
  hint: string;
  hostPlaceholder: string;
  hostHint: string;
  sitePlaceholder: string;
  keyHint: string;
}[] = [
  {
    id: "umami",
    label: "Umami",
    hint: "مفتوح المصدر · استضافة ذاتية مجانية أو خطة سحابية مجانية",
    hostPlaceholder: "https://api.umami.is",
    hostHint: "اترك الافتراضي لسحابة Umami، أو ضع رابط خادمك الذاتي",
    sitePlaceholder: "معرّف الموقع (Website ID)",
    keyHint: "مفتاح API من إعدادات حسابك",
  },
  {
    id: "plausible",
    label: "Plausible",
    hint: "مفتوح المصدر (Community Edition) — بلا كوكيز ومتوافق مع الخصوصية",
    hostPlaceholder: "https://plausible.io",
    hostHint: "رابط خادمك إن كنت تستضيفه ذاتياً",
    sitePlaceholder: "example.com",
    keyHint: "مفتاح API من Settings → API Keys",
  },
  {
    id: "goatcounter",
    label: "GoatCounter",
    hint: "مفتوح المصدر ومجاني للمواقع الشخصية والصغيرة",
    hostPlaceholder: "https://mysite.goatcounter.com",
    hostHint: "رابط لوحتك في GoatCounter",
    sitePlaceholder: "اسم الموقع (نفسه في الرابط)",
    keyHint: "توكن API من Settings → API tokens",
  },
];

const num = (n: number) => n.toLocaleString("ar-EG");

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="mt-2 space-y-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate">{r.label}</span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-jade"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </span>
          </span>
          <span className="font-bold tabular-nums">{num(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * زوار الموقع الحقيقيون — من أدوات تحليلات مفتوحة المصدر ومجانية،
 * مدمجة داخل التقارير حتى لا يزدحم الموقع بأقسام متكرّرة.
 */
export function VisitorsPanel({ workspaceId }: { workspaceId: string | undefined }) {
  const qc = useQueryClient();
  const snapshotFn = useServerFn(visitorsSnapshot);
  const saveFn = useServerFn(saveWebAnalytics);
  const disconnectFn = useServerFn(disconnectWebAnalytics);

  const [days, setDays] = useState(30);
  const [setupOpen, setSetupOpen] = useState(false);
  const [provider, setProvider] = useState<AnalyticsProvider>("umami");
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [siteId, setSiteId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const meta = PROVIDERS.find((p) => p.id === provider)!;

  const query = useQuery({
    queryKey: ["visitors", workspaceId, days],
    enabled: Boolean(workspaceId),
    queryFn: () => snapshotFn({ data: { workspaceId: workspaceId!, days } }),
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { workspaceId: workspaceId!, provider, host: host.trim(), apiKey: apiKey.trim(), siteId: siteId.trim() } }),
    onSuccess: () => {
      setSetupOpen(false);
      setApiKey("");
      setFormError(null);
      void qc.invalidateQueries({ queryKey: ["visitors", workspaceId] });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "تعذّر حفظ الربط"),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn({ data: { workspaceId: workspaceId! } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["visitors", workspaceId] }),
  });

  const data = query.data;
  const snap = data?.snapshot ?? null;

  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-jade/12 text-jade-deep">
          <Users className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-black">زوار موقعك</h2>
          <p className="text-xs text-muted-foreground">
            أرقام حقيقية من أدوات مفتوحة المصدر ومجانية — عدد الزوار وجنسياتهم وأهم صفحاتهم ومصادرهم.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border p-0.5 print:hidden">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
                days === d ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {d} يوم
            </button>
          ))}
        </div>
        {data?.connected ? (
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              className="rounded-xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary"
            >
              تعديل الربط
            </button>
            <button
              type="button"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              aria-label="فصل الربط"
              title="فصل الربط"
              className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-coral"
            >
              <Unplug className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            className="rounded-xl bg-foreground px-3.5 py-2 text-xs font-bold text-background print:hidden"
          >
            اربط تحليلات الزوار
          </button>
        )}
      </div>

      {setupOpen ? (
        <form
          className="mt-5 space-y-3 rounded-2xl border border-border bg-secondary/40 p-4 print:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            if (!workspaceId) return;
            setFormError(null);
            save.mutate();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={cn(
                  "rounded-2xl border p-3 text-start transition-colors",
                  provider === p.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-secondary",
                )}
              >
                <span className="block text-sm font-black">{p.label}</span>
                <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-muted-foreground">{p.hint}</span>
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-[0.7rem] font-bold text-muted-foreground">رابط الخدمة — {meta.hostHint}</span>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              dir="ltr"
              placeholder={meta.hostPlaceholder}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[0.7rem] font-bold text-muted-foreground">معرّف الموقع</span>
              <input
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                dir="ltr"
                required
                placeholder={meta.sitePlaceholder}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-[0.7rem] font-bold text-muted-foreground">مفتاح API — {meta.keyHint}</span>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                dir="ltr"
                type="password"
                required
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={save.isPending || !workspaceId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            احفظ الربط
          </button>
          {formError ? <p className="text-xs font-bold text-coral">{formError}</p> : null}
        </form>
      ) : null}

      {query.isLoading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ قراءة الزوار…
        </p>
      ) : !data?.connected ? (
        <p className="mt-5 rounded-2xl border border-dashed border-border p-5 text-sm leading-relaxed text-muted-foreground">
          اربط أداة تحليلات مفتوحة المصدر مرة واحدة لتظهر هنا أعداد الزوار الحقيقية وجنسياتهم وأهم الصفحات
          والمصادر — مدمجة داخل تقاريرك بلا قسم إضافي.
        </p>
      ) : data.error ? (
        <p className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{data.error}</p>
      ) : snap ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">زوار مختلفون</p>
              <p className="mt-1 font-display text-2xl font-black">{num(snap.totals.visitors)}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">مشاهدات الصفحات</p>
              <p className="mt-1 font-display text-2xl font-black">{num(snap.totals.pageviews)}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">دول الزوار</p>
              <p className="mt-1 font-display text-2xl font-black">{num(snap.countries.length)}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">المصدر</p>
              <p className="mt-1 font-display text-lg font-black capitalize">{snap.provider}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="flex items-center gap-1.5 font-display font-black">
                <Globe2 className="size-4" /> جنسيات الزوار
              </h3>
              <Bars rows={snap.countries.map((c) => ({ label: c.label, value: c.visitors }))} />
            </div>
            <div>
              <h3 className="font-display font-black">أهم الصفحات</h3>
              <Bars rows={snap.pages.map((p) => ({ label: p.path, value: p.views }))} />
            </div>
            <div>
              <h3 className="font-display font-black">مصادر الزيارات</h3>
              <Bars rows={snap.sources.map((s) => ({ label: s.source, value: s.visitors }))} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
