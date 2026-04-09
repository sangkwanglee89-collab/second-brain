"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { Message, GeneratedFile, SharingSetting, Partnership, AppMode, Conversation, PendingUpdate } from "@/lib/types";
import LoadingScreen from "@/components/LoadingScreen";
import WelcomeScreen from "@/components/WelcomeScreen";
import SettingsView from "@/components/SettingsView";
import ResultsView from "@/components/ResultsView";
import ChatView from "@/components/ChatView";
import ConversationSidebar from "@/components/ConversationSidebar";
import DiffReview from "@/components/DiffReview";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [brainMessages, setBrainMessages] = useState<Message[]>([]);
  const [partnerMessages, setPartnerMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [partnership, setPartnership] = useState<Partnership>(null);
  const [sharingSettings, setSharingSettings] = useState<SharingSetting[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [partnerFiles, setPartnerFiles] = useState<GeneratedFile[]>([]);
  const [partnerEmail, setPartnerEmail] = useState("");

  // Diff review state
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[] | null>(null);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createClient();

  // --- Conversation helpers ---

  const fetchConversations = useCallback(async (userId: string) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", userId, chatType: "brain" }),
    });
    const data = await res.json();
    if (data.conversations) setConversations(data.conversations);
  }, []);

  const saveMessages = useCallback(async (conversationId: string, msgs: Message[], title?: string) => {
    if (!user) return;
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        userId: user.id,
        conversationId,
        messages: msgs,
        ...(title ? { title } : {}),
      }),
    });
  }, [user]);

  // Auto-save brain messages when they change (debounced)
  useEffect(() => {
    if (!activeConversationId || brainMessages.length === 0 || mode !== "brain") return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveMessages(activeConversationId, brainMessages);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [brainMessages, activeConversationId, mode, saveMessages]);

  // --- Initialization ---

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
        // Load conversation list
        await fetchConversations(user.id);
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

  // --- Database helpers ---

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

  // --- Conversation actions ---

  async function createConversation(firstMessage?: string): Promise<string | null> {
    if (!user) return null;
    const title = firstMessage
      ? firstMessage.length > 50 ? firstMessage.slice(0, 47) + "..." : firstMessage
      : "New conversation";

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        userId: user.id,
        title,
        chatType: "brain",
      }),
    });
    const data = await res.json();
    if (data.conversation) {
      setConversations((prev) => [data.conversation, ...prev]);
      setActiveConversationId(data.conversation.id);
      return data.conversation.id;
    }
    return null;
  }

  async function loadConversation(conversationId: string) {
    if (!user) return;

    // Auto-update vault from current conversation before switching
    if (activeConversationId && brainMessages.length >= 4) {
      triggerVaultUpdate(brainMessages);
    }

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load", userId: user.id, conversationId }),
    });
    const data = await res.json();
    if (data.conversation) {
      setBrainMessages(data.conversation.messages || []);
      setActiveConversationId(conversationId);
      setMode("brain");
      setSidebarOpen(false);
    }
  }

  async function deleteConversation(conversationId: string) {
    if (!user) return;
    if (!confirm("Delete this conversation?")) return;

    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", userId: user.id, conversationId }),
    });

    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      setBrainMessages([]);
    }
  }

  async function renameConversation(conversationId: string, title: string) {
    if (!user) return;
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", userId: user.id, conversationId, title }),
    });
    setConversations((prev) =>
      prev.map((c) => c.id === conversationId ? { ...c, title } : c)
    );
  }

  function startNewConversation() {
    // Auto-update vault from current conversation before starting new
    if (activeConversationId && brainMessages.length >= 4) {
      triggerVaultUpdate(brainMessages);
    }

    setActiveConversationId(null);
    setBrainMessages([]);
    setMode("brain");
    setSidebarOpen(false);
  }

  // --- Vault update (also used for auto-update) ---

  async function triggerVaultUpdate(msgs: Message[]) {
    if (!files || msgs.length === 0) return;

    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, files }),
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
        return true;
      }
    } catch {
      // Silent fail for auto-updates
    }
    return false;
  }

  // --- Actions ---

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

  async function handleSendMessage(text: string) {
    const userMessage: Message = { role: "user", content: text };
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
    setLoading(true);

    // Create conversation on first brain message if needed
    let convId = activeConversationId;
    if (isBrain && !convId) {
      convId = await createConversation(text);
    }

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
        // Update conversation title from first user message
        if (convId && updatedMessages.filter((m) => m.role === "user").length === 1) {
          const title = text.length > 50 ? text.slice(0, 47) + "..." : text;
          saveMessages(convId, withResponse, title);
          setConversations((prev) =>
            prev.map((c) => c.id === convId ? { ...c, title, updated_at: new Date().toISOString() } : c)
          );
        }
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

        // Transition to brain chat with guided review
        setMode("brain");
        setLoading(true);

        try {
          const reviewMessages: Message[] = [
            { role: "user", content: "I just finished onboarding. Walk me through what you built — does this feel right?" },
          ];

          const reviewRes = await fetch("/api/brain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: reviewMessages, files: data.files, review: true }),
          });
          const reviewData = await reviewRes.json();
          const initialMessages: Message[] = [
            { role: "assistant", content: reviewData.text },
          ];
          setBrainMessages(initialMessages);

          // Create the first conversation
          const convId = await createConversation("Vault review");
          if (convId) {
            saveMessages(convId, initialMessages, "Vault review");
          }
          await fetchConversations(user!.id);
        } catch {
          setBrainMessages([]);
        } finally {
          setLoading(false);
        }
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
        const pending: PendingUpdate[] = data.files.map((updated: GeneratedFile) => {
          const existing = files.find((f) => f.name === updated.name);
          return {
            name: updated.name,
            oldContent: existing?.content || "",
            newContent: updated.content,
            approved: false,
          };
        });
        setPendingUpdates(pending);
      } else {
        alert(data.reason || "No updates needed based on this conversation.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setUpdating(false);
    }
  }

  async function applyApprovedUpdates(approved: PendingUpdate[]) {
    if (!files) return;

    const updatedFiles = files.map((existing) => {
      const update = approved.find((u) => u.name === existing.name);
      return update ? { name: update.name, content: update.newContent } : existing;
    });
    const existingNames = new Set(files.map((f) => f.name));
    const newFiles = approved
      .filter((u) => !existingNames.has(u.name))
      .map((u) => ({ name: u.name, content: u.newContent }));
    const allFiles = [...updatedFiles, ...newFiles];

    setFiles(allFiles);
    await saveFilesToDb(approved.map((u) => ({ name: u.name, content: u.newContent })));
    setPendingUpdates(null);
  }

  function startBrain() {
    setBrainMessages([]);
    setActiveConversationId(null);
    setMode("brain");
    if (user) fetchConversations(user.id);
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
    setConversations([]);
    setActiveConversationId(null);
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

  // --- Routing ---

  if (mode === "loading") {
    return <LoadingScreen />;
  }

  if (mode === "welcome") {
    return (
      <WelcomeScreen
        userEmail={user?.email || ""}
        onStart={startOnboarding}
        onLogout={handleLogout}
      />
    );
  }

  if (pendingUpdates) {
    return (
      <DiffReview
        updates={pendingUpdates}
        onApply={applyApprovedUpdates}
        onDiscard={() => setPendingUpdates(null)}
      />
    );
  }

  if (mode === "settings") {
    return (
      <SettingsView
        files={files}
        partnership={partnership}
        sharingSettings={sharingSettings}
        inviteCode={inviteCode}
        userEmail={user?.email || ""}
        onBack={startBrain}
        onLogout={handleLogout}
        onGenerateInvite={generateInvite}
        onUpdateSharing={updateSharing}
      />
    );
  }

  if (mode === "results" && files) {
    return (
      <ResultsView
        files={files}
        onStartChat={startBrain}
        onReset={resetAll}
      />
    );
  }

  // Chat modes: onboarding, brain, partner-chat
  const chatMode = mode === "partner-chat" ? "partner-chat" : mode === "brain" ? "brain" : "onboarding";
  const currentMessages = mode === "partner-chat" ? partnerMessages : mode === "brain" ? brainMessages : messages;
  const showSidebar = mode === "brain";

  return (
    <div className="flex h-screen">
      {/* Sidebar — always rendered for brain mode, toggled on mobile */}
      {showSidebar && (
        <>
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/20 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <div
            className={`${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } md:translate-x-0 fixed md:relative z-40 md:z-auto w-72 h-full transition-transform duration-200 ease-in-out`}
          >
            <ConversationSidebar
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={loadConversation}
              onNew={startNewConversation}
              onDelete={deleteConversation}
              onRename={renameConversation}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main chat area */}
      <div className="flex-1 min-w-0">
        <ChatView
          chatMode={chatMode}
          messages={currentMessages}
          files={files}
          partnership={partnership}
          partnerEmail={partnerEmail}
          loading={loading}
          generating={generating}
          updating={updating}
          onSendMessage={handleSendMessage}
          onFinish={handleFinish}
          onUpdateVault={handleUpdateVault}
          onStartPartnerChat={startPartnerChat}
          onViewFiles={() => setMode("results")}
          onOpenSettings={() => setMode("settings")}
          onBackToBrain={startBrain}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          showSidebarToggle={showSidebar}
        />
      </div>
    </div>
  );
}
