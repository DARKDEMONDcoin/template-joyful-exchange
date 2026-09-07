import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Building2, Bell, User, KeyRound } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import {
  useProfile,
  useTasks,
  useUpdateProfile,
  useUpdateWorkspace,
  useWorkspace,
} from "@/lib/data";
import { listSecrets, upsertSecrets, deleteSecret, testAiProviders } from "@/lib/secrets.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | سهل" },
      { name: "description", content: "مساحة العمل، حسابك، الاشتراك والتنبيهات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const tabs = [
  { id: "workspace", label: "مساحة العمل", icon: Building2 },
  { id: "account", label: "حسابك", icon: User },
  { id: "ai", label: "مفاتيح الذكاء", icon: KeyRound },
  { id: "billing", label: "الاشتراك", icon: CreditCard },
  { id: "notifications", label: "التنبيهات", icon: Bell },
] as const;

const field =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-jade";

function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("workspace");
  const { data: workspace } = useWorkspace();
  const { data: profile } = useProfile();
  const { data: tasks } = useTasks(workspace?.id);
  const updateWorkspace = useUpdateWorkspace();
  const updateProfile = useUpdateProfile();
  const [saved, setSaved] = useState<string | null>(null);

  const doneCount = (tasks ?? []).filter((t) => t.status === "done").length;

  return (
    <AppShell title="الإعدادات" lead="كل ما يخص مساحة عملك وحسابك.">
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors",
                tab === t.id ? "bg-foreground text-background" : "hover:bg-secondary",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          {saved ? (
            <p className="mb-5 rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
              {saved}
            </p>
          ) : null}

          {tab === "workspace" && workspace ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await updateWorkspace.mutateAsync({
                  id: workspace.id,
                  patch: {
                    name: String(f.get("name")),
                    industry: String(f.get("industry")),
                    tone: String(f.get("tone")),
                    banned_words: String(f.get("banned"))
                      .split("،")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                });
                setSaved("تم حفظ إعدادات مساحة العمل.");
              }}
            >
              <h2 className="font-display text-xl font-black">مساحة العمل</h2>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">اسم النشاط</span>
                <input name="name" defaultValue={workspace.name} className={field} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">المجال</span>
                <input name="industry" defaultValue={workspace.industry} className={field} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">نبرة العلامة</span>
                <textarea
                  name="tone"
                  defaultValue={workspace.tone}
                  className={cn(field, "min-h-24 resize-none")}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  كلمات ممنوعة (افصل بينها بفاصلة عربية)
                </span>
                <input
                  name="banned"
                  defaultValue={workspace.banned_words.join("، ")}
                  className={field}
                />
              </label>
              <button
                type="submit"
                disabled={updateWorkspace.isPending}
                className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
              >
                {updateWorkspace.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
              </button>
            </form>
          ) : null}

          {tab === "account" && profile ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await updateProfile.mutateAsync({
                  id: profile.id,
                  patch: {
                    full_name: String(f.get("full_name")),
                    dialect: String(f.get("dialect")),
                  },
                });
                setSaved("تم تحديث حسابك.");
              }}
            >
              <h2 className="font-display text-xl font-black">حسابك</h2>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">الاسم</span>
                <input name="full_name" defaultValue={profile.full_name ?? ""} className={field} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">لهجة المحتوى</span>
                <select name="dialect" defaultValue={profile.dialect} className={field}>
                  <option>خليجية</option>
                  <option>مصرية</option>
                  <option>شامية</option>
                  <option>مغاربية</option>
                  <option>فصحى معاصرة</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
              >
                {updateProfile.isPending ? "جارٍ الحفظ…" : "حفظ"}
              </button>
            </form>
          ) : null}

          {tab === "ai" ? <SecretsPanel /> : null}


          {tab === "billing" ? (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-black">الاشتراك</h2>
              <div className="rounded-2xl bg-secondary/50 p-5">
                <p className="font-bold">التجربة المجانية</p>
                <p className="mt-1 text-sm text-ink-soft">
                  استهلكت {doneCount} مهمة منجزة من أصل ٥٠ ضمن باقتك الحالية.
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-card">
                  <div
                    className="h-full rounded-full bg-jade"
                    style={{ width: `${Math.min(100, (doneCount / 50) * 100)}%` }}
                  />
                </div>
              </div>
              <Link
                to="/pricing"
                className="inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background"
              >
                عرض الباقات
              </Link>
            </div>
          ) : null}

          {tab === "notifications" ? (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-black">التنبيهات</h2>
              {["عند جاهزية عنصر للموافقة", "عند انقطاع ربط حساب", "ملخص أسبوعي بالبريد"].map(
                (label) => (
                  <label
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-border p-4"
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    <input type="checkbox" defaultChecked className="size-5 accent-current" />
                  </label>
                ),
              )}
              <p className="text-sm text-muted-foreground">
                تُطبَّق التنبيهات على بريد حسابك الحالي.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function SecretsPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(listSecrets);
  const save = useServerFn(upsertSecrets);
  const remove = useServerFn(deleteSecret);
  const test = useServerFn(testAiProviders);
  const [note, setNote] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["app-secrets"], queryFn: () => load() });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["app-secrets"] });

  const saveMutation = useMutation({
    mutationFn: (input: { entries?: { name: string; value: string }[]; bulk?: string }) =>
      save({ data: input }),
    onSuccess: async (res) => {
      setNote(
        res.saved > 0
          ? `تم حفظ ${res.saved} مفتاح في قاعدة بيانات سوبابيز: ${res.names.join("، ")}`
          : "لم يُقرأ أي مفتاح من المُدخل. تأكد من صيغة NAME=value.",
      );
      await refresh();
    },
    onError: (e: Error) => setNote(e.message || "تعذّر الحفظ."),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => remove({ data: { name } }),
    onSuccess: async (res) => {
      setNote(`تم حذف ${res.deleted}.`);
      await refresh();
    },
  });

  const testMutation = useMutation({
    mutationFn: () => test(),
    onSuccess: (res) => setNote(res.message),
    onError: () => setNote("تعذّر الاختبار."),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-black">المفاتيح والأسرار</h2>
        <p className="mt-1 text-sm text-ink-soft">
          كل مفاتيح التطبيق تُقرأ من مكان واحد فقط: قاعدة بيانات سوبابيز الخاصة بك. أي مفتاح تضيفه
          هنا — حالي أو جديد — يعمل فوراً بدون أي تعديل، ولا يظهر لأي متصفح بعد الحفظ.
        </p>
      </div>

      {note ? (
        <p className="rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
          {note}
        </p>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-black">المحفوظ حالياً</h3>
        {(data?.stored ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد مفتاح محفوظ بعد.</p>
        ) : null}
        {(data?.stored ?? []).map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
          >
            <span className="font-mono font-bold">{s.name}</span>
            <span className="flex items-center gap-3">
              <span className="font-semibold text-jade-deep">{s.preview}</span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(s.name)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                حذف
              </button>
            </span>
          </div>
        ))}
      </div>

      {(data?.missing ?? []).length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-black">مفاتيح ينتظرها التطبيق</h3>
          {(data?.missing ?? []).map((k) => (
            <div
              key={k.name}
              className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm"
            >
              <span className="font-mono font-bold">{k.name}</span>
              <span className="text-muted-foreground">{k.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="space-y-4 rounded-2xl bg-secondary/40 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const name = String(f.get("name") ?? "").trim();
          const value = String(f.get("value") ?? "").trim();
          saveMutation.mutate({
            entries: name && value ? [{ name, value }] : [],
            bulk: String(f.get("bulk") ?? ""),
          });
          form.reset();
        }}
      >
        <h3 className="text-sm font-black">إضافة أو تحديث مفتاح</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">اسم المفتاح</span>
            <input name="name" placeholder="GEMINI_API_KEY" className={cn(field, "font-mono")} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">القيمة</span>
            <input name="value" type="password" autoComplete="off" className={field} />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">
            أو الصق عدة مفاتيح مرة واحدة (سطر لكل مفتاح: NAME=value)
          </span>
          <textarea
            name="bulk"
            spellCheck={false}
            placeholder={"GEMINI_API_KEY=AIza…\nOPENROUTER_API_KEY=sk-or-…"}
            className={cn(field, "min-h-28 resize-y font-mono text-sm")}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
          >
            {saveMutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button
            type="button"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="rounded-full border border-border px-6 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {testMutation.isPending ? "جارٍ الاختبار…" : "اختبار الذكاء الاصطناعي"}
          </button>
        </div>
      </form>
    </div>
  );
}
