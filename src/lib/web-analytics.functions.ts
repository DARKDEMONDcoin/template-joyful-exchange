import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * تحليلات زوار الموقع من مصادر مفتوحة المصدر ومجانية بالكامل:
 * Umami · Plausible (Community Edition) · GoatCounter.
 * كلها تُعطي أرقاماً حقيقية: عدد الزوار، الجلسات، الجنسيات، أهم الصفحات والمصادر.
 */
export type AnalyticsProvider = "umami" | "plausible" | "goatcounter";

export type VisitorsSnapshot = {
  provider: AnalyticsProvider;
  days: number;
  totals: { visitors: number; pageviews: number };
  countries: { code: string; label: string; visitors: number }[];
  pages: { path: string; views: number }[];
  sources: { source: string; visitors: number }[];
};

type StoredConfig = {
  provider?: AnalyticsProvider;
  host?: string;
  apiKey?: string;
  siteId?: string;
};

const PROVIDER = z.enum(["umami", "plausible", "goatcounter"]);

const COUNTRY_AR = new Intl.DisplayNames(["ar"], { type: "region" });
function countryLabel(code: string) {
  const c = (code || "").toUpperCase();
  if (c.length !== 2) return code || "غير معروف";
  try {
    return COUNTRY_AR.of(c) ?? c;
  } catch {
    return c;
  }
}

