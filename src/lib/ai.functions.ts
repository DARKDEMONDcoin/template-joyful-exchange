import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { freeChat } from "@/lib/nour-research.server";
import { actionTruthRules, sanitizeActionClaims } from "@/lib/action-claims";
import {
  craft,
  evidenceRules,
  executeSkill,
  personas,
  qualityCriteria,
  researchFor,
} from "@/lib/nour-run.server";
import { employeeDirectory, sharedSystemBlocks, type EmployeeId } from "@/lib/team-knowledge";

type Deliverable = {
  title?: string;
  kind?: string;
  channel?: string;
  body?: string;
  scheduled?: string;
  image_prompt?: string | null;
};

type NeedsConnection = { provider: string; reason: string } | null;

/** ترجمة مفاتيح JSON الشائعة إلى عناوين عربية عند عرض مخرج غير مطابق للبنية. */
const KEY_LABELS: Record<string, string> = {
  day: "اليوم",
  date: "التاريخ",
  title: "العنوان",
  content_pillar: "محور المحتوى",
  pillar: "المحور",
  channel: "المنصة",
  platform: "المنصة",
  body: "النص",
  caption: "النص",
  text: "النص",
  hashtags: "الهاشتاجات",
  scheduled: "موعد النشر",
  best_time: "أفضل وقت",
  time: "الوقت",
  metrics_to_measure: "مؤشرات القياس",
  metrics: "المؤشرات",
  kpis: "المؤشرات",
  call_to_action: "دعوة لاتخاذ إجراء",
  cta: "دعوة لاتخاذ إجراء",
  instagram_post: "منشور إنستجرام",
  x_post: "تغريدة إكس",
  linkedin_post: "منشور لينكدإن",
  facebook_post: "منشور فيسبوك",
  notes: "ملاحظات",
  summary: "ملخص",
};

/** مفاتيح تقنية لا تُعرض للمستخدم داخل النص. */
const HIDDEN_KEYS = new Set(["image_prompt", "needs_connection", "kind", "provider", "reason"]);

const labelFor = (key: string) => KEY_LABELS[key] ?? key.replace(/_/g, " ");

