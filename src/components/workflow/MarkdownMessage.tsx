"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({
  content,
  tone = "light",
}: {
  content: string;
  tone?: "light" | "dark";
}) {
  const mutedText = tone === "dark" ? "text-white/80" : "text-gray-700";
  const borderColor = tone === "dark" ? "border-white/20" : "border-gray-200";
  const codeBg = tone === "dark" ? "bg-black/20" : "bg-gray-100";
  const preBg = tone === "dark" ? "bg-black/25" : "bg-gray-900";
  const preText = tone === "dark" ? "text-white" : "text-gray-100";
  const quoteBorder = tone === "dark" ? "border-white/30" : "border-gray-300";
  const linkClass = tone === "dark" ? "text-white underline" : "text-blue-600 underline";

  return (
    <div className={`min-w-0 break-words text-sm leading-6 ${mutedText}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
          h1: ({ children }) => <h1 className="mb-3 text-lg font-semibold last:mb-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 text-base font-semibold last:mb-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold last:mb-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 text-sm font-semibold last:mb-0">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className={`mb-3 border-l-4 ${quoteBorder} pl-3 italic last:mb-0`}>
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              {children}
            </a>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={`font-mono text-[12px] ${className}`}>
                {children}
              </code>
            ) : (
              <code className={`rounded px-1 py-0.5 font-mono text-[12px] ${codeBg}`}>
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre
              className={`mb-3 overflow-x-auto rounded-lg ${preBg} px-3 py-2 ${preText} last:mb-0`}
            >
              {children}
            </pre>
          ),
          hr: () => <hr className={`my-3 border-t ${borderColor}`} />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className={`min-w-full border-collapse border text-xs ${borderColor}`}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`border px-2 py-1 text-left font-medium ${borderColor}`}>{children}</th>
          ),
          td: ({ children }) => (
            <td className={`border px-2 py-1 align-top ${borderColor}`}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
