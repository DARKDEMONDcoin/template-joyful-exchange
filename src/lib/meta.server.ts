/**
 * النشر المباشر على منصات ميتا (صفحات فيسبوك + إنستجرام بزنس) بتطبيق ميتا الخاص بنا.
 *
 * لماذا مسار مباشر بجانب Pipedream؟ تطبيق ميتا المشترك لدى الوسيط لا يمنح صلاحيات
 * النشر (pages_manage_posts…)، فيبقى الربط «قراءة فقط». هنا نستخدم App ID/Secret
 * الخاصين بنا، نطلب أذونات النشر كاملة، نبدّل التوكن القصير بتوكن طويل المدى،
 * ونحفظ توكن الصفحة ومعرّف حساب إنستجرام في جدول meta_connections (خادم فقط).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export const GRAPH = "https://graph.facebook.com/v23.0";

/** الأذونات المطلوبة أثناء ربط المستخدم لحسابه. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const;

export type MetaConfig = { appId: string; appSecret: string };

export type MetaConnection = {
  id: string;
  kind: "facebook" | "instagram";
  pageId: string;
  pageName: string | null;
  pageToken: string;
  igUserId: string | null;
  igUsername: string | null;
  scopes: string[];
  status: string;
  expiresAt: string | null;
};

/** مفاتيح تطبيق ميتا من طبقة الأسرار الموحّدة (app_secrets ثم البيئة). */
export async function metaConfig(): Promise<MetaConfig | null> {
  const { getSecrets } = await import("./secrets.server");
  const found = await getSecrets(["META_APP_ID", "META_APP_SECRET"] as const);
  const appId = found.META_APP_ID?.trim();
  const appSecret = found.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function metaMissingConfigError(): Error {
  return new Error(
    "لم تُضبط مفاتيح تطبيق ميتا بعد. أضف META_APP_ID و META_APP_SECRET في الإعدادات ← المفاتيح.",
  );
}

/* ------------------------------- حالة موقّعة ------------------------------- */

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

/** حالة OAuth موقّعة: تحمل مساحة العمل ووقت الإصدار بلا حاجة لجدول مؤقت. */
export async function signState(
  config: MetaConfig,
  workspaceId: string,
  returnTo: string,
): Promise<string> {
  const payload = b64url(
    new TextEncoder().encode(JSON.stringify({ w: workspaceId, t: Date.now(), r: returnTo })),
  );
  return `${payload}.${await hmac(config.appSecret, payload)}`;
}

export async function verifyState(
  config: MetaConfig,
  state: string,
): Promise<{ workspaceId: string; returnTo: string } | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(config.appSecret, payload)) !== sig) return null;
  try {
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0),
        ),
      ),
    ) as { w?: string; t?: number; r?: string };
    if (!json.w || !json.t) return null;
    if (Date.now() - json.t > 30 * 60 * 1000) return null; // صالحة نصف ساعة
    return { workspaceId: json.w, returnTo: typeof json.r === "string" ? json.r : "/app/integrations" };
  } catch {
    return null;
  }
}

/* --------------------------------- OAuth --------------------------------- */

/**
 * أصل ثابت لرابط العودة — لأن نطاق المعاينة يتغيّر (lovableproject.com / id-preview)
 * بينما لوحة ميتا تقبل روابط مسجّلة فقط. نستخدم النطاق الثابت للمشروع دائماً.
 */
export const META_CANONICAL_ORIGIN =
  "https://id-preview--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app";

export function metaRedirectUri(_origin?: string): string {
  const override = process.env["META_REDIRECT_ORIGIN"];
  return `${new URL(override || META_CANONICAL_ORIGIN).origin}/api/public/meta/callback`;
}


export function metaAuthorizeUrl(config: MetaConfig, redirectUri: string, state: string): string {
  const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));
  return url.toString();
}

async function graph<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number; error_subcode?: number } })
      .error;
    throw new Error(explainMetaError(err) ?? `ميتا رفضت الطلب [${res.status}]: ${text.slice(0, 200)}`);
  }
  return json as T;
}

