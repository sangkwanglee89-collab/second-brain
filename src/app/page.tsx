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

type SharingSetting = {
  file_name: string;
  shared: boolean;
};

type Partnership = {
  id: string;
  partnerId: string;
  partnerEmail: string;
} | null;

type AppMode = "loading" | "welcome" | "onboarding" | "results" | "brain" | "partner-chat" | "settings";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [brainMessages, setBrainMessages] = useState<Message[]>([]);
  const [partnerMessages, setPartnerMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const [partnership, setPartnership] = useState<Partnership>(null);
  const [sharingSettings, setSharingSettings] = useState<SharingSetting[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [partnerFiles, setPartnerFiles] = useState<GeneratedFile[]>([]);
  const [partnerEmail, setPartnerEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth";
        return;
      }

      setUser(user);

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

      // Load partnership
      const partnerRes = await fetch("/api/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-partnership", userId: user.id }),
      });
      const partnerData = await partnerRes.json();
      if (partnerData.partnership) {
        setPartnership(partnerData.partnership);
      }

      // Load sharing settings
      const sharingRes = await fetch("/api/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-sharing", userId: user.id }),
      });
      const sharingData = await sharingRes.json();
      if (sharingData.settings) {
        setSharingSettings(sharingData.settings);
      }
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, brainMessages, partnerMessages]);

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
    const isPartnerChat = mode === "partner-chat";
    const isBrain = mode === "brain";
    const currentMessages = isPartnerChat ? partnerMessages : isBrain ? brainMessages : messages;
    const updatedMessages = [...currentMessages, userMessage];

    if (isPartnerChat) {
      setPartnerMessages(updatedMessages);
    } else if (isBrain) {
      setBrainMessages(updatedMessages);
    } else {
      setMessages(updatedMessages);
    }
    setInput("");
    setLoading(true);

    try {
      let endpoint = "/api/chat";
      let body: Record<string, unknown> = { messages: updatedMessages };

      if (isBrain) {
        endpoint = "/api/brain";
        body = { messages: updatedMessages, files };
      } else if (isPartnerChat) {
        endpoint = "/api/partner-chat";
        body = { messages: updatedMessages, files: partnerFiles, partnerName: partnerEmail.split("@")[0] };
      }

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

      if (isPartnerChat) {
        setPartnerMessages(withResponse);
      } else if (isBrain) {
        setBrainMessages(withResponse);
      } else {
        setMessages(withResponse);
      }
    } catch {
      const errorMsg = { role: "assistant" as const, content: "Something went wrong. Please try again." };
      if (isPartnerChat) {
        setPartnerMessages([...updatedMessages, errorMsg]);
      } else if (isBrain) {
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

  async function generateInvite() {
    if (!user) return;
    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-invite", userId: user.id }),
    });
    const data = await res.json();
    if (data.inviteCode) {
      setInviteCode(data.inviteCode);
    } else {
      alert(data.error || "Failed to create invite.");
    }
  }

  async function updateSharing(fileName: string, shared: boolean) {
    if (!user || !files) return;

    const updated = sharingSettings.map((s) =>
      s.file_name === fileName ? { ...s, shared } : s
    );
    // If setting doesn't exist yet, add it
    if (!updated.find((s) => s.file_name === fileName)) {
      updated.push({ file_name: fileName, shared });
    }
    setSharingSettings(updated);

    await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-sharing",
        userId: user.id,
        fileNames: [fileName],
        shared: [shared],
      }),
    });
  }

  async function startPartnerChat() {
    if (!user) return;

    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-partner-files", userId: user.id }),
    });
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      setPartnerFiles(data.files);
      setPartnerEmail(data.partnerEmail);
      setPartnerMessages([]);
      setMode("partner-chat");
    } else {
      alert("Your partner hasn't shared any files yet.");
    }
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
          <p className="text-xs text-zinc-400 dark:text-zinc-600 leading-relaxed max-w-sm">
            Powered by Claude (Anthropic). Your conversations are not used
            to train AI models. Your data is encrypted and private to you.
          </p>
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

  // Settings view
  if (mode === "settings") {
    const inviteUrl = inviteCode
      ? `${window.location.origin}/invite?code=${inviteCode}`
      : null;

    return (
      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Settings
          </h1>
          <button
            onClick={startBrain}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Back to Chat
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-lg mx-auto space-y-10">
            {/* Partner Connection */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Partner Connection
              </h2>
              {partnership ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Connected with <span className="font-medium text-zinc-900 dark:text-zinc-100">{partnership.partnerEmail}</span>
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No partner connected. Generate an invite link to share.
                  </p>
                  <button
                    onClick={generateInvite}
                    className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
                  >
                    Generate Invite Link
                  </button>
                  {inviteUrl && (
                    <div className="mt-3 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                        Send this link to your partner:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={inviteUrl}
                          className="flex-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 text-zinc-700 dark:text-zinc-300"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inviteUrl);
                            alert("Link copied!");
                          }}
                          className="rounded bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Sharing Controls */}
            {files && (
              <section>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Sharing Controls
                </h2>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-4">
                  Choose which files your partner can see when talking to your avatar.
                </p>
                <div className="space-y-2">
                  {files.map((file) => {
                    const setting = sharingSettings.find((s) => s.file_name === file.name);
                    const isShared = setting?.shared || false;
                    return (
                      <label
                        key={file.name}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                      >
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {file.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={isShared}
                          onChange={(e) => updateSharing(file.name, e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 focus:ring-zinc-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Account */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Account
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                {user?.email}
              </p>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Log Out
              </button>
            </section>
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

  // Chat interface (onboarding, brain, or partner-chat)
  const isBrain = mode === "brain";
  const isPartnerChat = mode === "partner-chat";
  const currentMessages = isPartnerChat ? partnerMessages : isBrain ? brainMessages : messages;
  const chatLabel = isPartnerChat
    ? `Talking to ${partnerEmail.split("@")[0]}'s brain`
    : isBrain
    ? "Chat"
    : "Onboarding";

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Second Brain
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
            {chatLabel}
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
              {partnership && (
                <button
                  onClick={startPartnerChat}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  Partner&apos;s Brain
                </button>
              )}
              <button
                onClick={viewFiles}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                View Files
              </button>
              <button
                onClick={() => setMode("settings")}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Settings
              </button>
            </>
          )}
          {isPartnerChat && (
            <button
              onClick={startBrain}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Back to My Brain
            </button>
          )}
          {!isBrain && !isPartnerChat && messages.length >= 6 && (
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
          {currentMessages.length === 0 && isPartnerChat && (
            <p className="text-center text-zinc-400 dark:text-zinc-600 mt-32">
              Ask {partnerEmail.split("@")[0]}&apos;s brain anything.
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
                    : isPartnerChat
                    ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                    : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className={`px-4 py-3 rounded-2xl text-sm ${
                isPartnerChat
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-400"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
              }`}>
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
        <p className="max-w-2xl mx-auto mt-2 text-[10px] text-zinc-300 dark:text-zinc-700 text-right">
          Powered by Claude (Anthropic) · Not used for AI training · Data encrypted
        </p>
      </div>
    </div>
  );
}
