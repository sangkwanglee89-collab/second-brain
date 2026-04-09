"use client";

import { useState, useRef, useEffect } from "react";
import type { Message, GeneratedFile, Partnership } from "@/lib/types";
import DomainMap from "@/components/DomainMap";
import Markdown from "@/components/Markdown";

type ChatMode = "onboarding" | "brain" | "partner-chat";

type ChatViewProps = {
  chatMode: ChatMode;
  messages: Message[];
  files: GeneratedFile[] | null;
  partnership: Partnership;
  partnerEmail: string;
  loading: boolean;
  generating: boolean;
  updating: boolean;
  onSendMessage: (message: string) => void;
  onFinish: () => void;
  onUpdateVault: () => void;
  onStartPartnerChat: () => void;
  onViewFiles: () => void;
  onOpenSettings: () => void;
  onBackToBrain: () => void;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
};

function ThinkingDots({ variant }: { variant: "default" | "partner" }) {
  const bg = variant === "partner"
    ? "bg-blue-100 dark:bg-blue-900"
    : "bg-zinc-200 dark:bg-zinc-800";
  const dot = variant === "partner"
    ? "bg-blue-400 dark:bg-blue-500"
    : "bg-zinc-400 dark:bg-zinc-500";

  return (
    <div className="flex justify-start">
      <div className={`px-4 py-4 rounded-2xl ${bg}`}>
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${dot} animate-bounce [animation-delay:0ms]`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dot} animate-bounce [animation-delay:150ms]`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dot} animate-bounce [animation-delay:300ms]`} />
        </div>
      </div>
    </div>
  );
}

export default function ChatView({
  chatMode,
  messages,
  files,
  partnership,
  partnerEmail,
  loading,
  generating,
  updating,
  onSendMessage,
  onFinish,
  onUpdateVault,
  onStartPartnerChat,
  onViewFiles,
  onOpenSettings,
  onBackToBrain,
  onToggleSidebar,
  showSidebarToggle,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSendMessage(input.trim());
    setInput("");
  }

  const isBrain = chatMode === "brain";
  const isPartnerChat = chatMode === "partner-chat";
  const partnerName = partnerEmail.split("@")[0];

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showSidebarToggle && (
            <button
              onClick={onToggleSidebar}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors md:hidden"
              title="Conversations"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
          )}
          {isPartnerChat && (
            <button
              onClick={onBackToBrain}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Back to My Brain"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.5 15L7.5 10L12.5 5" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {isPartnerChat ? `${partnerName}'s Brain` : "Second Brain"}
            </h1>
            {!isPartnerChat && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">
                {isBrain ? "Your thinking partner" : "Onboarding"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isBrain && (
            <>
              <button
                onClick={onUpdateVault}
                disabled={updating || messages.length === 0}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                {updating ? "Updating…" : "Save"}
              </button>
              <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
              {partnership && (
                <button
                  onClick={onStartPartnerChat}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  Partner
                </button>
              )}
              <button
                onClick={onViewFiles}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Files
              </button>
              <button
                onClick={onOpenSettings}
                className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                title="Settings"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6.86 2.58a1.18 1.18 0 0 1 2.28 0 1.18 1.18 0 0 0 1.76.73 1.18 1.18 0 0 1 1.61 1.14 1.18 1.18 0 0 0 1.14 1.61 1.18 1.18 0 0 1 .73 1.76 1.18 1.18 0 0 0 0 .72 1.18 1.18 0 0 1-.73 1.76 1.18 1.18 0 0 0-1.14 1.61 1.18 1.18 0 0 1-1.61 1.14 1.18 1.18 0 0 0-1.76.73 1.18 1.18 0 0 1-2.28 0 1.18 1.18 0 0 0-1.76-.73 1.18 1.18 0 0 1-1.61-1.14 1.18 1.18 0 0 0-1.14-1.61 1.18 1.18 0 0 1-.73-1.76 1.18 1.18 0 0 0 0-.72 1.18 1.18 0 0 1 .73-1.76A1.18 1.18 0 0 0 3.49 4.45a1.18 1.18 0 0 1 1.61-1.14 1.18 1.18 0 0 0 1.76-.73Z" />
                  <circle cx="8" cy="8" r="2.2" />
                </svg>
              </button>
            </>
          )}
          {!isBrain && !isPartnerChat && messages.length >= 6 && (
            <button
              onClick={onFinish}
              disabled={generating || loading}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40 transition-colors"
            >
              {generating ? "Building…" : "Finish & Build"}
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && isBrain && files && (
            <DomainMap files={files} onSelectDomain={onSendMessage} />
          )}
          {messages.length === 0 && isPartnerChat && (
            <p className="text-center text-zinc-400 dark:text-zinc-600 mt-32">
              Ask {partnerName}&apos;s brain anything.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in-0 slide-in-from-bottom-2 duration-200`}
            >
              <div
                className={`max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : isPartnerChat
                    ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100"
                }`}
              >
                {msg.role === "assistant" ? <Markdown content={msg.content} /> : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <ThinkingDots variant={isPartnerChat ? "partner" : "default"} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex gap-2 items-end"
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
            placeholder={isPartnerChat ? `Ask about ${partnerName}'s perspective…` : "Type a message…"}
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 150) + "px";
            }}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700 resize-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 p-2.5 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-30 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 9H14.5" />
              <path d="M9 3.5L14.5 9L9 14.5" />
            </svg>
          </button>
        </form>
        <p className="max-w-2xl mx-auto mt-1.5 text-[10px] text-zinc-300 dark:text-zinc-700 text-center">
          Powered by Claude · Not used for AI training · Data encrypted
        </p>
      </div>
    </div>
  );
}