/** ترجمة أخطاء Graph إلى سبب وحل بالعربية. */
export function explainMetaError(
  err?: { message?: string; code?: number; error_subcode?: number } | null,
): string | null {
  if (!err) return null;
  const message = err.message ?? "";
  const code = err.code;
  if (code === 190) return "انتهت صلاحية الربط مع ميتا — أعد ربط الحساب من صفحة التكاملات.";
  if (code === 200 || code === 283 || /pages_manage_posts|permission/i.test(message))
    return (
      "ميتا رفضت النشر لنقص الأذونات (pages_manage_posts / pages_read_engagement). " +
      "أعد الربط ووافق على كل الأذونات، وتأكد أنك مسؤول (Admin) على الصفحة."
    );
  if (code === 10) return "التطبيق لا يملك الإذن لهذا الإجراء على هذه الصفحة — تأكد أنك مسؤول عنها.";
  if (code === 368) return "ميتا حظرت النشر مؤقتاً على هذه الصفحة — حاول لاحقاً.";
  if (code === 4 || code === 17 || code === 32 || code === 9)
    return "تجاوزت حد الطلبات لدى ميتا — انتظر قليلاً ثم أعد المحاولة.";
  if (code === 100 && /image|media|url/i.test(message))
    return "ميتا رفضت الوسائط — تأكد أن الرابط عام ومباشر (JPG/PNG أو MP4).";
  return message ? `ميتا: ${message}` : null;
}

/** تبديل رمز OAuth بتوكن مستخدم قصير المدى. */
export async function exchangeCode(
  config: MetaConfig,
  code: string,
  redirectUri: string,
): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await graph<{ access_token: string }>(url.toString());
  return res.access_token;
}

/** تبديل التوكن القصير بتوكن طويل المدى (~60 يوماً). */
export async function longLivedToken(
  config: MetaConfig,
  shortToken: string,
): Promise<{ token: string; expiresAt: string | null }> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await graph<{ access_token: string; expires_in?: number }>(url.toString());
  return {
    token: res.access_token,
    expiresAt: res.expires_in ? new Date(Date.now() + res.expires_in * 1000).toISOString() : null,
  };
}

