import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, PanelRight, Loader2, Check, Copy, Sparkles, ArrowUpLeft, Link2, Fingerprint, Share2, RefreshCw, Download, PenLine, Plus, Trash2, ChevronDown } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { ConnectNow } from "@/components/app/ConnectNow";
import { getMember } from "@/data/team";
import { integrationStatusLabel } from "@/data/app";
import { useBrainItems, useConversations, useCreateConversation, useDeleteConversation, useIntegrations, useMessages, useRenameConversation, useWorkspace } from "@/lib/data";
import { askEmployee, runSkill } from "@/lib/ai.functions";
import { SkillPalette } from "@/components/app/SkillPalette";
import { Thinking } from "@/components/app/Thinking";
import { Markdown } from "@/components/app/Markdown";
import { PublishPanel } from "@/components/app/PublishPanel";
import { requestedPublishTargets } from "@/lib/platforms";
import { isNonPostReply } from "@/lib/post-format";
import { detectHandoff } from "@/lib/handoff";
import { HandoffCard } from "@/components/app/HandoffCard";
import { PublishToWordPress } from "@/components/app/PublishToWordPress";
import { ActionPanel } from "@/components/app/ActionPanel";
import { Portrait } from "@/components/site/Portrait";
import { MediaStudio, type Attachment, type ImageMode, type Aspect } from "@/components/app/MediaStudio";


import { featuredSkillsFor, skillsFor, type Skill } from "@/data/skills";
import { cn } from "@/lib/utils";

/** اقتراحات بداية سريعة لكل موظف — تُرسل كرسالة مباشرة. */
const STARTERS: Record<string, string[]> = {
  nour: [
    "اقترح 10 عناوين مقالات لمتجري",
    "اكتب وصف ميتا لصفحة خدماتي",
    "ما أهم 5 كلمات مفتاحية في مجالي؟",
  ],
  sonny: [
    "اكتب 3 أفكار منشورات لهذا الأسبوع",
    "منشور إطلاق منتج جديد بلهجة مصرية",
    "اقترح هاشتاقات لمقهى في الرياض",
  ],
  eva: [
    "رد على عميل يشتكي من تأخر الشحن",
    "صِغ رسالة ترحيب للعملاء الجدد",
    "رتّب لي أولويات بريد اليوم",
  ],
  sam: [
    "اكتب رسالة متابعة لعميل لم يرد",
    "حلّل هذا العرض واقترح تحسينه",
    "ما أفضل وقت للمتابعة مع العملاء؟",
  ],
  dana: [
    "صمّم فكرة بوست لعرض الجمعة البيضاء",
    "اقترح لوحة ألوان لعلامتي",
    "فكرة غلاف لحساب إنستجرام",
  ],
  adam: [
    "لخّص أداء الأسبوع الماضي",
    "ما المقياس الأهم لمتجري الآن؟",
    "جهّز تقريراً شهرياً مختصراً",
  ],
};

/** يقسّم الرسائل حسب اليوم لعرض فواصل تاريخ أنيقة. */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "اليوم";
  if (same(d, yesterday)) return "أمس";
  return d.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" });
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* تجاهل */
        }
      }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label="نسخ الرد"
    >
      {done ? <Check className="size-3 text-jade" /> : <Copy className="size-3" />}
      {done ? "نُسخ" : "نسخ"}
    </button>
  );
}

/** أزرار أسفل رد الموظف: نسخ · مشاركة · تنزيل · تعديل في المربع · إعادة التوليد. */
function MessageActions({
  text,
  onEdit,
  onRegenerate,
  disabled,
}: {
  text: string;
  onEdit: () => void;
  onRegenerate: (() => void) | null;
  disabled: boolean;
}) {
  const [shared, setShared] = useState(false);
  const btn =
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50";
  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 1600);
      }
    } catch {
      /* أُلغيت المشاركة */
    }
  };
  const download = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sahl-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <span className="flex flex-wrap items-center gap-0.5">
      <CopyButton text={text} />
      <button type="button" onClick={() => void share()} className={btn} aria-label="مشاركة">
        <Share2 className="size-3" /> {shared ? "نُسخ للمشاركة" : "مشاركة"}
      </button>
      <button type="button" onClick={download} className={btn} aria-label="تنزيل">
        <Download className="size-3" /> تنزيل
      </button>
      <button type="button" onClick={onEdit} className={btn} aria-label="تعديل يدوي">
        <PenLine className="size-3" /> عدّل
      </button>
      {onRegenerate ? (
        <button type="button" onClick={onRegenerate} disabled={disabled} className={btn} aria-label="إعادة التوليد">
          <RefreshCw className="size-3" /> أعد التوليد
        </button>
      ) : null}
    </span>
  );
}

