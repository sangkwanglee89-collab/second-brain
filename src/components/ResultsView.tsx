"use client";

import { useState } from "react";
import type { GeneratedFile } from "@/lib/types";
import Markdown from "@/components/Markdown";

type ResultsViewProps = {
  files: GeneratedFile[];
  onStartChat: () => void;
  onReset: () => void;
};

export default function ResultsView({ files, onStartChat, onReset }: ResultsViewProps) {
  const [activeFile, setActiveFile] = useState(0);

  function downloadFile(file: GeneratedFile) {
    const blob = new Blob([file.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAll() {
    for (const file of files) {
      downloadFile(file);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Your Second Brain
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
            {files.length} files generated
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadAll}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Download All
          </button>
          <button
            onClick={onStartChat}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            Start Chatting
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto py-2">
          {files.map((file, i) => (
            <button
              key={file.name}
              onClick={() => setActiveFile(i)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                activeFile === i
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {files[activeFile].name}
              </h2>
              <button
                onClick={() => downloadFile(files[activeFile])}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                Download
              </button>
            </div>
            <div className="prose-custom">
              <Markdown content={files[activeFile].content} />
            </div>
            <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={onReset}
                className="text-xs text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Reset and start over
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
