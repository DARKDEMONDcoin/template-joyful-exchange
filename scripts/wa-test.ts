import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { metaConfig, metaAuthorizeUrl, metaRedirectUri, signState, verifyState, WHATSAPP_SCOPES, discoverWabaPhones } from "@/lib/meta.server";
const WS = "434b263e-2aa0-4fc6-9759-7cc2675d40e0";
const c = (await metaConfig())!;
const state = await signState(c, WS, "/app/settings?tab=whatsapp", "whatsapp");
console.log("state ok:", JSON.stringify(await verifyState(c, state)));
const url = metaAuthorizeUrl(c, metaRedirectUri(), state, WHATSAPP_SCOPES);
console.log("scopes in url:", new URL(url).searchParams.get("scope"));
const { data } = await supabaseAdmin.from("meta_connections").select("user_access_token").eq("workspace_id", WS).limit(1).maybeSingle();
if (data?.user_access_token) {
  const phones = await discoverWabaPhones(c, data.user_access_token);
  console.log("discovered phones:", phones.length, phones.map(p=>p.displayNumber));
} else console.log("no meta token stored");
process.exit(0);
