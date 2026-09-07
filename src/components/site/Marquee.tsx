import { AppIcon, appLabel } from "@/components/site/AppIcon";

const platforms = [
  "instagram",
  "linkedin",
  "facebook",
  "x",
  "tiktok",
  "youtube",
  "pinterest",
  "whatsapp",
  "gmail",
  "slack",
  "shopify",
  "notion",
];

export function Marquee() {
  const row = [...platforms, ...platforms];
  return (
    <section className="border-y border-border bg-background py-10">
      <p className="mb-6 text-center text-sm font-semibold tracking-wide text-muted-foreground">
        فريقك ينشر ويشتغل مباشرة على المنصات اللي تستخدمها
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track gap-4">
          {row.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold whitespace-nowrap text-ink-soft shadow-card"
            >
              <AppIcon name={p} className="size-4.5" />
              {appLabel(p)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
