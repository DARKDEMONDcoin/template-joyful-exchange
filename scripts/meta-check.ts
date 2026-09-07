import { supabaseAdmin } from "@/integrations/supabase/client.server";
const { data: conns } = await supabaseAdmin.from("meta_connections").select("workspace_id,kind,page_id,page_name,status,last_error,token_expires_at");
console.log("connections:", conns);
const { data: posts } = await supabaseAdmin.from("social_posts").select("provider,status,last_error,published_at,created_at").order("created_at",{ascending:false}).limit(8);
console.log("recent posts:", posts);