/** آخر رسالة كتبها المستخدم قبل رد الموظف — لنعرف ما طلبه بالضبط (المنصة مثلاً). */
function lastUserBefore(arr: { role: string; body: string }[], idx: number): string {
  for (let i = idx - 1; i >= 0; i -= 1) {
    const m = arr[i];
    if (m && m.role === "user") return m.body;
  }
  return "";
}

/** يقرّر إن كان رد سِراج منشوراً قابلاً للنشر (لا سؤالاً ولا شرحاً قصيراً). */
function looksPostable(body: string): boolean {
  const text = body.trim();
  if (text.length < 80) return false;
  if (/^[^\n]{0,200}\?\s*$/.test(text)) return false;
  if (isNonPostReply(text)) return false;
  return /#[^\s#]{2,}/.test(text) || text.length > 220;
}

export const Route = createFileRoute("/app/chat/$id")({
  validateSearch: (s: Record<string, unknown>): { prompt?: string } =>
    typeof s["prompt"] === "string" && s["prompt"] ? { prompt: s["prompt"].slice(0, 4000) } : {},
  loader: ({ params }) => {
    const member = getMember(params.id);
    if (!member) throw notFound();
    return { name: member.name, role: member.role };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `محادثة ${loaderData.name} | سهل` : "محادثة | سهل" },
      {
        name: "description",
        content: loaderData ? `تحدث مع ${loaderData.name} — ${loaderData.role}.` : "محادثة الموظف.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => <ChatMissing />,
  notFoundComponent: () => <ChatMissing />,
  component: ChatPage,
});

function ChatMissing() {
  return (
    <AppShell title="الموظف غير موجود">
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <p className="text-ink-soft">لم نعثر على هذا الموظف ضمن فريقك.</p>
        <Link
          to="/app/chat"
          className="mt-5 inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background"
        >
          العودة للمحادثات
        </Link>
      </div>
    </AppShell>
  );
}

/** عناوين عربية لمفاتيح JSON عند عرض رد قديم بصيغة غير متوقعة. */
const JSON_LABELS: Record<string, string> = {
  day: "اليوم",
  title: "العنوان",
  content_pillar: "محور المحتوى",
  channel: "المنصة",
  body: "النص",
  caption: "النص",
  hashtags: "الهاشتاجات",
  scheduled: "موعد النشر",
  best_time: "أفضل وقت",
  metrics_to_measure: "مؤشرات القياس",
  call_to_action: "دعوة لاتخاذ إجراء",
  instagram_post: "منشور إنستجرام",
  x_post: "تغريدة إكس",
  linkedin_post: "منشور لينكدإن",
  facebook_post: "منشور فيسبوك",
};
const JSON_HIDDEN = new Set(["image_prompt", "needs_connection", "kind", "provider", "reason"]);

/** يحوّل أي بنية JSON إلى نص عربي مقروء بدل عرض أقواس ومفاتيح. */
function jsonToText(node: unknown, depth = 0): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node.replace(/\\n/g, "\n").trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node))
    return node
      .map((v) => {
        const r = jsonToText(v, depth + 1);
        return r && typeof v !== "object" ? `- ${r}` : r;
      })
      .filter(Boolean)
      .join(depth === 0 ? "\n\n---\n\n" : "\n");
  if (typeof node === "object")
    return Object.entries(node as Record<string, unknown>)
      .filter(([k, v]) => !JSON_HIDDEN.has(k) && v !== null && v !== undefined && v !== "")
      .map(([k, v]) => {
        const r = jsonToText(v, depth + 1);
        if (!r) return "";
        const label = JSON_LABELS[k] ?? k.replace(/_/g, " ");
        if (typeof v === "object") return `${"#".repeat(Math.min(depth + 2, 6))} ${label}\n\n${r}`;
        return r.includes("\n") ? `**${label}:**\n\n${r}` : `**${label}:** ${r}`;
      })
      .filter(Boolean)
      .join("\n\n");
  return "";
}

