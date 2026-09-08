import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, MessageCircle, RefreshCw, Trash2 } from "lucide-react";

import {
  createLinkCode,
  removeCommandLink,
  selectWhatsappPhone,
  whatsappPhones,
  whatsappStatus,
} from "@/lib/command-channels.functions";
import { startPipedreamConnect, syncPipedreamAccounts } from "@/lib/pipedream.functions";

const WEBHOOK_URL =
  "https://project--541025ee-163e-49a6-8c43-600f36bcb147.lovable.app/api/public/whatsapp/webhook";

const field =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-jade";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-secondary/50 p-3">
      <p className="mb-1 text-xs font-bold text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-xs" dir="ltr">
          {value}
        </code>
        <button
          type="button"
          aria-label={`نسخ ${label}`}
          className="shrink-0 rounded-xl border border-border p-2 hover:bg-background"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4 text-jade" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** إعداد التحكّم بسِراج عبر واتساب: الربط عبر الوسيط ثم السماح لأرقام المالك وفريقه. */
export function WhatsAppCommand({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const status = useServerFn(whatsappStatus);
  const phones = useServerFn(whatsappPhones);
  const selectPhone = useServerFn(selectWhatsappPhone);
  const code = useServerFn(createLinkCode);
  const remove = useServerFn(removeCommandLink);
  const startConnect = useServerFn(startPipedreamConnect);
  const sync = useServerFn(syncPipedreamAccounts);

  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-channel", workspaceId],
    queryFn: () => status({ data: { workspaceId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["whatsapp-channel", workspaceId] });

  const phonesQuery = useQuery({
    queryKey: ["whatsapp-phones", workspaceId],
    queryFn: () => phones({ data: { workspaceId } }),
    enabled: Boolean(data?.account),
    retry: false,
  });

  const selectMutation = useMutation({
    mutationFn: (phoneNumberId: string) => selectPhone({ data: { workspaceId, phoneNumberId } }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const syncMutation = useMutation({
    mutationFn: () => sync({ data: { workspaceId } }),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["whatsapp-phones", workspaceId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const codeMutation = useMutation({
    mutationFn: (label: string) =>
      code({ data: { workspaceId, label: label || null, role: "owner" } }),
    onSuccess: (r) => {
      setNewCode(r.code);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const connect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const { url } = await startConnect({
        data: {
          workspaceId,
          provider: "whatsapp",
          origin: window.location.origin,
          returnTo: `${window.location.pathname}${window.location.search}`,
        },
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر بدء الربط");
      setConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
      </p>
    );
  }

  const phoneList = phonesQuery.data?.phones ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <MessageCircle className="size-5 text-jade" /> التحكّم عبر واتساب
        </h2>
        <p className="text-sm text-muted-foreground">
          ابعت لسِراج على واتساب: «اكتب بوست عن عرض خصم ٥٠٪ لليوم» — يرد بمسودة، وترد «انشر» فيتنشر
          على منصاتك المربوطة.
        </p>
      </header>

      {error ? (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-border p-4">
        <h3 className="text-sm font-black">١. اربط حساب واتساب للأعمال</h3>
        <p className="text-sm text-muted-foreground">
          الربط يتم في نافذة آمنة لدى مزوّد التكاملات — بياناتك لا تُحفظ عندنا إطلاقاً.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={connect}
            disabled={connecting}
            className="rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60"
          >
            {connecting ? "جارٍ الفتح…" : data?.account ? "إعادة الربط" : "اربط واتساب"}
          </button>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold hover:bg-secondary disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            تحديث الحالة
          </button>
        </div>
        {data?.account ? (
          <p className="text-sm font-semibold text-jade-deep">مربوط · {data.account}</p>
        ) : null}
      </section>

      {data?.account ? (
        <section className="space-y-3 rounded-3xl border border-border p-4">
          <h3 className="text-sm font-black">٢. اختر رقم الإرسال</h3>
          {phonesQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ قراءة الأرقام…
            </p>
          ) : phonesQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              تعذّر قراءة الأرقام تلقائياً — أدخل معرّف رقم الإرسال يدوياً بالأسفل.
            </p>
          ) : null}

          <ul className="space-y-2">
            {phoneList.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span dir="ltr">{p.displayNumber || p.id}</span>
                  {p.name ? ` · ${p.name}` : ""}
                </span>
                {data.phoneNumberId === p.id ? (
                  <span className="font-bold text-jade-deep">مُعتمد</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectMutation.mutate(p.id)}
                    disabled={selectMutation.isPending}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-60"
                  >
                    اعتمد هذا الرقم
                  </button>
                )}
              </li>
            ))}
          </ul>

          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              selectMutation.mutate(String(f.get("phoneNumberId") ?? "").trim());
            }}
          >
            <input
              name="phoneNumberId"
              placeholder="Phone Number ID (يدوياً)"
              dir="ltr"
              className={`${field} sm:w-64`}
            />
            <button
              type="submit"
              disabled={selectMutation.isPending}
              className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary disabled:opacity-60"
            >
              {selectMutation.isPending ? "جارٍ التحقق…" : "اعتمد"}
            </button>
          </form>
        </section>
      ) : null}

      {data?.connected ? (
        <section className="space-y-3 rounded-3xl border border-border p-4">
          <h3 className="text-sm font-black">٣. إعداد الويبهوك في لوحة ميتا</h3>
          <p className="text-sm text-muted-foreground">
            في تطبيق ميتا ← WhatsApp ← Configuration، ضع الرابط وكلمة التحقق التاليين، ثم فعّل حقل
            الرسائل (messages).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CopyRow label="Callback URL" value={WEBHOOK_URL} />
            <CopyRow label="Verify token" value={data.verifyToken} />
          </div>
          {data.displayNumber ? (
            <p className="text-sm font-semibold text-jade-deep" dir="ltr">
              {data.displayNumber}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-border p-4">
        <h3 className="text-sm font-black">٤. الأرقام المسموح لها بإصدار الأوامر</h3>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            codeMutation.mutate(String(f.get("label") ?? "").trim());
          }}
        >
          <input name="label" placeholder="اسم صاحب الرقم (اختياري)" className={`${field} sm:w-64`} />
          <button
            type="submit"
            disabled={codeMutation.isPending}
            className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary disabled:opacity-60"
          >
            {codeMutation.isPending ? "…" : "أنشئ كود ربط"}
          </button>
        </form>
        {newCode ? (
          <p className="rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
            أرسل هذا الكود من واتساب إلى رقم أعمالك خلال ١٥ دقيقة:{" "}
            <span dir="ltr" className="font-mono">
              {newCode}
            </span>
          </p>
        ) : null}

        <ul className="space-y-2">
          {(data?.links ?? []).map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
            >
              <span className="min-w-0 truncate">
                <span dir="ltr">{l.external_id}</span>
                {l.label ? ` · ${l.label}` : ""}
              </span>
              <button
                type="button"
                aria-label="حذف الرقم"
                className="shrink-0 rounded-xl border border-border p-2 hover:bg-secondary"
                onClick={async () => {
                  await remove({ data: { workspaceId, id: l.id } });
                  invalidate();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {!(data?.links ?? []).length ? (
            <li className="text-sm text-muted-foreground">لا أرقام مربوطة بعد.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
