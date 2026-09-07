/**
 * «أدوات الشات»: عندما يطلب المستخدم في المحادثة شيئاً موجوداً في أقسام المنصة
 * (فحص سيو لصفحة، ترتيب كلمة على جوجل، تقويم محتوى، أفكار اليوم، التعلّم من الأداء)
 * ينفّذه الموظف فعلاً من الشات ويُدرج النتيجة الحقيقية في رده — لا وصفاً لما «يمكن» فعله.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type ChatToolResult = {
  /** كتلة تُحقن في system prompt كأدلة حقيقية. */
  block: string;
  /** سطر يُلحق بالرد يوجّه المستخدم إلى القسم. */
  footer: string;
  /** اسم الأداة (للسجل). */
  tool: string;
};

const URL_RE = /https?:\/\/[^\s)»"']+|(?:^|\s)((?:[a-z0-9-]+\.)+(?:com|net|org|sa|ae|eg|kw|qa|om|bh|jo|ma|dz|tn|ly|iq|ye|sd|lb|ps|sy|ps|co|io|me|shop|store))(?:\/\S*)?/i;

function urlIn(text: string, fallback?: string | null): string | null {
  const m = URL_RE.exec(text);
  if (m) {
    const raw = (m[0] ?? m[1] ?? "").trim();
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  return fallback ?? null;
}

function hostOf(u: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** يستخرج الكلمة المفتاحية من صيغ مثل: ترتيب «كذا» / ترتيبي على كلمة كذا / rank for "x". */
function keywordIn(text: string): string | null {
  const quoted = /[«"“']([^»"”']{2,60})[»"”']/.exec(text);
  if (quoted?.[1]) return quoted[1].trim();
  const m = /(?:كلمة|كلمه|لكلمة|keyword|rank for)\s*[:：]?\s*(.{2,60}?)(?:\s+(?:في|على|علي|ب|بجوجل|on)\b|[؟?.!\n]|$)/i.exec(text);
  return m?.[1]?.trim() ?? null;
}

function daysIn(text: string): number {
  if (/شهر|30\s*يوم|٣٠/.test(text)) return 30;
  if (/أسبوعين|اسبوعين|14\s*يوم|١٤/.test(text)) return 14;
  return 7;
}

export async function runChatTools(
  admin: Admin,
  params: {
    workspaceId: string;
    employeeId: string;
    message: string;
    website?: string | null;
    country?: string | null;
    connected: string[];
    /** المنصات التي طلبها المستخدم صراحةً. */
    targets: string[];
  },
): Promise<ChatToolResult[]> {
  const text = params.message;
  const out: ChatToolResult[] = [];
  const t0 = Date.now();
  const budget = 25_000;
  const left = () => budget - (Date.now() - t0);

  // ---------- نور (SEO) ----------
  if (params.employeeId === "nour") {
    const wantsAudit = /فحص|افحص|تدقيق|audit|مشاكل (السيو|الصفحة)|سرعة الموقع|تحليل (الموقع|الصفحة|صفحة)/i.test(text);
    const url = urlIn(text, params.website);
    if (wantsAudit && url && left() > 8000) {
      try {
        const { auditPage } = await import("./seo-audit.server");
        const a = await auditPage(url);
        const fails = a.checks.filter((c) => c.status !== "pass").slice(0, 10);
        out.push({
          tool: "seo-audit",
          block: [
            `### نتيجة فحص سيو حقيقي للصفحة ${a.finalUrl} (نُفّذ الآن)`,
            `الدرجة: ${a.score}/100 · زمن الاستجابة: ${a.fetchedMs}ms · العنوان: «${a.page.title || "—"}» (${a.page.title.length} حرف) · الوصف: ${a.page.description ? `${a.page.description.length} حرف` : "مفقود"} · H1: ${a.page.h1.length} · الكلمات: ${a.page.wordCount} · صور بلا alt: ${a.page.imagesMissingAlt}/${a.page.images} · اللغة: ${a.page.lang || "—"}`,
            ...fails.map((c) => `- [${c.status === "fail" ? "خطأ" : "تحذير"}] ${c.label}: ${c.detail}${c.fix ? ` → الحل: ${c.fix}` : ""}`),
            "اعرض هذه النتائج للمستخدم كما هي (أرقام حقيقية) مرتبة حسب الأثر، مع خطوات إصلاح عملية.",
          ].join("\n"),
          footer: "التقرير الكامل بالـ16 فحصاً في قسم «التقارير».",
        });
      } catch (e) {
        out.push({ tool: "seo-audit", block: `تعذّر فحص ${url}: ${e instanceof Error ? e.message : "خطأ"} — أخبر المستخدم بصراحة.`, footer: "" });
      }
    }

    const wantsRank = /ترتيب|رانك|rank|موقعي في جوجل|الصفحة الأولى|أي صفحة/i.test(text);
    const kw = keywordIn(text);
    const domain = hostOf(urlIn(text, params.website));
    if (wantsRank && kw && domain && left() > 8000) {
      try {
        const { checkRank } = await import("./rank-check.server");
        const r = await checkRank({
          workspaceId: params.workspaceId,
          keyword: kw,
          domain,
          market: (params.country ?? "EG").toUpperCase(),
          gscConnected: params.connected.includes("search-console"),
        });
        out.push({
          tool: "rank-check",
          block: [
            `### ترتيب حقيقي لكلمة «${kw}» للنطاق ${domain} (المصدر: ${r.source})`,
            r.position ? `الموقع يظهر في المركز ${r.position}${r.url ? ` عبر ${r.url}` : ""}.` : "الموقع لا يظهر في أول 100 نتيجة لهذه الكلمة.",
            r.clicks !== undefined ? `نقرات: ${r.clicks} · ظهور: ${r.impressions ?? 0} (Search Console)` : "",
            r.competitors.length ? `من يتصدّر: ${r.competitors.map((c) => `#${c.position} ${c.host}`).join("، ")}` : "",
            r.note ?? "",
            "لا تخترع أرقاماً أخرى؛ ابنِ التوصيات على هذه النتيجة فقط.",
          ]
            .filter(Boolean)
            .join("\n"),
          footer: "تابع هذه الكلمة أسبوعياً من قسم «الترتيب».",
        });
      } catch (e) {
        out.push({ tool: "rank-check", block: `تعذّر فحص الترتيب: ${e instanceof Error ? e.message : "خطأ"}.`, footer: "" });
      }
    }
  }

  // ---------- سِراج (سوشيال) ----------
  if (params.employeeId === "sonny") {
    const wantsCalendar = /تقويم|خطة (محتوى|منشورات|أسبوع|شهر)|جدول (منشورات|محتوى)|كالندر|calendar|محتوى (أسبوع|شهر)/i.test(text);
    if (wantsCalendar && left() > 15_000) {
      const providers = params.targets.length
        ? params.targets
        : params.connected.filter((p) => ["instagram", "facebook", "linkedin", "x", "pinterest", "youtube"].includes(p));
      const prov = providers.length ? providers : ["instagram"];
      try {
        const { planCalendar } = await import("./content-calendar.server");
        const { data: ws } = await admin.from("workspaces").select("timezone").eq("id", params.workspaceId).maybeSingle();
        const days = daysIn(text);
        const r = await planCalendar(admin, {
          workspaceId: params.workspaceId,
          days,
          perDay: 1,
          providers: prov,
          topic: text.slice(0, 200),
          timezone: (ws as { timezone?: string } | null)?.timezone ?? "Africa/Cairo",
        });
        const { data: items } = await admin
          .from("social_posts")
          .select("scheduled_at, provider, meta")
          .eq("workspace_id", params.workspaceId)
          .contains("meta", { batch: r.batch })
          .order("scheduled_at", { ascending: true })
          .limit(45);
        out.push({
          tool: "calendar-plan",
          block: [
            `### أنشأتَ فعلاً تقويم محتوى لـ${days} يوماً (${r.created} فكرة) في قسم «التقويم» — هذه هي الأفكار:`,
            ...(items ?? []).map((p) => {
              const m = (p.meta ?? {}) as { title?: string; hook?: string; goal?: string };
              return `- ${new Date(p.scheduled_at).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" })} · ${p.provider}: ${m.title ?? ""} — ${m.hook ?? ""} (${m.goal ?? ""})`;
            }),
            "اعرضها للمستخدم كجدول، وأخبره أن كل فكرة جاهزة لتوليد النص والصورة والاعتماد والنشر من قسم التقويم بضغطة.",
          ].join("\n"),
          footer: "افتح «التقويم» لتوليد النصوص والصور واعتمادها ونشرها.",
        });
      } catch (e) {
        out.push({ tool: "calendar-plan", block: `تعذّر إنشاء التقويم: ${e instanceof Error ? e.message : "خطأ"}.`, footer: "" });
      }
    }

    const wantsIdeas = /أفكار (اليوم|النهاردة|منشورات)|فكرة (منشور|بوست)|اقترح (منشور|بوست|أفكار)|انشر إيه|أنشر ماذا/i.test(text);
    if (wantsIdeas && !wantsCalendar && left() > 12_000) {
      try {
        const { dailyIdeas } = await import("./content-calendar.server");
        const ideas = await dailyIdeas(admin, params.workspaceId);
        if (ideas.length) {
          out.push({
            tool: "daily-ideas",
            block: [
              "### أفكار اليوم (مولّدة الآن من ملف العلامة وأداء منشوراتها):",
              ...ideas.map((i, n) => `${n + 1}. [${i.provider}] ${i.title} — ${i.hook}`),
              "قدّمها للمستخدم واعرض كتابة أيٍّ منها كاملاً فوراً.",
            ].join("\n"),
            footer: "",
          });
        }
      } catch {
        /* لا شيء */
      }
    }

    const wantsLearning = /(إيه|ماذا|ايه|ما) (اللي|الذي) (نجح|اشتغل)|أداء (المنشورات|البوستات)|تعلم من|أفضل منشور|insights|الأكثر تفاعلاً/i.test(text);
    if (wantsLearning && left() > 10_000) {
      try {
        const { learnFromPerformance } = await import("./content-calendar.server");
        const r = await learnFromPerformance(admin, params.workspaceId);
        out.push({
          tool: "performance",
          block: [
            `### تحليل أداء حقيقي (${r.source === "live" ? "من إنستجرام/فيسبوك مباشرة" : r.source === "internal" ? "من سجل منشوراتنا" : "لا توجد بيانات كافية بعد"}) — ${r.analyzed} منشور:`,
            r.summary,
            r.source === "none" ? "أخبر المستخدم بصراحة أنه لا توجد بيانات أداء بعد، واقترح ربط إنستجرام/فيسبوك أو النشر لأسبوع أولاً." : "",
          ]
            .filter(Boolean)
            .join("\n"),
          footer: "",
        });
      } catch {
        /* لا شيء */
      }
    }
  }

  return out;
}