/** يحوّل أي بنية JSON غير متوقعة إلى Markdown عربي مقروء بدل عرض JSON خام. */
function jsonToMarkdown(node: unknown, depth = 0): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node.replace(/\\n/g, "\n").trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) {
    return node
      .map((item) => {
        const rendered = jsonToMarkdown(item, depth + 1);
        if (!rendered) return "";
        return typeof item === "object" && item !== null ? rendered : `- ${rendered}`;
      })
      .filter(Boolean)
      .join(depth === 0 ? "\n\n---\n\n" : "\n");
  }
  if (typeof node === "object") {
    const entries = Object.entries(node as Record<string, unknown>).filter(
      ([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== "",
    );
    return entries
      .map(([key, value]) => {
        const rendered = jsonToMarkdown(value, depth + 1);
        if (!rendered) return "";
        const heading = "#".repeat(Math.min(depth + 2, 6));
        if (typeof value === "object")
          return `${heading} ${labelFor(key)}\n\n${rendered}`;
        if (rendered.includes("\n")) return `**${labelFor(key)}:**\n\n${rendered}`;
        return `**${labelFor(key)}:** ${rendered}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

/** يلتقط المخرجات الجاهزة من أي بنية JSON متداخلة (خطة أسبوع، عدة منشورات…). */
function harvestDeliverables(node: unknown, out: Deliverable[] = [], depth = 0): Deliverable[] {
  if (out.length >= 24 || depth > 5 || !node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) harvestDeliverables(item, out, depth + 1);
    return out;
  }
  const obj = node as Record<string, unknown>;
  const text = ["body", "caption", "text", "content", "post"]
    .map((k) => obj[k])
    .find((v): v is string => typeof v === "string" && v.trim().length > 30);
  if (text) {
    const extras = [obj["hashtags"], obj["call_to_action"], obj["cta"]]
      .map((v) => (Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : ""))
      .filter(Boolean)
      .join("\n\n");
    const str = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : undefined);
    const channel = str("channel") ?? str("platform");
    const scheduled = str("scheduled") ?? str("best_time");
    const imagePrompt = str("image_prompt");
    out.push({
      title: str("title") ?? str("day") ?? "مخرج جاهز",
      body: extras ? `${text.replace(/\\n/g, "\n")}\n\n${extras}` : text.replace(/\\n/g, "\n"),
      ...(channel ? { channel } : {}),
      ...(scheduled ? { scheduled } : {}),
      ...(imagePrompt ? { image_prompt: imagePrompt } : {}),
    });
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") harvestDeliverables(value, out, depth + 1);
  }
  return out;
}

const input = z.object({
  workspaceId: z.string().uuid(),
  employeeId: z.string().min(1),
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid(),
  /** وسائط أرفقها المستخدم (صور/فيديو) — تُحفظ داخل رسالته وتُعرض في المحادثة. */
  attachments: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        type: z.enum(["image", "video"]).default("image"),
        alt: z.string().max(160).optional(),
      }),
    )
    .max(8)
    .optional(),
  /** تحكّم المستخدم في الصورة التلقائية: تلقائي · إيقاف · وصف يكتبه بنفسه. */
  imageMode: z.enum(["auto", "off", "manual"]).optional(),
  imagePrompt: z.string().max(900).optional(),
  imageAspect: z.enum(["square", "portrait", "landscape", "story"]).optional(),
});


/** الموظفون الذين تُولَّد لهم صورة فعلية عند وجود وصف بصري في الرد. */
const VISUAL_EMPLOYEES = new Set(["dana", "sonny", "nour"]);

export const askEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    // المفاتيح تُقرأ داخل freeChat من جدول app_secrets في Supabase.
    const apiKey = "";

    const supabase = context.supabase;
    const persona = personas[data.employeeId];
    if (!persona) throw new Error("موظف غير معروف.");

    const [
      { data: workspace },
      { data: conversation },
      { data: brain },
      { data: durable },
      { data: history },
      { data: linked },
      { data: direct },
      { data: recentTasks },
    ] = await Promise.all([
      supabase.from("workspaces").select("*").eq("id", data.workspaceId).maybeSingle(),
      supabase
        .from("conversations")
        .select("id, title")
        .eq("id", data.conversationId)
        .eq("workspace_id", data.workspaceId)
        .eq("employee_id", data.employeeId)
        .maybeSingle(),
      supabase.from("brain_items").select("title, body, kind").eq("workspace_id", data.workspaceId),
      supabase
        .from("brand_memories")
        .select("content, kind")
        .eq("workspace_id", data.workspaceId)
        .is("superseded_by", null)
        .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
        .order("updated_at", { ascending: false })
        .limit(80),
      supabase
        .from("messages")
        .select("role, body")
        .eq("workspace_id", data.workspaceId)
        .eq("employee_id", data.employeeId)
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("pipedream_accounts")
        .select("provider")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "connected"),
      supabase
        .from("integrations")
        .select("provider")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "connected"),
      // ما أنجزه الزملاء مؤخراً — حتى يعرف كل موظف ما يجري في الفريق.
      supabase
        .from("tasks")
        .select("employee_id, title, status, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    // حالة الربط الحقيقية تُحقن في التعليمات حتى لا يدّعي الموظف نشراً مستحيلاً.
    const connected = [
      ...new Set([
        ...(linked ?? []).map((a) => a.provider),
        ...(direct ?? []).map((i) => i.provider),
      ]),
    ];

    if (!workspace) throw new Error("مساحة العمل غير موجودة.");
    if (!conversation) throw new Error("المحادثة غير موجودة.");
    const ws = workspace as typeof workspace & {
      profile?: unknown;
      website?: string | null;
      country?: string | null;
    };

    // وسائط المستخدم تُحفظ داخل نص رسالته لتظهر في المحادثة وتبقى في السجل.
    const attachments = data.attachments ?? [];
    const attachmentsMarkdown = attachments
      .map((a) =>
        a.type === "video"
          ? `\n\n🎬 [${a.alt ?? "فيديو مرفق"}](${a.url})`
          : `\n\n![${a.alt ?? "صورة مرفقة"}](${a.url})`,
      )
      .join("");

    const { data: userRow, error: insertUserError } = await supabase
      .from("messages")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        role: "user",
        body: `${data.message}${attachmentsMarkdown}`,
        conversation_id: data.conversationId,
      })
      .select("id")
      .single();

    if (insertUserError) throw new Error(insertUserError.message);

    const { durableMemoryItems, extractExplicitMemories, memoryBlock } =
      await import("./memory.server");
    const brainText = memoryBlock(
      [...(brain ?? []), ...durableMemoryItems(durable ?? [])],
      data.message,
      10,
    );
    const extracted = extractExplicitMemories(data.message);
    if (extracted.length) {
      await supabase.from("brand_memories").insert(
        extracted.map((item) => ({
          workspace_id: data.workspaceId,
          conversation_id: data.conversationId,
          employee_id: data.employeeId,
          source_message_id: userRow?.id ?? null,
          kind: item.kind,
          content: item.content,
          confidence: 1,
        })),
      );
    }
    if (conversation.title === "محادثة جديدة") {
      await supabase
        .from("conversations")
        .update({ title: data.message.replace(/\s+/g, " ").slice(0, 55) })
        .eq("id", data.conversationId);
    } else {
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.conversationId);
    }

    const longForm =
      /مقال|خطة\s*(سيو|محتوى|تسويق)|\d{3,4}\s*كلمة|صفحة هبوط|دليل شامل|حملة كاملة/.test(
        data.message,
      ) || data.message.length > 220;

    const research = await researchFor(
      data.employeeId,
      apiKey,
      { name: workspace.name, industry: workspace.industry },
      data.message,
      data.workspaceId,
      // الطلبات الكبيرة تستحق أدلة أكمل (مقاييس + نتائج بحث + موجز منافسين).
      longForm ? 22_000 : 12_000,
    );

    // المنصة التي سمّاها المستخدم بنفسه — تُحترم حرفياً ولا تُبدَّل بغيرها.
    const { requestedPublishTargets, providerLabel } = await import("./platforms");
    const askedTargets = requestedPublishTargets(data.message);
    const askedBlock = askedTargets.length
      ? `## المنصة التي طلبها المستخدم صراحةً\nالمستخدم طلب: ${askedTargets.map((p) => `${providerLabel(p)} (${p})`).join("، ")}. ` +
        `اجعل "channel" في المخرج هو "${askedTargets[0]}" حرفياً، وكيّف النص لقواعد هذه المنصة (الطول، النبرة، الهاشتاقات). ` +
        `لا تقترح منصة أخرى بدلاً منها. ` +
        (askedTargets.some((p) => !connected.includes(p))
          ? `تنبيه: ${askedTargets
              .filter((p) => !connected.includes(p))
              .map(providerLabel)
              .join(
                " و",
              )} غير مربوط بعد — أنجز المخرج كاملاً، وضع في needs_connection المنصة "${askedTargets.find((p) => !connected.includes(p))}" بسبب قصير.`
          : `هذه المنصة مربوطة — أنجز المخرج جاهزاً للنشر عليها مباشرة.`)
      : "";

    // تنفيذ فعلي لقدرات الأقسام من داخل الشات (فحص سيو، ترتيب، تقويم، أفكار، أداء).
    let toolBlocks: { block: string; footer: string; tool: string }[] = [];
    try {
      const { runChatTools } = await import("./chat-tools.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      toolBlocks = await runChatTools(supabaseAdmin, {
        workspaceId: data.workspaceId,
        employeeId: data.employeeId,
        message: data.message,
        website: ws.website,
        country: ws.country,
        connected,
        targets: askedTargets,
      });
    } catch (e) {
      console.warn("[chat-tools] skipped:", e instanceof Error ? e.message : e);
    }
    const toolsBlock = toolBlocks.length
      ? `## نتائج نفّذتها فعلاً الآن من أقسام المنصة (حقيقية — استخدمها حرفياً)\n${toolBlocks.map((t) => t.block).join("\n\n")}`
      : "";

    const teamActivity = (recentTasks ?? [])
      .map((t) => {
        const who = employeeDirectory[t.employee_id as EmployeeId]?.name ?? t.employee_id;
        return `- ${who}: ${t.title} (${t.status === "done" ? "منشور/منجز" : t.status === "review" ? "بانتظار الاعتماد" : t.status})`;
      })
      .join("\n");

    const today = new Date();
    const todayAr = today.toLocaleDateString("ar-EG", {
      timeZone: "Africa/Cairo",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const system = [
      `أنت ${persona.name}، ${persona.role}`,
      `تعمل داخل منصة «سهل» لصالح العلامة: ${workspace.name} (${workspace.industry}).`,
      `نبرة العلامة: ${workspace.tone}.`,
      `تاريخ اليوم: ${todayAr} (${today.toISOString().slice(0, 10)}).`,
      workspace.banned_words?.length
        ? `كلمات ممنوعة تماماً: ${workspace.banned_words.join("، ")}.`
        : "",
      craft[data.employeeId] ? `## معايير حِرفتك\n${craft[data.employeeId]}` : "",
      qualityCriteria[data.employeeId]?.length
        ? `## معايير قبول الرد\n${(qualityCriteria[data.employeeId] ?? []).map((criterion, index) => `${index + 1}) ${criterion}`).join("\n")}`
        : "",
      ...sharedSystemBlocks({
        employeeId: data.employeeId,
        connected,
        profile: ws.profile,
        website: ws.website,
        country: ws.country,
      }),
      brainText ? `## عقل العلامة (ذاكرة مشتركة بين الفريق)\n${brainText}` : "",
      teamActivity ? `## آخر ما أنجزه الفريق\n${teamActivity}` : "",
      research.block ? `${evidenceRules}\n\n## أدلة ميدانية (لحظية)\n${research.block}` : "",
      actionTruthRules,
      askedBlock,
      toolsBlock,
      "## أسلوب المحادثة",
      "فكّر داخلياً بالترتيب: افهم الهدف، تحقق من الأدلة، اختر الإجراء، ثم سلّم النتيجة. لا تعرض خطوات تفكيرك.",
      "راجع الإجابة قبل تسليمها: الدقة، الاكتمال، ملاءمة السوق العربي، صدق ما تم تنفيذه، وخطوة تالية واحدة.",
      "أجب دائماً بالعربية. التحية والأسئلة القصيرة: رد قصير ودافئ بجملة أو اثنتين ثم اقتراح عملي واحد. طلبات العمل: مخرج كامل جاهز مباشرة.",
      "إن كان طلب المستخدم يحتاج صورة (تصميم، منشور بصري، صورة مقال، كرييتف) فاكتب وصفاً بصرياً إنجليزياً دقيقاً في الحقل image_prompt — وستُولَّد الصورة فعلياً وتُعرض للمستخدم؛ لا تكتفِ بوصفها في النص.",
      'أعد ردك بصيغة JSON فقط بالشكل: {"reply": "نص ردك للمستخدم بصيغة Markdown", "deliverable": {"title": "عنوان المخرج", "kind": "نوع المخرج", "channel": "المنصة", "body": "نص المخرج الجاهز", "scheduled": "متى يُنفّذ", "image_prompt": "English visual prompt or null"} , "needs_connection": {"provider": "معرّف المنصة مثل instagram أو wordpress أو search-console", "reason": "سبب من 8 كلمات مرتبط بهذه المهمة"} }',
      'ممنوع تماماً ابتكار بنية JSON أخرى. إن طلب المستخدم عدة مخرجات (خطة أسبوع، عدة منشورات، عدة منصات) فاستخدم مصفوفة "deliverables": [ {نفس حقول deliverable}, … ] بدل deliverable، واجعل "reply" ملخصاً بالعربية للخطة (المحاور، التوزيع، مؤشرات القياس) — ولا تضع JSON داخل reply أو داخل body إطلاقاً.',
      'قاعدة إلزامية للخطط: عنصر واحد في deliverables لكل منشور فعلي (يوم × منصة). خطة 3 أيام على 3 منصات = 9 عناصر، لكل عنصر channel صحيح (instagram / linkedin / x) وtitle يذكر اليوم والمنصة وbody يحتوي نص ذلك المنشور وحده مع هاشتاجاته وscheduled بأفضل وقت نشر. ممنوع وضع ملخص الخطة داخل body أو الاكتفاء بمخرج واحد.',
      'حقل body يجب أن يكون نص المنشور/المقال الجاهز للنشر كما يقرأه الجمهور فقط — بلا مفاتيح ولا أقواس ولا وصف الصورة. ووصف الصورة الإنجليزي يوضع في image_prompt وحده ولا يظهر للمستخدم.',
      'إن لم يطلب المستخدم مخرجاً جاهزاً للنشر أو الإرسال، اجعل "deliverable" القيمة null. واجعل "needs_connection" القيمة null إلا إذا كانت هذه المهمة تحديداً تحتاج حساباً غير مربوط لتنفيذها فعلياً (نشر/إرسال/قراءة بيانات حقيقية).',
      `المنصة الافتراضية لك هي ${persona.channel} ونوع مخرجك الشائع ${persona.kind}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const priorMessages = (history ?? [])
      .slice()
      .reverse()
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.body }));

    // نُعلم الموظف بوسائط المستخدم وبقراره حول الصورة حتى يبني عليها بدل تجاهلها.
    const mediaNote = [
      attachments.length
        ? `(المستخدم أرفق ${attachments.filter((a) => a.type === "image").length} صورة و${attachments.filter((a) => a.type === "video").length} فيديو مع الطلب — اعتمدها كوسائط المنشور ولا تطلب غيرها.)`
        : "",
      data.imageMode === "off" ? "(المستخدم أوقف توليد الصور — لا تكتب image_prompt.)" : "",
      data.imageMode === "manual" && data.imagePrompt
        ? `(المستخدم كتب وصف الصورة بنفسه: ${data.imagePrompt.slice(0, 300)} — لا تغيّره.)`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const userTurn = mediaNote ? `${data.message}\n\n${mediaNote}` : data.message;

    // خطة ضخمة (عدة أيام × عدة منصات): تُولَّد على دفعات — نداء واحد ضخم يتجاوز مهلة المزوّد.
    let campaign: { reply: string; deliverables: Record<string, unknown>[] } | null = null;
    if (askedTargets.length >= 2) {
      try {
        const { isCampaignRequest, generateCampaign } = await import("./campaign-plan.server");
        if (isCampaignRequest(data.message, askedTargets)) {
          campaign = await generateCampaign(apiKey, system, data.message, askedTargets);
        }
      } catch (error) {
        console.warn("[campaign] failed:", error instanceof Error ? error.message : error);
      }
    }

    // مقال طويل: يُكتب على مراحل — نص المقال داخل JSON واحد يُقتطع فيضيع المقال كله.
    if (!campaign && longForm) {
      try {
        const { isLongArticleRequest, generateLongArticle } = await import("./longform.server");
        if (isLongArticleRequest(data.message)) {
          const article = await generateLongArticle(apiKey, system, data.message);
          if (article) {
            campaign = {
              reply: `جهّزت لك المقال كاملاً: **${article.title}** — نصه الكامل بالأسفل، ومعه الميتا والأسئلة الشائعة وسكيما FAQ جاهزة.`,
              deliverables: [
                { title: article.title, kind: "مقال", channel: "wordpress", body: article.body },
              ],
            };
          }
        }
      } catch (error) {
        console.warn("[longform] failed:", error instanceof Error ? error.message : error);
      }
    }

    let raw = campaign

      ? JSON.stringify({ reply: campaign.reply, deliverables: campaign.deliverables })
      : await freeChat(
          apiKey,
          [
            { role: "system", content: system },
            ...priorMessages,
            { role: "user", content: userTurn },
          ],

          // طلبات المقالات/الخطط الكاملة تحتاج مخرجاً طويلاً ومهلة أطول — مع سقف زمني إجمالي حتى لا يعلّق الشات.
          longForm
            ? { json: true, timeoutMs: 75_000, maxTokens: 6000, budgetMs: 130_000 }
            : { json: true, timeoutMs: 40_000, maxTokens: 1800, budgetMs: 100_000 },
        );


    let reply = raw;
    let deliverables: Deliverable[] = [];
    let needsConnection: NeedsConnection = null;

    // محاولة إصلاح واحدة فقط للمخرجات الطويلة التي لم تُرجع JSON صالحاً أو مخرجاً كاملاً.
    if (longForm && (!raw.trim().startsWith("{") || !/"reply"\s*:/.test(raw))) {
      try {
        raw = await freeChat(
          apiKey,
          [
            { role: "system", content: system },
            { role: "user", content: data.message },
            { role: "assistant", content: raw },
            {
              role: "user",
              content:
                "راجع المسودة مرة واحدة وفق معايير القبول، وأصلح النقص أو القطع فقط. أعد JSON صالحاً كاملاً بنفس البنية المطلوبة دون شرح خارجي.",
            },
          ],
          { json: true, timeoutMs: 40_000, maxTokens: 6000, budgetMs: 55_000 },
        );
      } catch (error) {
        console.warn("[chat] repair pass skipped:", error instanceof Error ? error.message : error);
      }
    }

    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed: unknown = JSON.parse(cleaned);
      // النموذج قد يعيد كائناً واحداً أو مصفوفة كائنات — نتعامل مع الحالتين.
      const items = (Array.isArray(parsed) ? parsed : [parsed]).filter(
        (
          x,
        ): x is {
          reply?: string;
          deliverable?: Deliverable | null;
          deliverables?: Deliverable[] | null;
          needs_connection?: NeedsConnection;
        } => Boolean(x) && typeof x === "object",
      );
      const replies = items
        .map((x) => (typeof x.reply === "string" ? x.reply.trim() : ""))
        .filter(Boolean);
      deliverables = items
        .flatMap((x) => [x.deliverable, ...(Array.isArray(x.deliverables) ? x.deliverables : [])])
        .filter((d): d is Deliverable => Boolean(d?.title && d.body))
        // لا نفرض المنصة إلا على مخرج بلا منصة، حتى لا تُدمج خطة متعددة المنصات في منصة واحدة.
        .map((d) => (d.channel ? d : askedTargets[0] ? { ...d, channel: askedTargets[0] } : d));
      // النموذج قد يعيد بنية خاصة به (خطة أسبوع، عدة منشورات) — نلتقط المخرجات منها بدل عرض JSON خام.
      if (!deliverables.length) deliverables = harvestDeliverables(parsed).slice(0, 14);
      const nc = items
        .map((x) => x.needs_connection)
        .find((n) => n && typeof n === "object" && typeof n.provider === "string");
      // لا نعرض زر ربط لحساب مربوط فعلاً أو لمنصة لا تخص هذا الموظف.
      if (nc && !connected.includes(nc.provider)) {
        const allowed = employeeDirectory[data.employeeId as EmployeeId]?.integrations.some(
          (i) => i.provider === nc.provider,
        );
        if (allowed)
          needsConnection = {
            provider: nc.provider,
            reason: String(nc.reason ?? "").slice(0, 160),
          };
      }
      // إن طلب المستخدم منصة غير مربوطة ولم يذكرها النموذج، نطلب ربطها نحن.
      const askedMissing = askedTargets.find((p) => !connected.includes(p));
      if (!needsConnection && askedMissing && deliverables.length) {
        needsConnection = {
          provider: askedMissing,
          reason: `طلبت النشر على ${providerLabel(askedMissing)}`,
        };
      }
      if (replies.length) {
        reply = replies.join("\n\n");
        // مخرج واحد طويل مع ردّ قصير: نعرض المخرج نفسه في المحادثة بدل تركه في المهام فقط.
        const only = deliverables.length === 1 ? deliverables[0] : null;
        if (only?.body && only.body.length > 400 && reply.length < only.body.length * 0.5) {
          reply = `${reply.trim()}\n\n### ${only.title}\n\n${only.body}`;
        }
      } else if (deliverables.length) {
        reply = deliverables.map((d) => `### ${d.title}\n\n${d.body}`).join("\n\n---\n\n");
      } else {
        // بنية غير متوقعة تماماً: نعرضها كنص عربي مقروء بدل JSON خام.
        const markdown = jsonToMarkdown(parsed);
        if (markdown.trim().length > 20) reply = markdown;
      }
    } catch {
      deliverables = [];
      // JSON مقطوع (ردّ طويل): ننقذ نص reply بدل عرض JSON خام للمستخدم.
      const m = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
      if (m?.[1]) {
        try {
          reply = JSON.parse(`"${m[1]}"`);
        } catch {
          reply = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
        }
      }
    }

    // الصور تُولَّد فعلياً — لا يبقى المستخدم مع «برومبت» مكتوب فقط.
    // والمستخدم هو صاحب القرار: إيقاف · تلقائي · وصف يكتبه بنفسه (يُترجم حرفياً بلا إضافة).
    let imageUrl: string | null = null;
    const imageMode = data.imageMode ?? "auto";
    const userImagePrompt = data.imagePrompt?.trim() ?? "";
    const wantsImage =
      imageMode === "manual"
        ? userImagePrompt.length > 2
        : imageMode !== "off" &&
          VISUAL_EMPLOYEES.has(data.employeeId) &&
          attachments.every((a) => a.type !== "image");
    if (wantsImage) {
      try {
        const { ownedHeroImage, extractImagePrompt, imageBrief, literalBrief, aspectSize } =
          await import("./image-gen.server");
        const fromField = deliverables
          .map((d) => d.image_prompt)
          .find((p) => typeof p === "string" && p.trim().length > 30);
        const draft =
          (fromField ? fromField.trim() : null) ??
          extractImagePrompt(`${reply}\n${deliverables.map((d) => d.body ?? "").join("\n")}`);
        const wantsVisual =
          imageMode === "manual" ||
          Boolean(draft) ||
          deliverables.some((d) => d.body && d.body.length > 80);
        if (wantsVisual) {
          // وصف المستخدم يُحترم حرفياً؛ وإلا يُشتق الوصف من طلبه ومن المخرج نفسه.
          const prompt =
            imageMode === "manual"
              ? await literalBrief(userImagePrompt)
              : await imageBrief({
                  request: data.message,
                  title: deliverables[0]?.title ?? null,
                  body: deliverables[0]?.body ?? reply,
                  brand: {
                    name: workspace?.name,
                    industry: workspace?.industry,
                    country: workspace?.country ?? null,
                  },
                  draft,
                });
          imageUrl = await ownedHeroImage(
            supabase as unknown as Parameters<typeof ownedHeroImage>[0],
            data.workspaceId,
            prompt,
            aspectSize(data.imageAspect ?? "landscape"),
          );
        }
      } catch (error) {
        console.error("[chat] image generation failed:", error);
      }
    }


    // مخرج واحد جاهز للنشر: نص المنشور نفسه هو أهم ما يراه المستخدم — نضعه في صدر الرد
    // ونضع تعليق الموظف بعده خلف فاصل، حتى تلتقطه لوحة النشر نظيفاً بلا كلام موظف.
    if (deliverables.length === 1) {
      const postBody = (deliverables[0]?.body ?? "").trim();
      const head = postBody.slice(0, 40);
      if (postBody.length > 60 && head && !reply.includes(head)) {
        const note = reply.trim();
        reply = note ? `${postBody}\n\n---\n\n**ملاحظة للمستخدم:** ${note}` : postBody;
      }
    }

    reply = sanitizeActionClaims(reply, connected);

    const footers = toolBlocks.map((t) => t.footer).filter(Boolean);
    if (footers.length) reply = `${reply.trim()}\n\n> ${footers.join(" · ")}`;

    if (imageUrl) {
      const alt = (deliverables[0]?.title ?? "الصورة المولّدة").slice(0, 120);
      reply = `${reply.trim()}\n\n![${alt}](${imageUrl})`;
    }

    if (research.used.length) {
      reply = `${reply.trim()}\n\n— استندتُ إلى بيانات حقيقية: ${research.used.join(" · ")}`;
    }

    // عدة مخرجات: كل مخرج مستقل — نوجّه المستخدم إليها بدل محرّر واحد.
    if (deliverables.length > 1) {
      const allPosts = deliverables.every((d) => Boolean(d.channel));
      reply = allPosts
        ? `${reply.trim()}\n\n📋 جهّزت **${deliverables.length} منشورات** منفصلة، كل منشور بنصه ومنصته وموعده — راجعها واعتمدها من [المخرجات والمهام](/app/tasks).`
        : `${reply.trim()}\n\n📋 جهّزت **${deliverables.length} مخرجات** جاهزة، كل واحد بنصه الكامل — راجعها واعتمدها من [المخرجات والمهام](/app/tasks).`;
    }

    // صور من موقع المستخدم نفسه: نقترح الأنسب لطلبه ليستخدمها بدل صورة مولّدة.
    let siteSuggestions: { url: string; alt: string; pageUrl: string }[] = [];
    try {
      const { data: stored } = await supabase
        .from("site_assets")
        .select("url, alt, page_url, weight")
        .eq("workspace_id", data.workspaceId)
        .order("weight", { ascending: false })
        .limit(120);

      let pool = (stored ?? []).map((a) => ({
        url: a.url,
        alt: a.alt ?? "",
        pageUrl: a.page_url ?? "",
        weight: a.weight ?? 0,
      }));

      // أول مرة: نلتقط صور الموقع الآن ثم نحفظها للمرات القادمة.
      if (!pool.length && workspace?.website) {
        const { harvestSiteImages } = await import("./brand-assets.server");
        const found = await harvestSiteImages(workspace.website, 4);
        if (found.length) {
          await supabase.from("site_assets").upsert(
            found.map((a) => ({
              workspace_id: data.workspaceId,
              url: a.url,
              page_url: a.pageUrl,
              alt: a.alt || null,
              weight: a.weight,
              source: "website",
              kind: "image",
            })),
            { onConflict: "workspace_id,url" },
          );
          pool = found.map((a) => ({ url: a.url, alt: a.alt, pageUrl: a.pageUrl, weight: a.weight }));
        }
      }

      if (pool.length) {
        const { rankAssets } = await import("./brand-assets.server");
        const query = `${data.message}\n${deliverables.map((d) => `${d.title ?? ""} ${d.body ?? ""}`).join("\n")}`;
        siteSuggestions = rankAssets(query, pool, 3).map((a) => ({
          url: a.url,
          alt: a.alt,
          pageUrl: a.pageUrl,
        }));
      }
    } catch (e) {
      console.error("[site-assets] suggestion failed:", e);
    }

    if (siteSuggestions.length) {
      const gallery = siteSuggestions
        .map((s, i) => {
          const label = s.alt?.trim() || `صورة من موقعك ${i + 1}`;
          const page = s.pageUrl ? ` — [مصدرها](${s.pageUrl})` : "";
          return `![${label}](${s.url})\n*${label}*${page}`;
        })
        .join("\n\n");
      reply = `${reply.trim()}\n\n### 📸 صور من موقعك تصلح لهذا المحتوى\n\n${gallery}\n\nاختر أي صورة منها بدل الصورة المولّدة — كلها صور حقيقية من موقعك.`;
    }


    const { data: assistantRow, error: assistantError } = await supabase
      .from("messages")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        role: "assistant",
        body: reply,
        conversation_id: data.conversationId,
      })
      .select()
      .single();
    if (assistantError) throw new Error(assistantError.message);

    let createdTaskId: string | null = null;
    for (const deliverable of deliverables) {
      // صورة المخرج: المولّدة، وإلا صورة أرفقها المستخدم، وإلا صورة حقيقية من موقعه.
      const mediaUrl =
        imageUrl ??
        attachments.find((a) => a.type === "image")?.url ??
        siteSuggestions[0]?.url ??
        null;
      const output = mediaUrl
        ? `![${deliverable.title}](${mediaUrl})\n\n${deliverable.body!}`
        : deliverable.body!;

      const { data: task } = await supabase
        .from("tasks")
        .insert({
          workspace_id: data.workspaceId,
          employee_id: data.employeeId,
          title: deliverable.title!,
          detail: reply.slice(0, 400),
          kind: deliverable.kind ?? persona.kind,
          channel: deliverable.channel ?? persona.channel,
          status: "review",
          output,
          scheduled: deliverable.scheduled ?? "بانتظار اعتمادك",
          steps: [
            { label: "فهم الطلب", state: "done" },
            { label: "التنفيذ", state: "done" },
            { label: "مراجعتك", state: "active" },
            { label: "النشر", state: "todo" },
          ],
        })
        .select("id")
        .single();
      createdTaskId = createdTaskId ?? task?.id ?? null;
    }

    return {
      reply,
      messageId: assistantRow.id,
      createdTaskId,
      needsConnection,
      imageUrl,
      siteSuggestions,
    };
  });

const skillInput = z.object({
  workspaceId: z.string().uuid(),
  employeeId: z.string().min(1),
  skillId: z.string().min(1),
  values: z.record(z.string(), z.string()),
  conversationId: z.string().uuid(),
});

/** تشغيل قدرة محددة: يخرج مخرجاً جاهزاً ويحفظه كمهمة بانتظار الاعتماد. */
export const runSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => skillInput.parse(data))
  .handler(async ({ data, context }) => {
    const run = await executeSkill(context.supabase, {
      workspaceId: data.workspaceId,
      employeeId: data.employeeId,
      skillId: data.skillId,
      values: data.values,
      conversationId: data.conversationId,
    });
    return { output: run.output, messageId: run.messageId, taskId: run.taskId };
  });
