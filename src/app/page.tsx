"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { Message, GeneratedFile, SharingSetting, Partnership, AppMode } from "@/lib/types";
import LoadingScreen from "@/components/LoadingScreen";
import WelcomeScreen from "@/components/WelcomeScreen";
import SettingsView from "@/components/SettingsView";
import ResultsView from "@/components/ResultsView";
import ChatView from "@/components/ChatView";

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

  const supabase = createClient();

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

  function startBrain() {
    setBrainMessages([]);
    setMode("brain");
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

  return (
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
    />
  );
}
