import { metaConfig, metaRedirectUri, META_SCOPES } from "@/lib/meta.server";
const c = await metaConfig();
console.log("config:", c ? { appId: c.appId.slice(0,6)+"…" } : null);
console.log("redirect:", metaRedirectUri());
console.log("scopes:", META_SCOPES.join(","));
