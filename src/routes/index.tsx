import { createFileRoute } from "@tanstack/react-router";

import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Marquee } from "@/components/site/Marquee";
import { Employees } from "@/components/site/Employees";
import { Features } from "@/components/site/Features";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Testimonials } from "@/components/site/Testimonials";
import { Pricing } from "@/components/site/Pricing";
import { Faq, faqs } from "@/components/site/Faq";
import { CtaFooter } from "@/components/site/CtaFooter";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "سهل | وظّف فريق موظفين ذكاء اصطناعي يعمل بالعربية 24/7" },
      {
        name: "description",
        content:
          "سهل: ستة موظفين بالذكاء الاصطناعي باشتراك واحد — ينشرون على 7 منصات، يصممون، يردّون على عملائك، ويتابعون مبيعاتك بالعربية وبلهجتك.",
      },
      { property: "og:title", content: "سهل | فريق موظفين ذكاء اصطناعي يعمل بالعربية" },
      {
        property: "og:description",
        content: "موظفون رقميون ينشرون ويصممون ويبيعون نيابة عنك — ابدأ مجاناً بدون بطاقة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "سهل",
              alternateName: "Sahl",
              url: "https://huggable-code-swap.lovable.app",
              description:
                "منصة عربية تمنح أصحاب المشاريع فريق موظفين بالذكاء الاصطناعي ينشر ويصمّم ويردّ ويبيع على مدار الساعة.",
            },
            {
              "@type": "SoftwareApplication",
              name: "سهل",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              inLanguage: "ar",
              offers: {
                "@type": "Offer",
                price: "149",
                priceCurrency: "SAR",
                description: "باقة البداية — موظف رقمي واحد",
              },
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});


function Index() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Marquee />
      <Employees />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <Faq />
      <CtaFooter />
      <SiteFooter />
    </main>
  );
}
