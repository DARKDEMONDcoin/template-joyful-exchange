/**
 * قناة واتساب للأعمال (WhatsApp Cloud API) — إرسال الرسائل وقراءة بيانات الربط.
 * بيانات الربط تُحفظ في integration_credentials تحت المزوّد "whatsapp".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type WhatsappCreds = {
  /** معرّف رقم الإرسال في واتساب للأعمال (Phone Number ID). */
  phoneNumberId: string;
  /** توكن دائم لتطبيق ميتا يملك صلاحية whatsapp_business_messaging. */
  token: string;
  /** رقم العرض — للعرض فقط في الواجهة. */
  displayNumber?: string;
  /** الكلمة السرية التي تُدخل في إعداد الويبهوك داخل لوحة ميتا. */
  verifyToken?: string;
};

/** يتحقق من كلمة التحقق المرسلة من ميتا عند تفعيل الويبهوك. */
export async function verifyTokenMatches(admin: Admin, token: string): Promise<boolean> {
  if (!token) return false;
  const { data } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("provider", "whatsapp");
  return (data ?? []).some(
    (row) => (row.config as Partial<WhatsappCreds>)?.verifyToken === token,
  );
}


/** يقرأ بيانات واتساب لمساحة عمل بعينها. */
export async function whatsappCreds(
  admin: Admin,
  workspaceId: string,
): Promise<WhatsappCreds | null> {
  const { data } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "whatsapp")
    .maybeSingle();
  const config = data?.config as Partial<WhatsappCreds> | undefined;
  if (!config?.phoneNumberId || !config.token) return null;
  return {
    phoneNumberId: config.phoneNumberId,
    token: config.token,
    ...(config.displayNumber ? { displayNumber: config.displayNumber } : {}),
  };
}

/** يعثر على مساحة العمل صاحبة رقم الإرسال الذي وصلت إليه الرسالة. */
export async function workspaceByPhoneNumberId(
  admin: Admin,
  phoneNumberId: string,
): Promise<{ workspaceId: string; creds: WhatsappCreds } | null> {
  const { data } = await admin
    .from("integration_credentials")
    .select("workspace_id, config")
    .eq("provider", "whatsapp");
  for (const row of data ?? []) {
    const config = row.config as Partial<WhatsappCreds>;
    if (config?.phoneNumberId === phoneNumberId && config.token) {
      return {
        workspaceId: row.workspace_id,
        creds: {
          phoneNumberId: config.phoneNumberId,
          token: config.token,
          ...(config.displayNumber ? { displayNumber: config.displayNumber } : {}),
        },
      };
    }
  }
  return null;
}

/** يرسل رسالة نصية عبر واتساب Cloud API (داخل نافذة ٢٤ ساعة من رسالة العميل). */
export async function sendWhatsapp(
  creds: WhatsappCreds,
  to: string,
  text: string,
): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v23.0/${creds.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: text.slice(0, 4000) },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send failed [${res.status}]: ${body.slice(0, 400)}`);
  }
}

/** يتحقق من صلاحية بيانات الربط ويعيد رقم العرض. */
export async function verifyWhatsappCreds(
  creds: Pick<WhatsappCreds, "phoneNumberId" | "token">,
): Promise<{ displayNumber: string; verifiedName?: string }> {
  const res = await fetch(
    `https://graph.facebook.com/v23.0/${creds.phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${creds.token}` } },
  );
  const body = (await res.json()) as {
    display_phone_number?: string;
    verified_name?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(body.error?.message ?? `تعذّر التحقق من رقم واتساب [${res.status}].`);
  }
  return {
    displayNumber: body.display_phone_number ?? "",
    ...(body.verified_name ? { verifiedName: body.verified_name } : {}),
  };
}
