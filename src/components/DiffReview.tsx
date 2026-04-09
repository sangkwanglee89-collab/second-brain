"use client";

import { useState } from "react";
import { diffLines, type Change } from "diff";
import type { PendingUpdate } from "@/lib/types";

type DiffReviewProps = {
  updates: PendingUpdate[];
  onApply: (approved: PendingUpdate[]) => void;
  onDiscard: () => void;
};

function DiffView({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const changes: Change[] = diffLines(oldContent, newContent);

  return (
    <div className="font-mono text-xs leading-relaxed overflow-x-auto">
      {changes.map((change, i) => {
        const lines = change.value.replace(/\n$/, "").split("\n");
        return lines.map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={`px-3 py-0.5 whitespace-pre-wrap ${
              change.added
                ? "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300"
                : change.removed
                ? "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 line-through"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span className="inline-block w-5 text-zinc-300 dark:text-zinc-700 select-none mr-2">
              {change.added ? "+" : change.removed ? "-" : " "}
            </span>
            {line || " "}
          </div>
        ));
      })}
    </div>
  );
}

export default function DiffReview({ updates, onApply, onDiscard }: DiffReviewProps) {
  const [selections, setSelections] = useState<Record<string, boolean>>(
    Object.fromEntries(updates.map((u) => [u.name, true]))
  );
  const [activeFile, setActiveFile] = useState(0);
  const [viewMode, setViewMode] = useState<"diff" | "before" | "after">("diff");

  function toggleFile(name: string) {
    setSelections((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function handleApply() {
    const approved = updates
      .filter((u) => selections[u.name])
      .map((u) => ({ ...u, approved: true }));
    onApply(approved);
  }

  const selectedCount = Object.values(selections).filter(Boolean).length;
  const current = updates[activeFile];
  const isNewFile = !current.oldContent;

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Review Vault Updates
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
            {updates.length} file{updates.length > 1 ? "s" : ""} changed — review before applying
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDiscard}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Discard All
          </button>
          <button
            onClick={handleApply}
            disabled={selectedCount === 0}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-30 transition-colors"
          >
            Apply {selectedCount}/{updates.length}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* File list */}
        <div className="w-56 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto py-2">
          {updates.map((update, i) => (
            <div
              key={update.name}
              className={`flex items-center gap-2 mx-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                activeFile === i
                  ? "bg-zinc-200 dark:bg-zinc-800"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
              onClick={() => setActiveFile(i)}
            >
              <input
                type="checkbox"
                checked={selections[update.name]}
                onChange={() => toggleFile(update.name)}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-500"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {update.name}
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">
                  {!update.oldContent ? "New file" : "Modified"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Diff content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View mode tabs */}
          <div className="flex items-center gap-1 px-6 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setViewMode("diff")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "diff"
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Diff
            </button>
            {!isNewFile && (
              <button
                onClick={() => setViewMode("before")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "before"
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Before
              </button>
            )}
            <button
              onClick={() => setViewMode("after")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "after"
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              After
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "diff" ? (
              <DiffView
                oldContent={current.oldContent || ""}
                newContent={current.newContent}
              />
            ) : (
              <div className="font-mono text-xs leading-relaxed px-3 py-2">
                {(viewMode === "before" ? current.oldContent : current.newContent)
                  .split("\n")
                  .map((line, i) => (
                    <div key={i} className="px-3 py-0.5 text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {line || " "}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
