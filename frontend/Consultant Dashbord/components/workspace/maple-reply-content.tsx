"use client";

import { useEffect, useId, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

function MermaidBlock({ code }: { code: string }) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "inherit",
        });
        const { svg: rendered } = await mermaid.render(`maple-mmd-${reactId}`, code.trim());
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground">
        {code}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-6 text-center text-[11px] text-muted-foreground">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-red-100 bg-white p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const components: Partial<Components> = {
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[16rem] border-collapse text-left text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-red-50/80 text-red-950">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border/70 px-2.5 py-1.5 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/40 px-2.5 py-1.5 align-top text-foreground/90">{children}</td>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="text-red-700 underline underline-offset-2" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const text = String(children).replace(/\n$/, "");
    const lang = /language-(\w+)/.exec(className ?? "")?.[1];
    const isBlock = Boolean(lang) || text.includes("\n");

    if (lang === "mermaid") {
      return <MermaidBlock code={text} />;
    }

    if (!isBlock) {
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]" {...props}>
          {children}
        </code>
      );
    }

    return (
      <pre className="my-2 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
        <code>{text}</code>
      </pre>
    );
  },
  pre: ({ children }) => <>{children}</>,
};

export function MapleReplyContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("maple-reply text-[13px] text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export type MapleAccuracy = {
  score?: number;
  label?: string;
  level?: "high" | "medium" | "low" | string;
  basis?: string[];
  gaps?: string[];
  disclaimer?: string;
};

export function MapleAccuracyBadge({ accuracy }: { accuracy?: MapleAccuracy | null }) {
  if (!accuracy?.score && accuracy?.score !== 0) return null;

  const level = accuracy.level ?? "medium";
  const tone =
    level === "high"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : level === "low"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-sky-200 bg-sky-50 text-sky-950";

  const title = [
    accuracy.label,
    accuracy.basis?.length ? `Based on: ${accuracy.basis.join("; ")}` : null,
    accuracy.gaps?.length ? `Gaps: ${accuracy.gaps.join("; ")}` : null,
    accuracy.disclaimer,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium",
        tone,
      )}
      title={title}
    >
      <span className="tabular-nums">{accuracy.score}%</span>
      <span className="truncate opacity-90">{accuracy.label ?? "Case grounding"}</span>
    </div>
  );
}
