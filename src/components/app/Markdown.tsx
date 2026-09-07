import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** عرض مخرجات الموظفين بتنسيق Markdown كامل (جداول، قوائم، عناوين، أكواد) بشكل احترافي وRTL. */
export function Markdown({ body, className }: { body: string; className?: string }) {
  return (
    <div
      dir="auto"
      className={cn(
        "prose prose-sm max-w-none prose-headings:font-display prose-headings:font-black",
        "prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-li:my-0.5",
        "prose-a:text-primary prose-a:underline-offset-4 prose-strong:font-bold",
        "prose-table:my-3 prose-table:block prose-table:overflow-x-auto prose-table:text-[0.8rem] prose-th:bg-secondary/60 prose-th:p-2",
        "break-words [&_pre]:max-w-full",
        "prose-td:p-2 prose-th:border prose-td:border prose-th:border-border prose-td:border-border",
        "prose-img:rounded-2xl prose-img:my-3 prose-img:w-full prose-img:border prose-img:border-border",
        "prose-hr:my-4 prose-blockquote:border-s-2 prose-blockquote:border-e-0 prose-blockquote:ps-3",
        "prose-blockquote:not-italic prose-blockquote:text-muted-foreground",
        "prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:overflow-x-auto prose-pre:rounded-2xl prose-pre:bg-secondary prose-pre:text-foreground",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
