import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import { PageShell, PageHero } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { signIn } from "@/lib/auth";
import { GUEST_EMAIL } from "@/lib/guest.functions";
import { createAccount } from "@/lib/signup.functions";
import { plans } from "@/data/pricing";

import { cn } from "@/lib/utils";

const searchSchema = z.object({
  mode: z.enum(["signup", "signin"]).default("signup").optional(),
  /** الباقة القادمة من صفحة الأسعار — تُعرض للمستخدم ولا تُلزمه بالدفع الآن. */
  plan: z.enum(["start", "growth"]).optional(),
});


export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  ssr: false,
  head: () => ({
    meta: [
      { title: "أنشئ حسابك في سهل | فريق موظفين ذكاء اصطناعي بالعربية" },
      {
        name: "description",
        content:
          "سجّل حساباً مجانياً في سهل خلال دقيقة: اسمك، اسم نشاطك، ولهجتك — ويبدأ فريق الموظفين الرقميين العمل معك فوراً.",
      },
      { property: "og:title", content: "أنشئ حسابك في سهل" },
      {
        property: "og:description",
        content: "حساب مجاني بدون بطاقة — ستة موظفين بالذكاء الاصطناعي يعملون بالعربية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const dialects = ["خليجية", "مصرية", "شامية", "مغربية", "فصحى"] as const;

const inputCls =
  "w-full rounded-2xl border border-border bg-card px-11 py-3 text-start outline-none transition-colors focus:border-primary";

type Errors = Record<string, string>;

function strengthOf(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function arabicError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already"))
    return "هذا البريد مسجّل بالفعل — جرّب تسجيل الدخول أو استعادة كلمة المرور.";
  if (m.includes("invalid login credentials")) return "البريد أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed")) return "لم يتم تأكيد البريد بعد — افتح رسالة التأكيد في بريدك.";
  if (m.includes("password should be at least")) return "كلمة المرور قصيرة جداً — ٨ أحرف على الأقل.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "محاولات كثيرة في وقت قصير — انتظر دقيقة ثم أعد المحاولة.";
  if (m.includes("invalid email") || m.includes("email address"))
    return "صيغة البريد الإلكتروني غير صحيحة.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "تعذّر الاتصال بالخدمة — تحقّق من الإنترنت وأعد المحاولة.";
  return message || "حدث خطأ غير متوقع — أعد المحاولة.";
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const createAccountFn = useServerFn(createAccount);
  const [mode, setMode] = useState<"signup" | "signin">(search.mode ?? "signup");

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [dialect, setDialect] = useState<string>("خليجية");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const strength = useMemo(() => strengthOf(password), [password]);

  useEffect(() => {
    setMode(search.mode ?? "signup");
  }, [search.mode]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const user = data.user;
      if (!user || user.is_anonymous || !user.email) return;
      if (user.email === GUEST_EMAIL) {
        // جلسة التجربة: ننهيها هنا حتى يستطيع الزائر التسجيل بحسابه
        void supabase.auth.signOut();
        return;
      }
      void navigate({ to: "/app", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  function switchMode(next: "signup" | "signin") {
    setMode(next);
    setErrors({});
    setFormError("");
    setResetSent(false);
    void navigate({ to: "/auth", search: { mode: next }, replace: true });
  }

  function validate(): boolean {
    const e: Errors = {};
    const mail = email.trim();
    if (!mail) e['email'] = "أدخل بريدك الإلكتروني.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) e['email'] = "صيغة البريد غير صحيحة.";
    if (!password) e['password'] = "أدخل كلمة المرور.";
    else if (mode === "signup" && password.length < 8) e['password'] = "٨ أحرف على الأقل.";

    if (mode === "signup") {
      if (fullName.trim().length < 3) e['fullName'] = "اكتب اسمك الكامل (٣ أحرف على الأقل).";
      if (company.trim().length < 2) e['company'] = "اكتب اسم نشاطك أو شركتك.";
      if (confirm !== password) e['confirm'] = "كلمتا المرور غير متطابقتين.";
      if (!accepted) e['accepted'] = "لا بد من الموافقة على الشروط وسياسة الخصوصية.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError("");
    setResetSent(false);
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await createAccountFn({
          data: {
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            company: company.trim(),
            dialect,
          },
        });
        if (!res.ok) {
          setFormError(
            res.reason === "duplicate"
              ? "هذا البريد مسجّل بالفعل — سجّل الدخول أو استعد كلمة المرور."
              : res.reason === "password"
                ? "كلمة المرور غير مقبولة — اجعلها ٨ أحرف على الأقل وأقوى."
                : "تعذّر إنشاء الحساب الآن — أعد المحاولة بعد لحظات.",
          );
          return;
        }
        await signIn(email.trim(), password);
        await navigate({ to: "/onboarding", replace: true });
        return;
      } else {
        await signIn(email.trim(), password);
        await navigate({ to: "/app", replace: true });
      }
    } catch (error) {
      setFormError(arabicError(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setFormError("");
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setErrors({ email: "أدخل بريدك أولاً لنرسل رابط الاستعادة." });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/auth?mode=signin`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (error) {
      setFormError(arabicError(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  const chosenPlan = plans.find((p) => p.id === search.plan);


  return (
    <PageShell>
      <PageHero
        eyebrow={isSignup ? "حساب مجاني بدون بطاقة" : "أهلاً بعودتك"}
        title={isSignup ? "أنشئ حسابك في دقيقة" : "سجّل الدخول إلى فريقك"}
        lead={
          isSignup
            ? "اسمك، اسم نشاطك، ولهجتك — وسيبدأ ستة موظفين رقميين العمل معك بالعربية."
            : "أدخل بريدك وكلمة المرور للعودة إلى موظفيك ومهامك."
        }
      />

      <section className="mx-auto max-w-2xl px-5 pb-24">
        {isSignup && chosenPlan ? (
          <Reveal>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/60 px-5 py-4">
              <p className="text-sm font-bold">
                اخترت باقة «{chosenPlan.name}» — تبدأ بـ ١٤ يوماً مجاناً بدون بطاقة.
              </p>
              <Link to="/pricing" className="text-sm font-bold text-primary">
                غيّر الباقة
              </Link>
            </div>
          </Reveal>
        ) : null}
        <Reveal>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">

            <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
              {(
                [
                  { k: "signup", l: "إنشاء حساب" },
                  { k: "signin", l: "تسجيل الدخول" },
                ] as const
              ).map((t) => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => switchMode(t.k)}
                  aria-pressed={mode === t.k}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
                    mode === t.k ? "bg-card text-primary shadow-card" : "text-ink-soft",
                  )}
                >
                  {t.l}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {isSignup ? (
                <>
                  <Field
                    id="fullName"
                    label="الاسم الكامل"
                    icon={User}
                    value={fullName}
                    onChange={setFullName}
                    placeholder="مثال: سارة العتيبي"
                    autoComplete="name"
                    error={errors['fullName']}
                  />
                  <Field
                    id="company"
                    label="اسم النشاط أو الشركة"
                    icon={Building2}
                    value={company}
                    onChange={setCompany}
                    placeholder="مثال: متجر لمسة"
                    autoComplete="organization"
                    error={errors['company']}
                  />
                  <div>
                    <label htmlFor="dialect" className="mb-1.5 block text-sm font-bold">
                      اللهجة المفضلة
                    </label>
                    <select
                      id="dialect"
                      value={dialect}
                      onChange={(e) => setDialect(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none transition-colors focus:border-primary"
                    >
                      {dialects.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <Field
                id="email"
                label="البريد الإلكتروني"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
                dir="ltr"
                error={errors['email']}
              />

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-bold">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 start-4 size-4.5 -translate-y-1/2 text-ink-soft" />
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    dir="ltr"
                    aria-invalid={Boolean(errors['password'])}
                    className={cn(inputCls, "pe-12", errors['password'] && "border-destructive")}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    className="absolute top-1/2 end-3 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:text-primary"
                  >
                    {showPw ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                  </button>
                </div>
                {errors['password'] ? (
                  <p className="mt-1.5 text-sm font-semibold text-destructive">{errors['password']}</p>
                ) : null}
                {isSignup && password ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-full flex-1 rounded-full transition-colors",
                            i < strength ? "bg-primary" : "bg-border",
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-ink-soft">
                      {["ضعيفة", "مقبولة", "جيدة", "قوية", "ممتازة"][strength]}
                    </span>
                  </div>
                ) : null}
              </div>

              {isSignup ? (
                <div>
                  <label htmlFor="confirm" className="mb-1.5 block text-sm font-bold">
                    تأكيد كلمة المرور
                  </label>
                  <div className="relative">
                    <ShieldCheck className="pointer-events-none absolute top-1/2 start-4 size-4.5 -translate-y-1/2 text-ink-soft" />
                    <input
                      id="confirm"
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      dir="ltr"
                      aria-invalid={Boolean(errors['confirm'])}
                      className={cn(inputCls, errors['confirm'] && "border-destructive")}
                      placeholder="••••••••"
                    />
                  </div>
                  {errors['confirm'] ? (
                    <p className="mt-1.5 text-sm font-semibold text-destructive">{errors['confirm']}</p>
                  ) : null}
                </div>
              ) : null}

              {isSignup ? (
                <div>
                  <label className="flex items-start gap-3 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-1 size-4 rounded border-border accent-primary"
                    />
                    <span className="text-ink-soft">
                      أوافق على{" "}
                      <Link to="/terms" className="font-bold text-primary underline">
                        الشروط
                      </Link>{" "}
                      و
                      <Link to="/privacy" className="font-bold text-primary underline">
                        سياسة الخصوصية
                      </Link>
                      .
                    </span>
                  </label>
                  {errors['accepted'] ? (
                    <p className="mt-1.5 text-sm font-semibold text-destructive">{errors['accepted']}</p>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onForgot}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              )}

              {formError ? (
                <p
                  role="alert"
                  className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
                >
                  {formError}
                </p>
              ) : null}
              {resetSent ? (
                <p
                  role="status"
                  className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary"
                >
                  أرسلنا رابط استعادة كلمة المرور إلى بريدك.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 font-bold text-background transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4.5 animate-spin" /> : <Sparkles className="size-4.5" />}
                {busy ? "لحظة..." : isSignup ? "أنشئ حسابي" : "دخول"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-ink-soft">
              {isSignup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "signin" : "signup")}
                className="font-bold text-primary hover:underline"
              >
                {isSignup ? "تسجيل الدخول" : "إنشاء حساب"}
              </button>
            </p>

            <Link
              to="/app"
              className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-ink-soft hover:text-primary"
            >
              تجربة الموظفين بدون تسجيل <ArrowLeft className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = "text",
  dir,
  error,
}: {
  id: string;
  label: string;
  icon: typeof Mail;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | undefined;
  autoComplete?: string | undefined;
  type?: string;
  dir?: "ltr" | "rtl";
  error?: string | undefined;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 start-4 size-4.5 -translate-y-1/2 text-ink-soft" />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...(dir ? { dir } : {})}
          aria-invalid={Boolean(error)}
          className={cn(inputCls, error && "border-destructive")}
        />
      </div>
      {error ? <p className="mt-1.5 text-sm font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
