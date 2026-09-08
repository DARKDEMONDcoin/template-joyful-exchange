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

/** حالة قناة واتساب: هل هي مربوطة، وما الأرقام المسموح لها. */
export const whatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => wsInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const [{ data: cred }, { data: links }, { data: account }] = await Promise.all([
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
      admin
        .from("pipedream_accounts")
        .select("account_id, account_name, status")
        .eq("workspace_id", data.workspaceId)
        .eq("provider", "whatsapp")
        .maybeSingle(),
    ]);
    const config = (cred?.config ?? {}) as {
      phoneNumberId?: string;
      displayNumber?: string;
      verifyToken?: string;
      accountId?: string;
    };
    return {
      connected: Boolean(config.phoneNumberId),
      phoneNumberId: config.phoneNumberId ?? "",
      displayNumber: config.displayNumber ?? "",
      verifyToken: config.verifyToken ?? "",
      viaPipedream: Boolean(config.accountId),
      /** حساب واتساب للأعمال المربوط لدى الوسيط (قبل اختيار رقم الإرسال). */
      account: account?.status === "connected" ? (account.account_name ?? "واتساب") : null,
      links: links ?? [],
    };
  });

/** أرقام الإرسال داخل حساب واتساب للأعمال المربوط عبر Pipedream. */
export const whatsappPhones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => wsInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { data: account } = await admin
      .from("pipedream_accounts")
      .select("account_id")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp")
      .maybeSingle();
    if (!account?.account_id) {
      throw new Error("اربط واتساب للأعمال أولاً من زر الربط بالأعلى.");
    }
    const { listPipedreamPhones } = await import("./whatsapp.server");
    const phones = await listPipedreamPhones(data.workspaceId, account.account_id);
    return { phones };
  });

/** يعتمد رقم الإرسال المختار من الحساب المربوط عبر Pipedream. */
export const selectWhatsappPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        phoneNumberId: z.string().min(5).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { data: account } = await admin
      .from("pipedream_accounts")
      .select("account_id")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp")
      .maybeSingle();
    if (!account?.account_id) throw new Error("اربط واتساب للأعمال أولاً.");

    const { verifyWhatsappCreds } = await import("./whatsapp.server");
    const info = await verifyWhatsappCreds({
      workspaceId: data.workspaceId,
      accountId: account.account_id,
      phoneNumberId: data.phoneNumberId.trim(),
    });

    // كلمة التحقق تُولَّد مرة وتبقى ثابتة حتى لا ينكسر إعداد الويبهوك لاحقاً.
    const { data: existing } = await admin
      .from("integration_credentials")
      .select("config")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp")
      .maybeSingle();
    const previous = (existing?.config ?? {}) as { verifyToken?: string };
    const verifyToken = previous.verifyToken ?? crypto.randomUUID().replace(/-/g, "");

    const { error } = await admin.from("integration_credentials").upsert(
      {
        workspace_id: data.workspaceId,
        provider: "whatsapp",
        config: {
          phoneNumberId: data.phoneNumberId.trim(),
          accountId: account.account_id,
          displayNumber: info.displayNumber,
          verifyToken,
        },
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) throw new Error(error.message);

    await admin
      .from("integrations")
      .update({ status: "connected", account: info.displayNumber || info.verifiedName || null })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp");

    return { ok: true as const, displayNumber: info.displayNumber, verifyToken };
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