/** الأذونات الممنوحة فعلاً لهذا التوكن. */
export async function grantedScopes(userToken: string): Promise<string[]> {
  const res = await graph<{ data?: { permission: string; status: string }[] }>(
    `${GRAPH}/me/permissions?access_token=${encodeURIComponent(userToken)}`,
  );
  return (res.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
}

export type MetaPage = {
  id: string;
  name?: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

/** صفحات المستخدم مع توكن كل صفحة وحساب إنستجرام المرتبط بها. */
export async function fetchPages(userToken: string): Promise<MetaPage[]> {
  const res = await graph<{ data?: MetaPage[] }>(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(userToken)}`,
  );
  return (res.data ?? []).filter((p) => p.access_token);
}

/** يحفظ (أو يحدّث) كل الصفحات وحسابات إنستجرام لمساحة العمل. */
export async function saveConnections(
  admin: Admin,
  workspaceId: string,
  params: { userToken: string; expiresAt: string | null; scopes: string[]; pages: MetaPage[] },
): Promise<{ facebook: number; instagram: number }> {
  let facebook = 0;
  let instagram = 0;
  for (const page of params.pages) {
    const base = {
      workspace_id: workspaceId,
      page_id: page.id,
      page_name: page.name ?? null,
      page_access_token: page.access_token,
      user_access_token: params.userToken,
      token_expires_at: params.expiresAt,
      scopes: params.scopes,
      status: "connected",
      last_error: null,
    };
    const { error } = await admin
      .from("meta_connections")
      .upsert({ ...base, kind: "facebook" }, { onConflict: "workspace_id,kind,page_id" });
    if (error) throw new Error(error.message);
    facebook += 1;

    if (page.instagram_business_account?.id) {
      const { error: igError } = await admin.from("meta_connections").upsert(
        {
          ...base,
          kind: "instagram",
          ig_user_id: page.instagram_business_account.id,
          ig_username: page.instagram_business_account.username ?? null,
        },
        { onConflict: "workspace_id,kind,page_id" },
      );
      if (igError) throw new Error(igError.message);
      instagram += 1;
    }
  }

  // نعكس الحالة على شاشة التكاملات العامة أيضاً.
  for (const provider of ["facebook", ...(instagram ? ["instagram"] : [])]) {
    await admin
      .from("integrations")
      .update({ status: "connected", account: params.pages[0]?.name ?? "Meta" })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider);
  }
  return { facebook, instagram };
}

function toConnection(row: {
  id: string;
  kind: string;
  page_id: string;
  page_name: string | null;
  page_access_token: string;
  ig_user_id: string | null;
  ig_username: string | null;
  scopes: string[] | null;
  status: string;
  token_expires_at: string | null;
}): MetaConnection {
  return {
    id: row.id,
    kind: row.kind === "instagram" ? "instagram" : "facebook",
    pageId: row.page_id,
    pageName: row.page_name,
    pageToken: row.page_access_token,
    igUserId: row.ig_user_id,
    igUsername: row.ig_username,
    scopes: row.scopes ?? [],
    status: row.status,
    expiresAt: row.token_expires_at,
  };
}

/** كل روابط ميتا المباشرة لمساحة العمل. */
export async function listMetaConnections(
  admin: Admin,
  workspaceId: string,
  kind?: "facebook" | "instagram",
): Promise<MetaConnection[]> {
  let query = admin
    .from("meta_connections")
    .select(
      "id, kind, page_id, page_name, page_access_token, ig_user_id, ig_username, scopes, status, token_expires_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toConnection);
}

/** الربط المستخدم للنشر على منصة ميتا (أول ربط صالح، أو صفحة محدّدة). */
export async function metaTarget(
  admin: Admin,
  workspaceId: string,
  kind: "facebook" | "instagram",
  pageId?: string,
): Promise<MetaConnection | null> {
  const all = await listMetaConnections(admin, workspaceId, kind);
  const usable = all.filter((c) => (kind === "instagram" ? Boolean(c.igUserId) : true));
  if (pageId) return usable.find((c) => c.pageId === pageId) ?? null;
  return usable.find((c) => c.status === "connected") ?? usable[0] ?? null;
}

/** هل يوجد مسار ميتا مباشر جاهز لهذه المنصة؟ (يقرر التوجيه الهجين) */
export async function hasMetaDirect(
  admin: Admin,
  workspaceId: string,
  provider: string,
): Promise<boolean> {
  if (provider !== "facebook" && provider !== "instagram") return false;
  if (!(await metaConfig())) return false;
  return Boolean(await metaTarget(admin, workspaceId, provider));
}

/* -------------------------------- النشر -------------------------------- */

export type MetaPublishInput = {
  text: string;
  imageUrl?: string | undefined;
  videoUrl?: string | undefined;
  pageId?: string | undefined;
};

export type MetaPublishResult = {
  provider: "facebook" | "instagram";
  postId: string;
  pageId: string;
  pageName: string | null;
  permalink: string | null;
  raw: unknown;
};

/** نشر على صفحة فيسبوك: نص / صورة (‎/photos‎) / فيديو (‎/videos‎). */
export async function publishFacebook(
  conn: MetaConnection,
  input: MetaPublishInput,
): Promise<MetaPublishResult> {
  let endpoint = `${GRAPH}/${conn.pageId}/feed`;
  const params = new URLSearchParams({ access_token: conn.pageToken });
  if (input.videoUrl) {
    endpoint = `${GRAPH}/${conn.pageId}/videos`;
    params.set("file_url", input.videoUrl);
    params.set("description", input.text);
  } else if (input.imageUrl) {
    endpoint = `${GRAPH}/${conn.pageId}/photos`;
    params.set("url", input.imageUrl);
    params.set("caption", input.text);
    params.set("published", "true");
  } else {
    params.set("message", input.text);
  }

  const res = await graph<{ id?: string; post_id?: string }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const postId = res.post_id ?? res.id ?? "";
  if (!postId) throw new Error("ميتا لم تُعِد معرّف المنشور — أعد المحاولة.");
  return {
    provider: "facebook",
    postId,
    pageId: conn.pageId,
    pageName: conn.pageName,
    permalink: `https://www.facebook.com/${postId}`,
    raw: res,
  };
}

/** نشر على إنستجرام: حاوية ثم media_publish (مع انتظار معالجة الريلز). */
export async function publishInstagram(
  conn: MetaConnection,
  input: MetaPublishInput,
): Promise<MetaPublishResult> {
  if (!conn.igUserId) throw new Error("لا يوجد حساب إنستجرام احترافي مرتبط بهذه الصفحة.");
  if (!input.imageUrl && !input.videoUrl)
    throw new Error("إنستجرام يتطلب صورة أو فيديو مع المنشور.");

  const create = new URLSearchParams({ access_token: conn.pageToken, caption: input.text });
  if (input.videoUrl) {
    create.set("media_type", "REELS");
    create.set("video_url", input.videoUrl);
  } else {
    create.set("image_url", input.imageUrl!);
  }
  const container = await graph<{ id?: string }>(`${GRAPH}/${conn.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: create.toString(),
  });
  if (!container.id) throw new Error("تعذّر تجهيز منشور إنستجرام.");

  if (input.videoUrl) {
    for (let i = 0; i < 18; i += 1) {
      await new Promise((r) => setTimeout(r, 5_000));
      const st = await graph<{ status_code?: string }>(
        `${GRAPH}/${container.id}?fields=status_code&access_token=${encodeURIComponent(conn.pageToken)}`,
      );
      if (st.status_code === "FINISHED") break;
      if (st.status_code === "ERROR")
        throw new Error("إنستجرام رفض الفيديو — استخدم MP4 عمودياً (9:16) أقل من ٩٠ ثانية.");
    }
  }

  const published = await graph<{ id?: string }>(`${GRAPH}/${conn.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: container.id,
      access_token: conn.pageToken,
    }).toString(),
  });
  if (!published.id) throw new Error("إنستجرام لم يُعِد معرّف المنشور.");

  let permalink: string | null = null;
  try {
    const meta = await graph<{ permalink?: string }>(
      `${GRAPH}/${published.id}?fields=permalink&access_token=${encodeURIComponent(conn.pageToken)}`,
    );
    permalink = meta.permalink ?? null;
  } catch {
    /* الرابط اختياري */
  }

  return {
    provider: "instagram",
    postId: published.id,
    pageId: conn.pageId,
    pageName: conn.igUsername ?? conn.pageName,
    permalink,
    raw: published,
  };
}

