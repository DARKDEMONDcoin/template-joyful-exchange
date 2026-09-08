/**
 * دوال الخادم لقناة التحكّم عبر واتساب: حفظ بيانات الربط، توليد كود ربط الرقم، وإدارة الأرقام المسموح لها.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const wsInput = z.object({ workspaceId: z.string().uuid() });

const PROJECT_ID = "541025ee-163e-49a6-8c43-600f36bcb147";
const ALLOWED_RETURN_HOSTS = new Set([
  `project--${PROJECT_ID}.lovable.app`,
  `project--${PROJECT_ID}-dev.lovable.app`,
  `id-preview--${PROJECT_ID}.lovable.app`,
  "template-joyful-exchange.lovable.app",
  "localhost:8080",
]);

function whatsappReturnTo(origin: string | undefined): string {
  if (!origin) return "/app/settings?tab=whatsapp";
  try {
    const url = new URL(origin);
    const isLocal = url.protocol === "http:" && url.host === "localhost:8080";
    const isSecureProjectHost = url.protocol === "https:" && ALLOWED_RETURN_HOSTS.has(url.host);
    if (!isLocal && !isSecureProjectHost) return "/app/settings?tab=whatsapp";
    return `${url.origin}/app/settings?tab=whatsapp`;
  } catch {
    return "/app/settings?tab=whatsapp";
  }
}

/** حالة قناة واتساب: هل هي مربوطة، وما الأرقام المسموح لها. */
export const whatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => wsInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const [{ data: cred }, { data: links }] = await Promise.all([
      admin
        .from("integration_credentials")
        .select("config")
        .eq("workspace_id", data.workspaceId)
        .eq("provider", "whatsapp")
        .maybeSingle(),
      admin
        .from("command_links")
        .select("id, external_id, label, role, last_seen_at")
        .eq("workspace_id", data.workspaceId)
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: true }),
    ]);
    const config = (cred?.config ?? {}) as {
      phoneNumberId?: string;
      displayNumber?: string;
      phones?: { id: string; displayNumber: string; name?: string }[];
    };
    return {
      connected: Boolean(config.phoneNumberId),
      phoneNumberId: config.phoneNumberId ?? "",
      displayNumber: config.displayNumber ?? "",
      phones: config.phones ?? [],
      links: links ?? [],
    };
  });

/** يبدأ ربط واتساب بضغطة واحدة عبر تفويض فيسبوك — بلا أي معرّفات يدوية. */
export const startWhatsappConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        returnOrigin: z.string().url().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const meta = await import("./meta.server");
    const config = await meta.metaConfig();
    if (!config) throw meta.metaMissingConfigError();
    const state = await meta.signState(
      config,
      data.workspaceId,
      whatsappReturnTo(data.returnOrigin),
      "whatsapp",
    );
    return {
      url: meta.metaAuthorizeUrl(
        config,
        meta.metaRedirectUri(),
        state,
        meta.WHATSAPP_SCOPES,
      ),
    };
  });

/** يبدّل رقم الإرسال بين الأرقام المكتشَفة تلقائياً. */
export const selectWhatsappPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), phoneNumberId: z.string().min(5).max(60) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { data: cred } = await admin
      .from("integration_credentials")
      .select("config")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp")
      .maybeSingle();
    const config = (cred?.config ?? {}) as {
      phones?: { id: string; displayNumber: string; wabaId?: string }[];
    };
    const phone = (config.phones ?? []).find((p) => p.id === data.phoneNumberId);
    if (!phone) throw new Error("هذا الرقم غير موجود ضمن حسابك — أعد الربط.");

    const { error } = await admin
      .from("integration_credentials")
      .update({
        config: {
          ...config,
          phoneNumberId: phone.id,
          displayNumber: phone.displayNumber,
          ...(phone.wabaId ? { wabaId: phone.wabaId } : {}),
        },
      })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp");
    if (error) throw new Error(error.message);

    await admin
      .from("integrations")
      .update({ status: "connected", account: phone.displayNumber })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp");

    return { ok: true as const, displayNumber: phone.displayNumber };
  });

/** يولّد كود ربط صالح ١٥ دقيقة يرسله صاحب الرقم من واتساب. */
export const createLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        label: z.string().max(60).nullish(),
        role: z.enum(["owner", "member"]).default("owner"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      (n) => alphabet[n % alphabet.length],
    ).join("");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error } = await admin.from("command_link_codes").insert({
      code,
      workspace_id: data.workspaceId,
      channel: "whatsapp",
      role: data.role,
      label: data.label ?? null,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, code, expiresAt };
  });

/** يحذف رقماً مسموحاً له بالتحكّم. */
export const removeCommandLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { error } = await admin
      .from("command_links")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
