"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type GeneratedFile = {
  name: string;
  content: string;
};

type AppMode = "loading" | "welcome" | "onboarding" | "results" | "brain";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [brainMessages, setBrainMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // Check auth and load files on mount
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth";
        return;
      }

      setUser(user);

      // Load vault files from database
      const { data: vaultFiles } = await supabase
        .from("vault_files")
        .select("name, content")
        .eq("user_id", user.id);

      if (vaultFiles && vaultFiles.length > 0) {
        setFiles(vaultFiles);
        setMode("brain");
      } else {
        setMode("welcome");
      }
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, brainMessages]);

  async function saveFilesToDb(filesToSave: GeneratedFile[]) {
    if (!user) return;

    for (const file of filesToSave) {
      await supabase
        .from("vault_files")
        .upsert(
          { user_id: user.id, name: file.name, content: file.content, updated_at: new Date().toISOString() },
          { onConflict: "user_id,name" }
        );
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function startOnboarding() {
    setMode("onboarding");
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
    const isBrain = mode === "brain";
    const currentMessages = isBrain ? brainMessages : messages;
    const updatedMessages = [...currentMessages, userMessage];

    if (isBrain) {
      setBrainMessages(updatedMessages);
    } else {
      setMessages(updatedMessages);
    }
    setInput("");
    setLoading(true);

    try {
      const endpoint = isBrain ? "/api/brain" : "/api/chat";
      const body = isBrain
        ? { messages: updatedMessages, files }
        : { messages: updatedMessages };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const withResponse = [
        ...updatedMessages,
        { role: "assistant" as const, content: data.text },
      ];

      if (isBrain) {
        setBrainMessages(withResponse);
      } else {
        setMessages(withResponse);
      }
    } catch {
      const errorMsg = { role: "assistant" as const, content: "Something went wrong. Please try again." };
      if (isBrain) {
        setBrainMessages([...updatedMessages, errorMsg]);
      } else {
        setMessages([...updatedMessages, errorMsg]);
      }
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
        await saveFilesToDb(data.files);
        setMode("results");
      } else {
        alert("Something went wrong generating your files. Please try again.");
      }
    } catch {
      alert("Something went wrong generating your files. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateVault() {
    if (!files || brainMessages.length === 0) return;
    setUpdating(true);
    setUpdateStatus(null);

    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: brainMessages, files }),
      });
      const data = await res.json();

      if (data.updated && data.files) {
        const updatedFiles = files.map((existing) => {
          const updated = data.files.find(
            (f: GeneratedFile) => f.name === existing.name
          );
          return updated || existing;
        });
        const existingNames = new Set(files.map((f) => f.name));
        const newFiles = data.files.filter(
          (f: GeneratedFile) => !existingNames.has(f.name)
        );
        const allFiles = [...updatedFiles, ...newFiles];
        setFiles(allFiles);
        await saveFilesToDb(data.files);
        alert(`Updated ${data.files.length} file${data.files.length > 1 ? "s" : ""}.`);
      } else {
        alert(data.reason || "No updates needed.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setUpdating(false);
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

  async function downloadAll() {
    if (!files) return;
    for (const file of files) {
      downloadFile(file);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  function startBrain() {
    setBrainMessages([]);
    setMode("brain");
  }

  function viewFiles() {
    setMode("results");
  }

  async function resetAll() {
    if (!confirm("This will permanently delete your second brain and all generated files. You'll need to re-do onboarding from scratch. Are you sure?")) {
      return;
    }
    if (user) {
      await supabase
        .from("vault_files")
        .delete()
        .eq("user_id", user.id);
    }
    setFiles(null);
    setMessages([]);
    setBrainMessages([]);
    setMode("welcome");
  }

  // Loading screen
  if (mode === "loading") {
    return (
      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  // Welcome screen
  if (mode === "welcome") {
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
          <div>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              Log out ({user?.email})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Results view
  if (mode === "results" && files) {
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
              onClick={startBrain}
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
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 font-sans">
                {files[activeFile].content}
              </pre>
              <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={resetAll}
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

  // Chat interface (onboarding or brain)
  const isBrain = mode === "brain";
  const currentMessages = isBrain ? brainMessages : messages;

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Second Brain
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
            {isBrain ? "Chat" : "Onboarding"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isBrain && (
            <>
              <button
                onClick={handleUpdateVault}
                disabled={updating || brainMessages.length === 0}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 transition-colors"
              >
                {updating ? "Updating…" : "Update Vault"}
              </button>
              <button
                onClick={viewFiles}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                View Files
              </button>
            </>
          )}
          {!isBrain && messages.length >= 6 && (
            <button
              onClick={handleFinish}
              disabled={generating || loading}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 transition-colors"
            >
              {generating ? "Building…" : "Finish & Build"}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {currentMessages.length === 0 && isBrain && (
            <p className="text-center text-zinc-400 dark:text-zinc-600 mt-32">
              Ask your second brain anything.
            </p>
          )}
          {currentMessages.map((msg, i) => (
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