/** المدخل الموحّد للنشر المباشر على ميتا. */
export async function metaPublish(
  admin: Admin,
  workspaceId: string,
  provider: "facebook" | "instagram",
  input: MetaPublishInput,
): Promise<MetaPublishResult> {
  const conn = await metaTarget(admin, workspaceId, provider, input.pageId);
  if (!conn)
    throw new Error(
      provider === "facebook"
        ? "لا توجد صفحة فيسبوك مربوطة مباشرةً — اربط ميتا من صفحة التكاملات."
        : "لا يوجد حساب إنستجرام احترافي مربوط — اربط ميتا واختر صفحة مرتبطة بحساب إنستجرام.",
    );
  try {
    const result =
      provider === "facebook" ? await publishFacebook(conn, input) : await publishInstagram(conn, input);
    await admin
      .from("meta_connections")
      .update({ status: "connected", last_error: null })
      .eq("id", conn.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل غير معروف";
    await admin.from("meta_connections").update({ last_error: message }).eq("id", conn.id);
    throw error;
  }
}

/** تشخيص جاهزية النشر: الأذونات الناقصة وحالة كل صفحة. */
export async function metaDiagnose(
  admin: Admin,
  workspaceId: string,
): Promise<{
  configured: boolean;
  connections: {
    kind: "facebook" | "instagram";
    pageId: string;
    name: string | null;
    igUserId: string | null;
    canPublish: boolean;
    missing: string[];
    expiresAt: string | null;
    lastError?: string | null;
  }[];
}> {
  const configured = Boolean(await metaConfig());
  const rows = await listMetaConnections(admin, workspaceId);
  const connections = rows.map((c) => {
    const needed =
      c.kind === "facebook"
        ? ["pages_manage_posts", "pages_read_engagement"]
        : ["instagram_basic", "instagram_content_publish", "pages_read_engagement"];
    const missing = needed.filter((s) => !c.scopes.includes(s));
    return {
      kind: c.kind,
      pageId: c.pageId,
      name: c.kind === "instagram" ? (c.igUsername ?? c.pageName) : c.pageName,
      igUserId: c.igUserId,
      canPublish: missing.length === 0 && (c.kind === "facebook" || Boolean(c.igUserId)),
      missing,
      expiresAt: c.expiresAt,
    };
  });
  return { configured, connections };
}
