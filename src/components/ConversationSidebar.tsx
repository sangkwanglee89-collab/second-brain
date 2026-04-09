"use client";

import { useState, useRef, useEffect } from "react";
import type { Conversation } from "@/lib/types";

type ConversationSidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose: () => void;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onClose,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startRename(conv: Conversation) {
    setEditingId(conv.id);
    setEditValue(conv.title);
  }

  function commitRename() {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-col h-full bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Conversations
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            title="New conversation"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors md:hidden"
            title="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 4L4 12M4 4l8 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center mt-8 px-4">
            No conversations yet. Start one below or tap a domain.
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 mx-2 rounded-lg transition-colors ${
              activeId === conv.id
                ? "bg-zinc-200 dark:bg-zinc-800"
                : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
            }`}
          >
            {editingId === conv.id ? (
              <div className="flex-1 px-3 py-2">
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded px-2 py-1 outline-none ring-2 ring-zinc-300 dark:ring-zinc-600"
                />
              </div>
            ) : (
              <button
                onClick={() => onSelect(conv.id)}
                onDoubleClick={() => startRename(conv)}
                className="flex-1 text-left px-3 py-2.5 min-w-0"
              >
                <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {conv.title}
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">
                  {formatDate(conv.updated_at)}
                </p>
              </button>
            )}
            {editingId !== conv.id && (
              <div className="flex items-center opacity-0 group-hover:opacity-100 mr-2 transition-all">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(conv);
                  }}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Rename"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 2.5l3 3M2 9.5L9.5 2l3 3L5 12.5H2v-3z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="p-1 rounded text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2.5 4h9M5.5 4V2.5h3V4M5.5 6.5v3.5M8.5 6.5v3.5M3.5 4l.5 7.5h6l.5-7.5" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