async function assertOwner(
  supabase: {
    rpc: (
      fn: "owns_workspace",
      args: { _workspace_id: string },
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  workspaceId: string,
) {
  const { data, error } = await supabase.rpc("owns_workspace", { _workspace_id: workspaceId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: لا تملك هذه مساحة العمل.");
}

async function loadConfig(workspaceId: string): Promise<StoredConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "web-analytics")
    .maybeSingle();
  return (data?.config as StoredConfig | undefined) ?? {};
}

const trimHost = (host: string) => host.replace(/\/+$/, "");

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`تعذّر جلب البيانات (${res.status}): ${text.slice(0, 160)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("رد غير متوقع من خدمة التحليلات.");
  }
}

/* ------------------------------- Umami ------------------------------- */
async function umamiSnapshot(cfg: Required<StoredConfig>, days: number): Promise<VisitorsSnapshot> {
  const host = trimHost(cfg.host || "https://api.umami.is");
  const cloud = host.includes("api.umami.is");
  const base = cloud ? `${host}/v1` : `${host}/api`;
  const headers: Record<string, string> = cloud
    ? { "x-umami-api-key": cfg.apiKey }
    : { authorization: `Bearer ${cfg.apiKey}` };
  const endAt = Date.now();
  const startAt = endAt - days * 86400000;
  const range = `startAt=${startAt}&endAt=${endAt}`;
  const site = encodeURIComponent(cfg.siteId);

  const stats = await getJson<{
    pageviews?: { value?: number };
    visitors?: { value?: number };
  }>(`${base}/websites/${site}/stats?${range}`, headers);

  const metric = (type: string) =>
    getJson<{ x: string | null; y: number }[]>(
      `${base}/websites/${site}/metrics?${range}&type=${type}&limit=8`,
      headers,
    ).catch(() => []);

  const [countries, pages, referrers] = await Promise.all([
    metric("country"),
    metric("url"),
    metric("referrer"),
  ]);

  return {
    provider: "umami",
    days,
    totals: {
      visitors: stats.visitors?.value ?? 0,
      pageviews: stats.pageviews?.value ?? 0,
    },
    countries: countries.map((c) => ({
      code: c.x ?? "",
      label: countryLabel(c.x ?? ""),
      visitors: c.y,
    })),
    pages: pages.map((p) => ({ path: p.x ?? "/", views: p.y })),
    sources: referrers.map((r) => ({ source: r.x || "زيارة مباشرة", visitors: r.y })),
  };
}

/* ------------------------------ Plausible ----------------------------- */
async function plausibleSnapshot(cfg: Required<StoredConfig>, days: number): Promise<VisitorsSnapshot> {
  const host = trimHost(cfg.host || "https://plausible.io");
  const headers = { authorization: `Bearer ${cfg.apiKey}` };
  const period = `period=custom&date=${new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)},${new Date().toISOString().slice(0, 10)}`;
  const site = `site_id=${encodeURIComponent(cfg.siteId)}`;

  const agg = await getJson<{ results?: { visitors?: { value: number }; pageviews?: { value: number } } }>(
    `${host}/api/v1/stats/aggregate?${site}&${period}&metrics=visitors,pageviews`,
    headers,
  );

  const breakdown = (property: string) =>
    getJson<{ results?: Record<string, string | number>[] }>(
      `${host}/api/v1/stats/breakdown?${site}&${period}&property=${property}&metrics=visitors&limit=8`,
      headers,
    )
      .then((r) => r.results ?? [])
      .catch(() => []);

  const [countries, pages, sources] = await Promise.all([
    breakdown("visit:country"),
    breakdown("event:page"),
    breakdown("visit:source"),
  ]);

  return {
    provider: "plausible",
    days,
    totals: {
      visitors: agg.results?.visitors?.value ?? 0,
      pageviews: agg.results?.pageviews?.value ?? 0,
    },
    countries: countries.map((c) => ({
      code: String(c["country"] ?? ""),
      label: countryLabel(String(c["country"] ?? "")),
      visitors: Number(c["visitors"] ?? 0),
    })),
    pages: pages.map((p) => ({ path: String(p["page"] ?? "/"), views: Number(p["visitors"] ?? 0) })),
    sources: sources.map((s) => ({
      source: String(s["source"] || "زيارة مباشرة"),
      visitors: Number(s["visitors"] ?? 0),
    })),
  };
}

/* ----------------------------- GoatCounter ---------------------------- */
async function goatcounterSnapshot(cfg: Required<StoredConfig>, days: number): Promise<VisitorsSnapshot> {
  const host = trimHost(cfg.host);
  const headers = { authorization: `Bearer ${cfg.apiKey}` };
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const range = `start=${start}&end=${end}`;

  const total = await getJson<{ total?: number; total_unique?: number }>(
    `${host}/api/v0/stats/total?${range}`,
    headers,
  );

  const list = (path: string) =>
    getJson<{ stats?: { id?: string; name?: string; count?: number; count_unique?: number }[] }>(
      `${host}/api/v0/${path}?${range}&limit=8`,
      headers,
    )
      .then((r) => r.stats ?? [])
      .catch(() => []);

  const [locations, hits, refs] = await Promise.all([
    list("stats/locations"),
    list("stats/hits"),
    list("stats/toprefs"),
  ]);

  return {
    provider: "goatcounter",
    days,
    totals: { visitors: total.total_unique ?? 0, pageviews: total.total ?? 0 },
    countries: locations.map((l) => ({
      code: l.id ?? "",
      label: l.name ?? countryLabel(l.id ?? ""),
      visitors: l.count_unique ?? l.count ?? 0,
    })),
    pages: hits.map((h) => ({ path: h.name ?? h.id ?? "/", views: h.count ?? 0 })),
    sources: refs.map((r) => ({ source: r.name || r.id || "زيارة مباشرة", visitors: r.count ?? 0 })),
  };
}

/** حفظ إعدادات مزوّد التحليلات المفتوح. */
export const saveWebAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        provider: PROVIDER,
        host: z.string().trim().max(300).default(""),
        apiKey: z.string().trim().min(4).max(500),
        siteId: z.string().trim().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const config: StoredConfig = {
      provider: data.provider,
      host: data.host,
      apiKey: data.apiKey,
      siteId: data.siteId,
    };
    const { error } = await supabaseAdmin
      .from("integration_credentials")
      .upsert(
        { workspace_id: data.workspaceId, provider: "web-analytics", config },
        { onConflict: "workspace_id,provider" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** فصل الربط. */
export const disconnectWebAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("integration_credentials")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "web-analytics");
    return { ok: true as const };
  });

/** لقطة الزوار الحقيقية — أرقام فقط بلا أي تقدير. */
export const visitorsSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), days: z.number().int().min(1).max(365).default(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const cfg = await loadConfig(data.workspaceId);
    if (!cfg.provider || !cfg.apiKey || !cfg.siteId) {
      return { connected: false as const, provider: cfg.provider ?? null, snapshot: null, error: null };
    }
    const full = {
      provider: cfg.provider,
      host: cfg.host ?? "",
      apiKey: cfg.apiKey,
      siteId: cfg.siteId,
    } as Required<StoredConfig>;
    try {
      const snapshot =
        cfg.provider === "umami"
          ? await umamiSnapshot(full, data.days)
          : cfg.provider === "plausible"
            ? await plausibleSnapshot(full, data.days)
            : await goatcounterSnapshot(full, data.days);
      return { connected: true as const, provider: cfg.provider, snapshot, error: null };
    } catch (e) {
      return {
        connected: true as const,
        provider: cfg.provider,
        snapshot: null,
        error: e instanceof Error ? e.message : "تعذّر جلب بيانات الزوار",
      };
    }
  });

/** حالة الربط فقط (لعرضها بسرعة دون طلب خارجي). */
export const webAnalyticsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const cfg = await loadConfig(data.workspaceId);
    return {
      connected: Boolean(cfg.provider && cfg.apiKey && cfg.siteId),
      provider: cfg.provider ?? null,
      host: cfg.host ?? "",
      siteId: cfg.siteId ?? "",
    };
  });
