"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type GeneratedFile = {
  name: string;
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startOnboarding() {
    setStarted(true);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hi, I'm ready to get started." }],
        }),
      });
      const data = await res.json();
      setMessages([{ role: "assistant", content: data.text }]);
    } catch {
      setMessages([
        { role: "assistant", content: "Something went wrong. Please refresh and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.text },
      ]);
    } catch {
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    setGenerating(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      } else {
        alert("Something went wrong generating your files. Please try again.");
      }
    } catch {
      alert("Something went wrong generating your files. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadFile(file: GeneratedFile) {
    const blob = new Blob([file.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    files?.forEach((file) => downloadFile(file));
  }

  // Welcome screen
  if (!started) {
    return (
      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
        <div className="max-w-md text-center space-y-6 px-6">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            Second Brain
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Build a personal model that understands how you think. It starts
            with a conversation — about 15 minutes — and gets sharper the
            more you use it.
          </p>
          <button
            onClick={startOnboarding}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-8 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // Results view
  if (files) {
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
          <button
            onClick={downloadAll}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            Download All
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* File tabs */}
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

          {/* File content */}
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
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 font-sans">
                {files[activeFile].content}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Second Brain
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
            Onboarding
          </p>
        </div>
        {messages.length >= 6 && (
          <button
            onClick={handleFinish}
            disabled={generating || loading}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 transition-colors"
          >
            {generating ? "Building…" : "Finish & Build"}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-200 dark:bg-zinc-800 px-4 py-3 rounded-2xl text-sm text-zinc-500">
                Thinking…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex gap-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type a message… (Shift+Enter for new line)"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 150) + "px";
            }}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
