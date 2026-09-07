import { createFileRoute } from "@tanstack/react-router";

/**
 * عودة تفويض ميتا: يبدّل الرمز بتوكن طويل المدى، يجلب الصفحات وحسابات إنستجرام،
 * ويحفظها في meta_connections ثم يعيد المستخدم إلى صفحة التكاملات.
 */
export const Route = createFileRoute("/api/public/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const back = (path: string, params: Record<string, string>) => {
          const target = new URL(path, url.origin);
          for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
          return Response.redirect(target.toString(), 302);
        };

        const meta = await import("@/lib/meta.server");
        const config = await meta.metaConfig();
        if (!config) return back("/app/integrations", { meta: "failed", reason: "no-config" });

        const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (error) return back("/app/integrations", { meta: "failed", reason: error.slice(0, 160) });

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state") ?? "";
        if (!code) return back("/app/integrations", { meta: "failed", reason: "no-code" });

        const verified = await meta.verifyState(config, state);
        if (!verified) return back("/app/integrations", { meta: "failed", reason: "bad-state" });

        try {
          const redirectUri = meta.metaRedirectUri(url.origin);
          const short = await meta.exchangeCode(config, code, redirectUri);
          const { token, expiresAt } = await meta.longLivedToken(config, short);
          const [scopes, pages] = await Promise.all([
            meta.grantedScopes(token),
            meta.fetchPages(token),
          ]);
          if (!pages.length)
            return back(verified.returnTo, { meta: "failed", reason: "no-pages" });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const saved = await meta.saveConnections(supabaseAdmin, verified.workspaceId, {
            userToken: token,
            expiresAt,
            scopes,
            pages,
          });
          return back(verified.returnTo, {
            meta: "connected",
            pages: String(saved.facebook),
            ig: String(saved.instagram),
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "failed";
          console.error("[meta] callback failed", message);
          return back(verified.returnTo, { meta: "failed", reason: message.slice(0, 160) });
        }
      },
    },
  },
});