/** بعض الردود القديمة محفوظة كنص JSON خام — نحوّلها لعرض مقروء. */
/** يفصل بادئة JSON عن أي نص أُلحق بها (صورة، مصادر) في الردود القديمة. */
function splitJsonPrefix(text: string): { parsed: unknown; rest: string } | null {
  const open = text[0];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return { parsed: JSON.parse(text.slice(0, i + 1)), rest: text.slice(i + 1).trim() };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function prettyBody(body: string): string {
  const text = body.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return body;
  try {
    const split = splitJsonPrefix(text);
    if (!split) throw new Error("not json");
    const { parsed, rest } = split;
    const tail = rest ? `\n\n${rest}` : "";
    const items = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{
      reply?: string;
      deliverable?: { title?: string; body?: string } | null;
      deliverables?: Array<{ title?: string; body?: string }> | null;
    }>;
    const parts = items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const chunk: string[] = [];
      if (typeof item.reply === "string" && item.reply.trim()) chunk.push(item.reply.trim());
      for (const d of [item.deliverable, ...(Array.isArray(item.deliverables) ? item.deliverables : [])])
        if (d?.body) chunk.push(`### ${d.title ?? "المخرج"}\n\n${d.body}`);
      return chunk;
    });
    if (parts.length) return parts.join("\n\n") + tail;
    const readable = jsonToText(parsed);
    return readable.trim().length > 20 ? readable + tail : body;
  } catch {
    return body;
  }
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function ChatPage() {
  const { id } = Route.useParams();
  const member = getMember(id)!;
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const { data: conversations } = useConversations(workspace?.id, id);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const createConversation = useCreateConversation(workspace?.id, id);
  const renameConversation = useRenameConversation(workspace?.id, id);
  const deleteConversation = useDeleteConversation(workspace?.id, id);
  const { data: messages } = useMessages(workspace?.id, id, conversationId);
  const { data: integrations } = useIntegrations(workspace?.id);
  const { data: brainItems } = useBrainItems(workspace?.id);
  const hasVoiceGuide = (brainItems ?? []).some((b) => b.title === "دليل صوت العلامة");
  const { prompt: prefill } = Route.useSearch();
  const [draft, setDraft] = useState(prefill ?? "");
  useEffect(() => {
    if (prefill) setDraft(prefill);
  }, [prefill]);
  const [pending, setPending] = useState<string | null>(null);
  const [savedTask, setSavedTask] = useState(false);
  /** طلب ربط سياقي: يظهر فقط عندما تحتاج المهمة الحالية حساباً غير مربوط. */
  const [needsConnection, setNeedsConnection] = useState<{ provider: string; reason: string } | null>(null);

  const [error, setError] = useState<string | null>(null);

  // حرية الوسائط: مرفقات المستخدم + قراره في الصورة التلقائية + نسبة الأبعاد.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [imageMode, setImageMode] = useState<ImageMode>("auto");
  const [imagePrompt, setImagePrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("square");


  useEffect(() => {
    if (!conversationId && conversations?.[0]) setConversationId(conversations[0].id);
    if (conversationId && conversations && !conversations.some((c) => c.id === conversationId)) {
      setConversationId(conversations[0]?.id);
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    if (!workspace || conversations === undefined || conversations.length > 0 || createConversation.isPending) return;
    createConversation.mutate(undefined, { onSuccess: (row) => setConversationId(row.id) });
  }, [workspace, conversations, createConversation]);

  const [showSettings, setShowSettings] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ask = useServerFn(askEmployee);
  const runSkillFn = useServerFn(runSkill);
  const employeeSkills = skillsFor(id);
  const quickSkills = featuredSkillsFor(id).slice(0, 6);
  /** آخر رسالة فشل إرسالها — لزر «أعد المحاولة». */
  const [pendingText, setPendingText] = useState<string | null>(null);

  const owned = (integrations ?? []).filter((i) => i.employee_id === id);
  const wpConnected = (integrations ?? []).some(
    (i) => i.provider === "wordpress" && i.status === "connected",
  );

  const send = useMutation({
    mutationFn: (message: string) =>
      ask({
        data: {
          workspaceId: workspace!.id,
          employeeId: id,
          conversationId: conversationId!,
          message,
          attachments,
          imageMode,
          imagePrompt: imagePrompt.trim() || undefined,
          imageAspect: aspect,
        },
      }),

    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["messages", workspace?.id, id, conversationId] });
      setPending(null);
      setPendingText(null);
      // المرفقات ووصف الصورة يخصّان الرسالة المُرسلة فقط.
      setAttachments([]);
      setImagePrompt("");

      setSavedTask(Boolean(res?.createdTaskId));
      setNeedsConnection(res?.needsConnection ?? null);
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["conversations", workspace?.id, id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown, message) => {
      setPending(null);
      setPendingText(message);
      setError(e instanceof Error ? e.message : "تعذّر إرسال الطلب");
    },
  });

  const skillRun = useMutation({
    mutationFn: (p: { skill: Skill; values: Record<string, string> }) =>
      runSkillFn({
        data: {
          workspaceId: workspace!.id,
          employeeId: id,
          skillId: p.skill.id,
          values: p.values,
          conversationId: conversationId!,
        },
      }),
    onSuccess: (res) => {
      setSavedTask(Boolean(res?.taskId));
      void qc.invalidateQueries({ queryKey: ["messages", workspace?.id, id, conversationId] });
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر تنفيذ المهمة"),
  });

  const busy = send.isPending || skillRun.isPending;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, send.isPending, skillRun.isPending]);

  // إبقاء التركيز في مربع الكتابة + تمدد تلقائي لارتفاع النص.
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, id]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = (text: string) => {
    const body = text.trim();
    if (!body || !workspace || !conversationId || busy) return;
    setError(null);
    setSavedTask(false);

    setDraft("");
    setPending(body);
    send.mutate(body);
  };

  return (
    <AppShell
      title={member.name}
      lead={member.role}
      padded={false}
      actions={
        <>
        <button
          type="button"
          onClick={() => createConversation.mutate(undefined, { onSuccess: (row) => setConversationId(row.id) })}
          disabled={!workspace || createConversation.isPending}
          className="grid size-10 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary disabled:opacity-50"
          aria-label="محادثة جديدة"
          title="محادثة جديدة"
        >
          {createConversation.isPending ? <Loader2 className="size-4.5 animate-spin" /> : <Plus className="size-4.5" />}
        </button>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={cn(
            "grid size-10 place-items-center rounded-xl border border-border transition-colors",
            showSettings ? "bg-foreground text-background" : "hover:bg-secondary",
          )}
          aria-label="المحادثات وتفاصيل الموظف"
          title="المحادثات وتفاصيل الموظف"
        >
          <PanelRight className="size-4.5" />
        </button>
        </>
      }
    >
      <div className={cn("grid", showSettings && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="relative flex min-h-[calc(100dvh-5.3rem)] min-w-0 flex-col">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_9%,transparent),transparent)]"
          />
          <div className="relative mx-auto w-full max-w-3xl flex-1 space-y-4 px-5 py-6">
            {brainItems && !hasVoiceGuide && ["sonny", "nour", "eva", "dana"].includes(id) ? (
              <Link
                to="/app/brain"
                className="group flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-aurora)" }}
                >
                  <Fingerprint className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">خلّي {member.name} يكتب بصوت علامتك بالضبط</span>
                  <span className="block text-xs text-muted-foreground">
                    الصق رابط موقعك مرة واحدة — نستخرج اللهجة والنبرة والمفردات ويلتزم بها الفريق كله. مجانًا.
                  </span>
                </span>
                <ArrowUpLeft className="size-4 shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:-translate-x-0.5" />
              </Link>
            ) : null}
            {(messages ?? []).length === 0 && !pending ? (
              <div className="animate-pop-in rounded-3xl border border-border bg-card p-8 text-center shadow-card">
                <span className="relative mx-auto block size-20 rounded-3xl">
                  <span className="absolute inset-0 rounded-3xl animate-pulse-ring" />
                  <span className="relative block size-full overflow-hidden rounded-3xl shadow-card">
                    <Portrait memberId={member.id} name={member.name} className="size-full" eager />
                  </span>
                </span>
                <p className="mt-4 font-display text-xl font-black">أهلاً، أنا {member.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{member.tagline}</p>
                <p className="mt-5 text-[0.7rem] font-bold tracking-wide text-muted-foreground">
                  ابدأ بواحدة من هذه
                </p>
                <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                  {(STARTERS[id] ?? []).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      disabled={!workspace || busy}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card disabled:opacity-50"
                    >
                      {s}
                      <ArrowUpLeft className="size-3.5 text-primary opacity-0 transition-all group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-xs text-muted-foreground">
                  أو اضغط «كل القدرات» بالأسفل لتنفيذ مهمة كاملة بنموذج جاهز.
                </p>
              </div>
            ) : null}

            {(messages ?? []).map((m, idx, arr) => {
              const prev = arr[idx - 1];
              const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
              const isUser = m.role === "user";
              const body = isUser ? m.body : prettyBody(m.body);
              return (
                <div key={m.id} className="space-y-4">
                  {newDay ? (
                    <div className="flex items-center gap-3 py-1 text-[0.7rem] font-bold text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      {dayLabel(m.created_at)}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "group flex gap-3 animate-bubble-in",
                      isUser ? "justify-start" : "justify-end",
                    )}
                  >
                    {!isUser ? (
                      <span className="relative order-2 mt-1 block size-9 shrink-0 overflow-hidden rounded-xl shadow-sm">
                        <Portrait memberId={member.id} name={member.name} className="size-full" />
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "min-w-0 max-w-[min(46rem,88%)] rounded-3xl px-5 py-3.5 leading-relaxed",
                        isUser
                          ? "bubble-user rounded-ss-lg text-background whitespace-pre-wrap shadow-card"
                          : "order-1 rounded-se-lg border border-border bg-card shadow-sm",
                      )}
                    >
                      {isUser ? <p dir="auto">{m.body}</p> : <Markdown body={body} />}
                      {!isUser && id === "nour" && workspace && m.body.length > 600 ? (
                        wpConnected ? (
                          <PublishToWordPress workspaceId={workspace.id} body={m.body} />
                        ) : (
                          <span className="mt-3 inline-flex">
                            <ConnectNow
                              workspaceId={workspace.id}
                              provider="wordpress"
                              size="sm"
                              label="اربط ووردبريس وانشر المقال"
                            />
                          </span>
                        )
                      ) : null}
                      {!isUser &&
                      id === "sonny" &&
                      workspace &&
                      !m.body.includes("(/app/tasks)") &&
                      looksPostable(m.body) ? (
                        <PublishPanel
                          workspaceId={workspace.id}
                          employeeId="sonny"
                          channel={requestedPublishTargets(lastUserBefore(arr, idx))[0] ?? "instagram"}
                          request={lastUserBefore(arr, idx)}
                          body={m.body}
                        />
                      ) : null}

                      {!isUser
                        ? (() => {
                            const req = lastUserBefore(arr, idx);
                            const handoff = detectHandoff(req, id);
                            return handoff ? (
                              <HandoffCard handoff={handoff} request={req} currentName={member.name} />
                            ) : null;
                          })()
                        : null}

                      <div
                        className={cn(
                          "mt-1.5 flex items-center gap-2 text-[0.7rem]",
                          isUser ? "text-background/60" : "text-muted-foreground",
                        )}
                      >
                        <span>{timeOf(m.created_at)}</span>
                        {!isUser ? (
                          <span className="ms-auto opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <MessageActions
                              text={body}
                              disabled={busy}
                              onEdit={() => {
                                setDraft(body);
                                inputRef.current?.focus();
                              }}
                              onRegenerate={
                                lastUserBefore(arr, idx)
                                  ? () => submit(`${lastUserBefore(arr, idx)}\n\n(أعد صياغة الرد السابق بزاوية مختلفة وأقوى، وحافظ على نفس الطلب.)`)
                                  : null
                              }
                            />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {pending ? (
              <div className="flex justify-start gap-3 animate-bubble-in">
                <div className="bubble-user min-w-0 max-w-[min(46rem,88%)] rounded-3xl rounded-ss-lg px-5 py-3.5 leading-relaxed text-background shadow-card">
                  <p dir="auto" className="whitespace-pre-wrap">
                    {pending}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[0.7rem] text-background/60">
                    <Check className="size-3" /> وصل إلى {member.name}
                  </p>
                </div>
              </div>
            ) : null}

            {busy ? (
              <Thinking
                memberId={member.id}
                name={member.name}
                request={pending ?? pendingText ?? ""}
                imageRequested={imageMode !== "off" && (imageMode !== "auto" || Boolean(imagePrompt.trim()))}
                attachments={attachments.length}
              />
            ) : null}

            {savedTask && !busy ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-jade/25 bg-jade/10 px-4 py-3 text-sm font-semibold text-jade-deep animate-pop-in">
                <span className="grid size-7 place-items-center rounded-full bg-jade text-background">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                تم حفظ المخرج في «الموافقات» بانتظار اعتمادك.
                <Link
                  to="/app/approvals"
                  className="ms-auto rounded-full bg-jade-deep px-4 py-1.5 text-xs font-bold text-background transition-transform hover:-translate-y-0.5"
                >
                  افتح الموافقات
                </Link>
              </div>
            ) : null}

            {needsConnection && !busy ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm font-semibold animate-pop-in">
                <AppIcon name={needsConnection.provider} className="size-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  لتنفيذ هذه المهمة فعلياً يحتاج {member.name} ربط{" "}
                  <b>{appLabel(needsConnection.provider)}</b>
                  {needsConnection.reason ? ` — ${needsConnection.reason}` : ""}. دقيقة واحدة عبر OAuth الرسمي.
                </span>
                <ConnectNow
                  workspaceId={workspace?.id}
                  provider={needsConnection.provider}
                  size="sm"
                />
                <button
                  onClick={() => setNeedsConnection(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  لاحقاً
                </button>
              </div>
            ) : null}

            {error ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral animate-pop-in">
                <span className="flex-1">{error}</span>
                {pendingText ? (
                  <button
                    type="button"
                    onClick={() => submit(pendingText)}
                    className="rounded-full bg-coral px-4 py-1.5 text-xs font-bold text-background"
                  >
                    أعد المحاولة
                  </button>
                ) : null}
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          <div className="pointer-events-none sticky bottom-0 z-20 p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
              className="pointer-events-auto mx-auto max-w-3xl rounded-3xl border border-border/70 bg-card/70 p-2 shadow-lift backdrop-blur-2xl transition-all focus-within:border-primary focus-within:bg-card/90 focus-within:ring-4 focus-within:ring-primary/10"
            >

              <textarea
                ref={inputRef}
                value={draft}
                rows={1}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(draft);
                  }
                }}
                placeholder={`اكتب طلبك لـ${member.name}…`}
                dir="auto"
                className="max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 outline-none placeholder:text-muted-foreground/80"
              />
              <div className="flex items-start gap-2 px-1 pb-0.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <MediaStudio
                    workspaceId={workspace?.id}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    imageMode={imageMode}
                    onImageModeChange={setImageMode}
                    imagePrompt={imagePrompt}
                    onImagePromptChange={setImagePrompt}
                    aspect={aspect}
                    onAspectChange={setAspect}
                    disabled={busy}
                  />
                  <SkillPalette
                    skills={employeeSkills}
                    quick={quickSkills}
                    hideQuick={(messages ?? []).length > 0 || Boolean(pending)}
                    disabled={!workspace}
                    pending={busy}
                    onRun={(skill, values) => {
                      setError(null);
                      skillRun.mutate({ skill, values });
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !workspace || !draft.trim()}
                  className="grid size-10 shrink-0 place-items-center rounded-2xl bg-foreground text-background transition-all hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  aria-label="إرسال"
                >
                  {busy ? (
                    <Loader2 className="size-4.5 animate-spin" />
                  ) : (
                    <Send className="size-4.5 -scale-x-100" />
                  )}
                </button>
              </div>


            </form>
          </div>
        </div>

        <aside
          className={cn(
            "border-s border-border bg-card p-5 lg:sticky lg:top-[5.3rem] lg:h-[calc(100dvh-5.3rem)] lg:overflow-y-auto",
            showSettings ? "block" : "hidden",
          )}
        >
          <div className="mb-6 border-b border-border pb-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-black">المحادثات</h2>
              <button
                type="button"
                aria-label="محادثة جديدة"
                title="محادثة جديدة"
                disabled={!workspace || createConversation.isPending}
                onClick={() => createConversation.mutate(undefined, { onSuccess: (row) => setConversationId(row.id) })}
                className="grid size-9 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {createConversation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </button>
            </div>
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {(conversations ?? []).map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-xl border px-2 py-1.5",
                    conversation.id === conversationId ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-secondary/70",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setConversationId(conversation.id)}
                    onDoubleClick={() => {
                      const title = window.prompt("اسم المحادثة", conversation.title)?.trim();
                      if (title) renameConversation.mutate({ id: conversation.id, title });
                    }}
                    className="min-w-0 flex-1 truncate px-2 py-1 text-start text-sm font-semibold"
                    title="انقر مرتين لإعادة التسمية"
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    aria-label="حذف المحادثة"
                    title="حذف المحادثة"
                    onClick={() => {
                      if (window.confirm("حذف هذه المحادثة ورسائلها؟")) deleteConversation.mutate(conversation.id);
                    }}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-coral/10 hover:text-coral group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            className="flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-1 text-start"
          >
            <span className="font-display font-black">تفاصيل {member.name}</span>
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", infoOpen && "rotate-180")}
            />
          </button>

          {infoOpen ? (
            <div>
              <p className="mt-1 text-sm text-muted-foreground">
                حساب واحد لكل منصة داخل مساحة العمل.
              </p>
              <ul className="mt-4 space-y-2">
                {owned.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 p-3"
                  >
                    <AppIcon name={i.provider} className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {appLabel(i.provider)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {i.account ?? "لم يُربط بعد"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold",
                        i.status === "connected" && "bg-jade/12 text-jade-deep",
                        i.status === "error" && "bg-coral/15 text-coral",
                        i.status === "disconnected" && "bg-secondary text-muted-foreground",
                      )}
                    >
                      {integrationStatusLabel[i.status as keyof typeof integrationStatusLabel] ??
                        i.status}
                    </span>
                  </li>
                ))}
              </ul>

              <ActionPanel
                employeeId={id}
                workspaceId={workspace?.id}
                connected={(integrations ?? [])
                  .filter((i) => i.status === "connected")
                  .map((i) => i.provider)}
              />

              <h2 className="mt-7 font-display font-black">ما يجيده</h2>

              <ul className="mt-3 space-y-2">
                {member.tasks.slice(0, 4).map((t) => (
                  <li key={t} className="flex gap-2 text-sm text-ink-soft">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-jade" />
                    {t}
                  </li>
                ))}
              </ul>

              <Link
                to="/app/brain"
                className="mt-7 block rounded-2xl bg-secondary/60 p-4 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                يقرأ من عقل العلامة — أضف مستندات ليصبح أدق ↖
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
