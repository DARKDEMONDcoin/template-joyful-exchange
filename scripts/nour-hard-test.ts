import { runChatTools } from "@/lib/chat-tools.server";
const msg = `عايز أتصدر جوجل في مصر لموقعي https://www.almasrafood.com خلال 90 يوم:
افحص الموقع تقنياً، هات كلمات مفتاحية حقيقية بنية شرائية، قارني بمنافسي elmenus.com،
شوف أداء الموقع في سيرش كونسول، وحدد الصفحات اللي بتتآكل، واكتبلي موجز محتوى لأقوى كلمة،
وخطة تنفيذ شهرية بأولويات وميزانية وقت.`;
const admin = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } as never;
const t = Date.now();
const res = await runChatTools(admin, { workspaceId: "00000000-0000-0000-0000-000000000000", employeeId: "nour", message: msg, website: "https://www.almasrafood.com", country: "EG", connected: [], targets: [] });
console.log("ms", Date.now() - t, "tools:", res.map((r) => r.tool));
for (const r of res) console.log("\n=== " + r.tool + " ===\n" + r.block.slice(0, 700));
