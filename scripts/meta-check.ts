import { supabaseAdmin } from "@/integrations/supabase/client.server";
const { data } = await supabaseAdmin.from("meta_connections").select("page_id,page_access_token").eq("kind","facebook").limit(1).single();
const r = await fetch(`https://graph.facebook.com/v23.0/${data!.page_id}?fields=name,fan_count&access_token=${data!.page_access_token}`);
console.log("page:", r.status, (await r.text()).slice(0,300));
const p = await fetch(`https://graph.facebook.com/v23.0/${data!.page_id}/feed?limit=3&fields=message,created_time&access_token=${data!.page_access_token}`);
console.log("feed:", p.status, (await p.text()).slice(0,500));
