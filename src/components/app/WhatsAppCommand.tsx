import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, MessageCircle, Trash2 } from "lucide-react";

import {
  createLinkCode,
  removeCommandLink,
  saveWhatsappChannel,
  whatsappStatus,
} from "@/lib/command-channels.functions";

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

/** إعداد التحكّم بسِراج عبر واتساب: ربط رقم الأعمال ثم السماح لأرقام المالك وفريقه. */
export function WhatsAppCommand({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const status = useServerFn(whatsappStatus);
  const save = useServerFn(saveWhatsappChannel);
  const code = useServerFn(createLinkCode);
  const remove = useServerFn(removeCommandLink);

  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-channel", workspaceId],
    queryFn: () => status({ data: { workspaceId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["whatsapp-channel", workspaceId] });

  const saveMutation = useMutation({
    mutationFn: (input: { phoneNumberId: string; token: string }) =>
      save({ data: { workspaceId, ...input } }),
    onSuccess: () => {
      setError(null);
      invalidate();
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

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
      </p>
    );
  }

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
        <h3 className="text-sm font-black">١. رقم واتساب للأعمال</h3>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            saveMutation.mutate({
              phoneNumberId: String(f.get("phoneNumberId") ?? "").trim(),
              token: String(f.get("token") ?? "").trim(),
            });
          }}
        >
          <input
            name="phoneNumberId"
            defaultValue={data?.phoneNumberId ?? ""}
            placeholder="Phone Number ID"
            dir="ltr"
            className={field}
            required
          />
          <input
            name="token"
            type="password"
            placeholder="التوكن الدائم للتطبيق"
            dir="ltr"
            className={field}
            required
          />
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {saveMutation.isPending ? "جارٍ التحقق…" : data?.connected ? "تحديث الربط" : "اربط الرقم"}
          </button>
        </form>
        {data?.connected ? (
          <p className="text-sm font-semibold text-jade-deep">
            مربوط{data.displayNumber ? ` · ${data.displayNumber}` : ""}
          </p>
        ) : null}
      </section>

      {data?.connected ? (
        <section className="space-y-3 rounded-3xl border border-border p-4">
          <h3 className="text-sm font-black">٢. إعداد الويبهوك في لوحة ميتا</h3>
          <p className="text-sm text-muted-foreground">
            في تطبيق ميتا ← WhatsApp ← Configuration، ضع الرابط وكلمة التحقق التاليين، ثم فعّل حقل
            الرسائل (messages).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CopyRow label="Callback URL" value={WEBHOOK_URL} />
            <CopyRow label="Verify token" value={data.verifyToken} />
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-border p-4">
        <h3 className="text-sm font-black">٣. الأرقام المسموح لها بإصدار الأوامر</h3>
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
