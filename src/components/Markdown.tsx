import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-5 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-4 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 mb-3 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-5 mb-3 space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-5 mb-3 space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  hr: () => (
    <hr className="border-zinc-200 dark:border-zinc-800 my-4" />
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-4 my-3 text-sm text-zinc-600 dark:text-zinc-400 italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 my-3 overflow-x-auto">
          <code className="text-xs text-zinc-800 dark:text-zinc-200 font-mono">{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-800 dark:text-zinc-200">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-left font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-800 dark:text-zinc-200">
      {children}
    </td>
  ),
};

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
